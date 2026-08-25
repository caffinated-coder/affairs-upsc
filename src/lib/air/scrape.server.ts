import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clampRange, eachMonthInRange, monthRange, todayIst } from "../pib/dates";
import type { ListReleasesInput, ListReleasesResult, ReleaseArticle, ReleaseSummary } from "../pib/types";
import { parseAirArticle, summaryFromPost, type WpPost } from "./parse.server";

const AIR = "https://newsonair.gov.in";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const MAX_RANGE_DAYS = 31;
const LISTING_TTL_MS = 15 * 60 * 1000;
const ARCHIVE_DIR = path.resolve(fileURLToPath(new URL("../../../data/air-archive", import.meta.url)));
const MAX_IMAGE_BYTES = 8_000_000;
const MAX_IMAGE_EDGE = 1400;
const inflight = new Map<string, Promise<ReleaseSummary[]>>();
type Dump = { at: number; year: number; month: number; releases: ReleaseSummary[] };

function archiveDirs(): string[] {
  return [...new Set([path.join(process.cwd(), "data", "air-archive"), ARCHIVE_DIR])];
}
function monthFile(dir: string, year: number, month: number, lang: 1 | 2): string {
  return path.join(dir, `l${lang}`, `${year}-${String(month).padStart(2, "0")}.json`);
}
function isPastMonth(year: number, month: number): boolean {
  const today = todayIst();
  return year < Number(today.slice(0, 4)) || (year === Number(today.slice(0, 4)) && month < Number(today.slice(5, 7)));
}
async function fetchAir(url: string): Promise<{ text: string; headers: Headers }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "application/json,text/plain,*/*", "Accept-Language": "en-IN,en;q=0.9", Referer: `${AIR}/` },
    });
    if (!res.ok) throw new Error(`News on Air returned ${res.status}`);
    return { text: await res.text(), headers: res.headers };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    if (message.includes("abort")) throw new Error("News on Air took too long to respond.");
    throw new Error(`Could not reach News on Air: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}
function listingUrl(from: string, to: string, lang: 1 | 2, page: number): string {
  const params = new URLSearchParams({
    after: `${from}T00:00:00`, before: `${to}T23:59:59`, per_page: String(PAGE_SIZE), page: String(page),
    lang: lang === 2 ? "hi" : "en", orderby: "date", order: "desc", _fields: "id,date,title,link,categories",
  });
  return `${AIR}/wp-json/wp/v2/posts?${params.toString()}`;
}
function detailUrl(id: string, lang: 1 | 2): string {
  const params = new URLSearchParams({ lang: lang === 2 ? "hi" : "en", _fields: "id,date,title,content,link,categories" });
  return `${AIR}/wp-json/wp/v2/posts/${id}?${params.toString()}`;
}
async function readDump(year: number, month: number, lang: 1 | 2): Promise<Dump | null> {
  for (const dir of archiveDirs()) {
    try {
      const dump = JSON.parse(await readFile(monthFile(dir, year, month, lang), "utf8")) as Dump;
      if (Array.isArray(dump.releases) && dump.releases.length) return dump;
    } catch {}
  }
  return null;
}
async function writeDump(year: number, month: number, lang: 1 | 2, releases: ReleaseSummary[]) {
  try {
    const file = monthFile(archiveDirs()[0], year, month, lang);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ at: Date.now(), year, month, releases } satisfies Dump));
  } catch {}
}
async function fetchRangeFromNetwork(from: string, to: string, lang: 1 | 2): Promise<ReleaseSummary[]> {
  const byId = new Map<string, ReleaseSummary>();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { text } = await fetchAir(listingUrl(from, to, lang, page));
    let rows: WpPost[] = [];
    try { rows = JSON.parse(text) as WpPost[]; } catch { break; }
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const post of rows) {
      const item = summaryFromPost(post);
      if (!item || item.postedDate < from || item.postedDate > to) continue;
      if (!byId.has(item.prid)) byId.set(item.prid, item);
    }
    if (rows.length < PAGE_SIZE) break;
  }
  return [...byId.values()];
}
async function fetchMonthFromNetwork(year: number, month: number, lang: 1 | 2) {
  const { from, to } = monthRange(year, month);
  return fetchRangeFromNetwork(from, to, lang);
}
async function loadMonthInner(year: number, month: number, lang: 1 | 2): Promise<ReleaseSummary[]> {
  const dump = await readDump(year, month, lang);
  if (dump?.releases.length) {
    if (!isPastMonth(year, month) && Date.now() - dump.at >= LISTING_TTL_MS) {
      void fetchMonthFromNetwork(year, month, lang).then((fresh) => { if (fresh.length) return writeDump(year, month, lang, fresh); }).catch(() => undefined);
    }
    return dump.releases;
  }
  const fresh = await fetchMonthFromNetwork(year, month, lang);
  if (fresh.length) await writeDump(year, month, lang, fresh);
  return fresh;
}
function loadMonth(year: number, month: number, lang: 1 | 2): Promise<ReleaseSummary[]> {
  const key = `${lang}:${year}-${month}`;
  const hit = inflight.get(key);
  if (hit) return hit;
  const pending = loadMonthInner(year, month, lang).finally(() => { if (inflight.get(key) === pending) inflight.delete(key); });
  inflight.set(key, pending);
  return pending;
}
export async function listAirForRange(input: ListReleasesInput): Promise<ListReleasesResult> {
  const today = todayIst();
  const { from, to } = clampRange(input.from || today, input.to || today, MAX_RANGE_DAYS);
  const lang = input.lang === 2 ? 2 : 1;
  const span = (Date.parse(`${to}T00:00:00+05:30`) - Date.parse(`${from}T00:00:00+05:30`)) / 86_400_000;
  let raw: ReleaseSummary[];
  if (span <= 7) raw = await fetchRangeFromNetwork(from, to, lang);
  else {
    const months = eachMonthInRange(from, to);
    raw = (await Promise.all(months.map((m) => loadMonth(m.year, m.month, lang)))).flat();
  }
  const byId = new Map<string, ReleaseSummary>();
  for (const item of raw) {
    if (item.postedDate < from || item.postedDate > to) continue;
    if (!byId.has(item.prid)) byId.set(item.prid, item);
  }
  const releases = [...byId.values()].sort((a, b) => a.postedDate !== b.postedDate ? (a.postedDate < b.postedDate ? 1 : -1) : a.title.localeCompare(b.title));
  const ministries = [...new Set(releases.map((r) => r.ministry))].sort((a, b) => a.localeCompare(b));
  return { from, to, lang, count: releases.length, ministries, releases };
}
async function fetchImageDataUrl(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18_000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": UA, Accept: "image/*", Referer: `${AIR}/` } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 32 || buf.length > MAX_IMAGE_BYTES) return null;
    try {
      const { default: sharp } = await import("sharp");
      const data = await sharp(buf, { failOn: "none" }).rotate().resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
      return `data:image/jpeg;base64,${data.toString("base64")}`;
    } catch {
      return `data:image/jpeg;base64,${buf.toString("base64")}`;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
async function readArticle(prid: string, lang: 1 | 2): Promise<ReleaseArticle | null> {
  for (const dir of archiveDirs()) {
    try {
      const dump = JSON.parse(await readFile(path.join(dir, "articles", `l${lang}`, `${prid}.json`), "utf8")) as { article: ReleaseArticle };
      if (dump?.article?.prid) return dump.article;
    } catch {}
  }
  return null;
}
async function writeArticle(lang: 1 | 2, article: ReleaseArticle) {
  try {
    const file = path.join(archiveDirs()[0], "articles", `l${lang}`, `${article.prid}.json`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ at: Date.now(), article }));
  } catch {}
}
export async function fetchAirArticles(prids: string[], lang: 1 | 2): Promise<ReleaseArticle[]> {
  const unique = [...new Set(prids)].slice(0, 40);
  const out: ReleaseArticle[] = [];
  for (const prid of unique) {
    const cached = await readArticle(prid, lang);
    if (cached) { out.push(cached); continue; }
    const { text } = await fetchAir(detailUrl(prid, lang));
    const article = parseAirArticle(JSON.parse(text) as WpPost);
    for (const block of article.blocks) {
      if (block.type === "image" && !block.dataUrl) {
        const dataUrl = await fetchImageDataUrl(block.src);
        if (dataUrl) block.dataUrl = dataUrl;
      }
    }
    void writeArticle(lang, article);
    out.push(article);
  }
  return out;
}
