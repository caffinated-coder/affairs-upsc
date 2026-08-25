import { mkdir, readFile, writeFile } from "node:fs/promises";
import https from "node:https";
import { resolve4 } from "node:dns/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clampRange, eachMonthInRange, monthRange, todayIst } from "../pib/dates";
import type { DigestSource, ListReleasesInput, ListReleasesResult, ReleaseArticle, ReleaseSummary } from "../pib/types";
import { parseMeaArticle, parseMeaListing } from "./parse.server";

const MEA = "https://www.mea.gov.in";
const ORIGIN_HOST = "www.mea.gov.in";
const ORIGIN_DNS = "mea.gov.in";
const FALLBACK_ORIGIN_IPS = ["166.117.108.126", "166.117.156.229"];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const PAGE_SIZE = 50;
const MAX_PAGES = 16;
const MAX_RANGE_DAYS = 62;
const LISTING_TTL_MS = 15 * 60 * 1000;
const ARCHIVE_DIR = path.resolve(fileURLToPath(new URL("../../../data/mea-archive", import.meta.url)));
const MAX_IMAGE_BYTES = 8_000_000;
const MAX_IMAGE_EDGE = 1400;
const ORIGIN_TTL_MS = 10 * 60 * 1000;
const inflight = new Map<string, Promise<ReleaseSummary[]>>();
let originCache: { at: number; ips: string[] } | null = null;
type Dump = { at: number; year: number; month: number; releases: ReleaseSummary[] };
type Fetched = { status: number; body: Buffer; contentType: string };

function pubId(source: DigestSource): number { return source === "bilateral" ? 53 : 51; }
function dateRangeParam(from: string, to: string): string {
  const fmt = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
  return `${fmt(from)} - ${fmt(to)}`;
}
function isPastMonth(year: number, month: number): boolean {
  const today = todayIst();
  return year < Number(today.slice(0, 4)) || (year === Number(today.slice(0, 4)) && month < Number(today.slice(5, 7)));
}
function defaultHeaders(extra?: Record<string, string>): Record<string, string> {
  return { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8", "Accept-Language": "en-IN,en;q=0.9", Referer: `${MEA}/press-releases`, "X-Requested-With": "XMLHttpRequest", ...extra };
}
async function resolveOriginIps(): Promise<string[]> {
  if (originCache && Date.now() - originCache.at < ORIGIN_TTL_MS && originCache.ips.length) return originCache.ips;
  try {
    const ips = await resolve4(ORIGIN_DNS);
    if (ips.length) { originCache = { at: Date.now(), ips }; return ips; }
  } catch {}
  return originCache?.ips.length ? originCache.ips : FALLBACK_ORIGIN_IPS;
}
function httpsGet(ip: string, url: string, headers: Record<string, string>, timeoutMs: number): Promise<Fetched> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({ hostname: ip, port: 443, path: `${parsed.pathname}${parsed.search}`, method: "GET", servername: ORIGIN_HOST, headers: { ...headers, Host: ORIGIN_HOST } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk as Buffer));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks), contentType: String(res.headers["content-type"] ?? "") }));
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    req.end();
  });
}
function isMeaHost(url: string): boolean {
  try { const host = new URL(url).hostname.toLowerCase(); return host === ORIGIN_HOST || host === ORIGIN_DNS || host.endsWith(".mea.gov.in"); } catch { return false; }
}
async function fetchViaCloudFront(url: string, headers: Record<string, string>, timeoutMs: number): Promise<Fetched> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal, headers, redirect: "follow" });
    return { status: res.status, body: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "" };
  } finally { clearTimeout(timer); }
}
async function fetchMeaBuffer(url: string, extraHeaders?: Record<string, string>, timeoutMs = 28_000): Promise<Fetched> {
  const headers = defaultHeaders(extraHeaders);
  if (!isMeaHost(url)) return fetchViaCloudFront(url, headers, timeoutMs);
  const ips = await resolveOriginIps();
  let blocked = false;
  let lastErr: Error | null = null;
  for (const ip of ips) {
    try {
      const res = await httpsGet(ip, url, headers, timeoutMs);
      if (res.status === 403) { blocked = true; continue; }
      if (res.status >= 200 && res.status < 300) return res;
      lastErr = new Error(`MEA returned ${res.status}`);
    } catch (err) { lastErr = err instanceof Error ? err : new Error("Network error"); }
  }
  try {
    const res = await fetchViaCloudFront(url, headers, timeoutMs);
    if (res.status === 403) throw new Error("MEA_BLOCKED");
    if (res.status < 200 || res.status >= 300) throw new Error(`MEA returned ${res.status}`);
    return res;
  } catch (err) {
    if (blocked) throw new Error("MEA_BLOCKED");
    throw lastErr ?? (err instanceof Error ? err : new Error("Network error"));
  }
}
async function fetchMea(url: string): Promise<string> {
  try {
    return (await fetchMeaBuffer(url)).body.toString("utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    if (message === "MEA_BLOCKED") throw new Error("MEA\u2019s CDN blocked this network. On a home or India connection it should load.");
    if (message.includes("timeout") || message.includes("abort")) throw new Error("MEA took too long to respond.");
    throw new Error(`Could not reach MEA: ${message}`);
  }
}
function listingUrl(source: DigestSource, from: string, to: string, lang: 1 | 2, page: number): string {
  const params = new URLSearchParams({ publicationId: String(pubId(source)), KeywordName: "", SortBy: "new", page: String(page), PageSize: String(PAGE_SIZE), DateRange: dateRangeParam(from, to), PLngId: String(lang) });
  return `${MEA}/FrontEnd/FetchPublicationListingData?${params.toString()}`;
}
function detailUrl(pkid: string, lang: 1 | 2): string {
  return `${MEA}/FrontEnd/FetchPublicationDetailData?pkid=${pkid}&languageId=${lang}`;
}
function archiveDirs(): string[] {
  return [...new Set([path.join(process.cwd(), "data", "mea-archive"), ARCHIVE_DIR])];
}
function monthFile(dir: string, source: DigestSource, year: number, month: number, lang: 1 | 2): string {
  return path.join(dir, source, `l${lang}`, `${year}-${String(month).padStart(2, "0")}.json`);
}
async function readDump(source: DigestSource, year: number, month: number, lang: 1 | 2): Promise<Dump | null> {
  for (const dir of archiveDirs()) {
    try {
      const dump = JSON.parse(await readFile(monthFile(dir, source, year, month, lang), "utf8")) as Dump;
      if (Array.isArray(dump.releases) && dump.releases.length) return dump;
    } catch {}
  }
  return null;
}
async function writeDump(source: DigestSource, year: number, month: number, lang: 1 | 2, releases: ReleaseSummary[]) {
  try {
    const file = monthFile(archiveDirs()[0], source, year, month, lang);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ at: Date.now(), year, month, releases } satisfies Dump));
  } catch {}
}
async function fetchMonthFromNetwork(source: DigestSource, year: number, month: number, lang: 1 | 2): Promise<ReleaseSummary[]> {
  const { from, to } = monthRange(year, month);
  const byId = new Map<string, ReleaseSummary>();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const items = parseMeaListing(await fetchMea(listingUrl(source, from, to, lang, page)), source, to);
    if (items.length === 0) break;
    for (const item of items) {
      if (item.postedDate && (item.postedDate < from || item.postedDate > to)) continue;
      if (!byId.has(item.prid)) byId.set(item.prid, item);
    }
    if (items.length < PAGE_SIZE) break;
  }
  return [...byId.values()];
}
async function loadMonthInner(source: DigestSource, year: number, month: number, lang: 1 | 2): Promise<ReleaseSummary[]> {
  const dump = await readDump(source, year, month, lang);
  if (dump?.releases.length) {
    if (!isPastMonth(year, month) && Date.now() - dump.at >= LISTING_TTL_MS) {
      void fetchMonthFromNetwork(source, year, month, lang).then((fresh) => { if (fresh.length) return writeDump(source, year, month, lang, fresh); }).catch(() => undefined);
    }
    return dump.releases;
  }
  const fresh = await fetchMonthFromNetwork(source, year, month, lang);
  if (fresh.length) await writeDump(source, year, month, lang, fresh);
  return fresh;
}
function loadMonth(source: DigestSource, year: number, month: number, lang: 1 | 2): Promise<ReleaseSummary[]> {
  const key = `${source}:${lang}:${year}-${month}`;
  const hit = inflight.get(key);
  if (hit) return hit;
  const pending = loadMonthInner(source, year, month, lang).finally(() => { if (inflight.get(key) === pending) inflight.delete(key); });
  inflight.set(key, pending);
  return pending;
}
export async function listMeaForRange(source: DigestSource, input: ListReleasesInput): Promise<ListReleasesResult> {
  const today = todayIst();
  const { from, to } = clampRange(input.from || today, input.to || today, MAX_RANGE_DAYS);
  const lang = input.lang === 2 ? 2 : 1;
  const pages = await Promise.all(eachMonthInRange(from, to).map((m) => loadMonth(source, m.year, m.month, lang)));
  const byId = new Map<string, ReleaseSummary>();
  for (const items of pages) for (const item of items) {
    if (item.postedDate < from || item.postedDate > to) continue;
    if (!byId.has(item.prid)) byId.set(item.prid, item);
  }
  const releases = [...byId.values()].sort((a, b) => a.postedDate !== b.postedDate ? (a.postedDate < b.postedDate ? 1 : -1) : a.title.localeCompare(b.title));
  return { from, to, lang, count: releases.length, ministries: [...new Set(releases.map((r) => r.ministry))].sort(), releases };
}
async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetchMeaBuffer(url, { Accept: "image/*,*/*;q=0.8", Referer: `${MEA}/` }, 18_000);
    if (res.status < 200 || res.status >= 300) return null;
    const buf = res.body;
    if (buf.length < 32 || buf.length > MAX_IMAGE_BYTES) return null;
    try {
      const { default: sharp } = await import("sharp");
      const data = await sharp(buf, { failOn: "none" }).rotate().resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
      return `data:image/jpeg;base64,${data.toString("base64")}`;
    } catch {
      return `data:${res.contentType.split(";")[0]?.trim() || "image/jpeg"};base64,${buf.toString("base64")}`;
    }
  } catch { return null; }
}
async function readArticle(source: DigestSource, prid: string, lang: 1 | 2): Promise<ReleaseArticle | null> {
  for (const dir of archiveDirs()) {
    try {
      const dump = JSON.parse(await readFile(path.join(dir, "articles", source, `l${lang}`, `${prid}.json`), "utf8")) as { article: ReleaseArticle };
      if (dump?.article?.prid) return dump.article;
    } catch {}
  }
  return null;
}
async function writeArticle(source: DigestSource, lang: 1 | 2, article: ReleaseArticle) {
  try {
    const file = path.join(archiveDirs()[0], "articles", source, `l${lang}`, `${article.prid}.json`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ at: Date.now(), article }));
  } catch {}
}
export async function fetchMeaArticles(source: DigestSource, prids: string[], lang: 1 | 2): Promise<ReleaseArticle[]> {
  const out: ReleaseArticle[] = [];
  for (const prid of [...new Set(prids)].slice(0, 40)) {
    const cached = await readArticle(source, prid, lang);
    if (cached) { out.push(cached); continue; }
    const article = parseMeaArticle(await fetchMea(detailUrl(prid, lang)), prid, source, lang);
    for (const block of article.blocks) {
      if (block.type === "image" && !block.dataUrl) {
        const dataUrl = await fetchImageDataUrl(block.src);
        if (dataUrl) block.dataUrl = dataUrl;
      }
    }
    void writeArticle(source, lang, article);
    out.push(article);
  }
  return out;
}
