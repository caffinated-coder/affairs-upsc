import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  bucketKey, clampIsoDate, clampRange, eachMonthInRange, formatSeriesLabel,
  MIN_DATE, seriesKeys, todayIst, volumeWindow,
} from "./dates";
import { extractAspNetFields, parseArticle, parseListing, readListingCalendar, releaseUrl } from "./parse.server";
import type {
  FetchArticlesInput, ListReleasesInput, ListReleasesResult, ListVolumeInput, ListVolumeResult, ReleaseArticle, ReleaseSummary,
} from "./types";

const PIB = "https://www.pib.gov.in";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const listingCache = new Map<string, { at: number; html: string }>();
const inflightMonths = new Map<string, Promise<ReleaseSummary[]>>();
const inflightRefresh = new Map<string, Promise<ReleaseSummary[]>>();
const inflightSeed = new Map<1 | 2, Promise<string>>();
const monthMem = new Map<string, { at: number; releases: ReleaseSummary[] }>();
const warming = new Set<string>();
const LISTING_TTL_MS = 15 * 60 * 1000;
const ARTICLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ARCHIVE_DIR = path.join(process.cwd(), "data", "pib-archive");
const MAX_RANGE_DAYS = 31;
const FETCH_TIMEOUT_MS = 28_000;
const POST_TIMEOUT_MS = 45_000;
const MAX_IMAGE_BYTES = 8_000_000;
const IMAGE_TIMEOUT_MS = 20_000;
const MAX_IMAGE_EDGE = 1400;

async function fetchHtml(url: string, body?: URLSearchParams): Promise<string> {
  const controller = new AbortController();
  const timeout = body ? POST_TIMEOUT_MS : FETCH_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
        Referer: `${PIB}/`,
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded", Origin: PIB } : {}),
      },
      redirect: "follow",
      body,
    });
    if (!res.ok) throw new Error(`PIB returned ${res.status} for ${url}`);
    return await res.text();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    if (message.includes("abort")) throw new Error("PIB took too long to respond. Try a shorter date range.");
    throw new Error(`Could not reach PIB: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

function sniffMime(buf: Buffer): string | null {
  if (buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.length > 3 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e) return "image/png";
  if (buf.length > 3 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf.length > 11 && buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

async function compressImage(buf: Buffer, mime: string): Promise<{ mime: string; data: Buffer } | null> {
  try {
    const { default: sharp } = await import("sharp");
    const meta = await sharp(buf, { failOn: "none", animated: false }).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    let pipeline = sharp(buf, { failOn: "none", animated: false }).rotate();
    if (w > MAX_IMAGE_EDGE || h > MAX_IMAGE_EDGE) {
      pipeline = pipeline.resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: "inside", withoutEnlargement: true });
    }
    const keepPng = mime === "image/png" && buf.length <= 280_000 && w <= 1600 && h <= 1600;
    if (keepPng) {
      const data = await pipeline.png({ compressionLevel: 8 }).toBuffer();
      return data.length >= 32 ? { mime: "image/png", data } : null;
    }
    const data = await pipeline.jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    return data.length >= 32 ? { mime: "image/jpeg", data } : null;
  } catch {
    if (buf.length > MAX_IMAGE_BYTES) return null;
    return { mime, data: buf };
  }
}

async function fetchImageDataUrl(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "image/jpeg,image/png,image/gif,image/webp,image/*;q=0.8", Referer: `${PIB}/` },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 32 || buf.length > MAX_IMAGE_BYTES) return null;
    const headerType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const mime =
      headerType === "image/jpeg" || headerType === "image/jpg" || headerType === "image/png" || headerType === "image/gif" || headerType === "image/webp"
        ? headerType === "image/jpg" ? "image/jpeg" : headerType
        : sniffMime(buf);
    if (!mime) return null;
    const optimized = await compressImage(buf, mime);
    if (!optimized) return null;
    return `data:${optimized.mime};base64,${optimized.data.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

async function hydrateImages(article: ReleaseArticle): Promise<ReleaseArticle> {
  const images = article.blocks.filter((b) => b.type === "image");
  if (images.length === 0) return article;
  await mapPool(images, 2, async (block) => {
    if (block.type !== "image") return block;
    const dataUrl = await fetchImageDataUrl(block.src);
    if (dataUrl) block.dataUrl = dataUrl;
    return block;
  });
  return article;
}

function isPastMonth(year: number, month: number): boolean {
  const today = todayIst();
  return year < Number(today.slice(0, 4)) || (year === Number(today.slice(0, 4)) && month < Number(today.slice(5, 7)));
}
function archivePath(year: number, month: number, lang: 1 | 2): string {
  return path.join(ARCHIVE_DIR, `l${lang}`, `${year}-${String(month).padStart(2, "0")}.json`);
}
type MonthDump = { year: number; month: number; lang: 1 | 2; fetchedAt: number; releases: ReleaseSummary[] };
async function readMonthDump(year: number, month: number, lang: 1 | 2): Promise<MonthDump | null> {
  try {
    const dump = JSON.parse(await readFile(archivePath(year, month, lang), "utf8")) as MonthDump;
    return dump && Array.isArray(dump.releases) ? dump : null;
  } catch {
    return null;
  }
}
async function writeMonthDump(dump: MonthDump): Promise<void> {
  try {
    const file = archivePath(dump.year, dump.month, dump.lang);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(dump));
  } catch {}
}
function cacheFresh(key: string, ttl: number): string | null {
  const cached = listingCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.at >= ttl) { listingCache.delete(key); return null; }
  return cached.html;
}
function cacheSet(key: string, html: string) { listingCache.set(key, { at: Date.now(), html }); }
function loadListingSeed(lang: 1 | 2): Promise<string> {
  const hit = inflightSeed.get(lang);
  if (hit) return hit;
  const pending = fetchHtml(`${PIB}/AllRelease.aspx?lang=${lang}&reg=3`);
  inflightSeed.set(lang, pending);
  pending.then(() => { setTimeout(() => { if (inflightSeed.get(lang) === pending) inflightSeed.delete(lang); }, 20_000); }, () => { if (inflightSeed.get(lang) === pending) inflightSeed.delete(lang); });
  return pending;
}
async function postListing(url: string, seedHtml: string, lang: 1 | 2, month: number, year: number, day = 0): Promise<string> {
  const fields = extractAspNetFields(seedHtml);
  fields["ctl00$Bar1$ddlregion"] = "3";
  fields["ctl00$Bar1$ddlLang"] = String(lang);
  fields["ctl00$ContentPlaceHolder1$ddlMinistry"] = "0";
  fields["ctl00$ContentPlaceHolder1$ddlday"] = String(day);
  fields["ctl00$ContentPlaceHolder1$ddlMonth"] = String(month);
  fields["ctl00$ContentPlaceHolder1$ddlYear"] = String(year);
  fields["__EVENTTARGET"] = "ctl00$ContentPlaceHolder1$ddlYear";
  fields["__EVENTARGUMENT"] = fields["__EVENTARGUMENT"] ?? "";
  return fetchHtml(url, new URLSearchParams(fields));
}
async function fetchMonthListing(year: number, month: number, lang: 1 | 2): Promise<string> {
  if (year < 2017 || `${year}-${String(month).padStart(2, "0")}-01` < MIN_DATE) throw new Error("PIB listings start in January 2017.");
  const key = `month:${year}-${month}-${lang}`;
  const ttl = isPastMonth(year, month) ? 24 * 60 * 60 * 1000 : LISTING_TTL_MS;
  const cached = cacheFresh(key, ttl);
  if (cached) return cached;
  const url = `${PIB}/AllRelease.aspx?lang=${lang}&reg=3`;
  const seed = await loadListingSeed(lang);
  const cal = readListingCalendar(seed);
  const html = cal && cal.month === month && cal.year === year ? seed : await postListing(url, seed, lang, month, year, 0);
  const got = readListingCalendar(html);
  if (!got || got.month !== month || got.year !== year) throw new Error(`PIB did not serve ${month}/${year}. Try that month again.`);
  cacheSet(key, html);
  return html;
}
function monthKey(year: number, month: number, lang: 1 | 2) { return `${lang}:${year}-${month}`; }
function rememberMonth(year: number, month: number, lang: 1 | 2, releases: ReleaseSummary[], at = Date.now()) {
  monthMem.set(monthKey(year, month, lang), { at, releases });
}
async function refreshMonthFromNetwork(year: number, month: number, lang: 1 | 2): Promise<ReleaseSummary[]> {
  const html = await fetchMonthListing(year, month, lang);
  const releases = parseListing(html, `${year}-${String(month).padStart(2, "0")}-01`, lang);
  if (releases.length > 0) {
    rememberMonth(year, month, lang, releases);
    await writeMonthDump({ year, month, lang, fetchedAt: Date.now(), releases });
  }
  return releases;
}
function scheduleMonthRefresh(year: number, month: number, lang: 1 | 2) {
  const key = monthKey(year, month, lang);
  if (inflightRefresh.has(key)) return;
  const pending = refreshMonthFromNetwork(year, month, lang).finally(() => { if (inflightRefresh.get(key) === pending) inflightRefresh.delete(key); });
  inflightRefresh.set(key, pending);
}
async function loadMonthReleasesInner(year: number, month: number, lang: 1 | 2): Promise<ReleaseSummary[]> {
  const key = monthKey(year, month, lang);
  const past = isPastMonth(year, month);
  const mem = monthMem.get(key);
  if (mem && (past || Date.now() - mem.at < LISTING_TTL_MS)) return mem.releases;
  const dump = await readMonthDump(year, month, lang);
  if (dump) {
    rememberMonth(year, month, lang, dump.releases, dump.fetchedAt);
    if (!past && Date.now() - dump.fetchedAt >= LISTING_TTL_MS) scheduleMonthRefresh(year, month, lang);
    return dump.releases;
  }
  return inflightRefresh.get(key) ?? refreshMonthFromNetwork(year, month, lang);
}
function loadMonthReleases(year: number, month: number, lang: 1 | 2): Promise<ReleaseSummary[]> {
  const key = `${lang}:${year}-${month}`;
  const hit = inflightMonths.get(key);
  if (hit) return hit;
  const pending = loadMonthReleasesInner(year, month, lang).finally(() => { if (inflightMonths.get(key) === pending) inflightMonths.delete(key); });
  inflightMonths.set(key, pending);
  return pending;
}
function warmArchive(lang: 1 | 2, anchor: string) {
  const flag = `warm:${lang}`;
  if (warming.has(flag)) return;
  warming.add(flag);
  const today = todayIst();
  const { from } = volumeWindow("month", anchor, today);
  void (async () => {
    for (const m of eachMonthInRange(from, today).reverse()) {
      try { await loadMonthReleases(m.year, m.month, lang); } catch {}
    }
    warming.delete(flag);
  })();
}
async function fetchTodayListing(lang: 1 | 2, today: string): Promise<string> {
  const key = `day:${today}-${lang}`;
  const cached = cacheFresh(key, LISTING_TTL_MS);
  if (cached) return cached;
  const html = await fetchHtml(`${PIB}/Allrel.aspx?reg=3&lang=${lang}`);
  cacheSet(key, html);
  return html;
}
export async function listReleasesForRange(input: ListReleasesInput): Promise<ListReleasesResult> {
  const today = todayIst();
  const { from, to } = clampRange(input.from || today, input.to || today, MAX_RANGE_DAYS);
  const lang = input.lang === 2 ? 2 : 1;
  const byId = new Map<string, ReleaseSummary>();
  if (from === to && from === today) {
    try {
      const html = await fetchTodayListing(lang, today);
      for (const item of parseListing(html, from, lang)) if (!byId.has(item.prid)) byId.set(item.prid, { ...item, postedDate: from });
    } catch {}
  }
  if (byId.size === 0) {
    const pages = await Promise.all(eachMonthInRange(from, to).map((m) => loadMonthReleases(m.year, m.month, lang)));
    for (const items of pages) for (const item of items) {
      if (item.postedDate < from || item.postedDate > to) continue;
      if (!byId.has(item.prid)) byId.set(item.prid, item);
    }
  }
  warmArchive(lang, to);
  const releases = [...byId.values()].sort((a, b) => a.postedDate !== b.postedDate ? (a.postedDate < b.postedDate ? 1 : -1) : a.ministry.localeCompare(b.ministry) || a.title.localeCompare(b.title));
  const ministries = [...new Set(releases.map((r) => r.ministry))].sort((a, b) => a.localeCompare(b));
  return { from, to, lang, count: releases.length, ministries, releases };
}
export async function listVolume(input: ListVolumeInput): Promise<ListVolumeResult> {
  const today = todayIst();
  const lang = input.lang === 2 ? 2 : 1;
  const grain = input.grain;
  const anchor = clampIsoDate(input.to || today);
  const { from, to } = volumeWindow(grain, anchor, today);
  const pages = await mapPool(eachMonthInRange(from, to), 2, async (m) => {
    try { return await loadMonthReleases(m.year, m.month, lang); } catch { return [] as ReleaseSummary[]; }
  });
  warmArchive(lang, to);
  const counts = new Map<string, number>();
  const desks = new Map<string, number>();
  const seen = new Set<string>();
  for (const items of pages) for (const item of items) {
    if (item.postedDate < from || item.postedDate > to || seen.has(item.prid)) continue;
    seen.add(item.prid);
    counts.set(bucketKey(grain, item.postedDate), (counts.get(bucketKey(grain, item.postedDate)) ?? 0) + 1);
    desks.set(item.ministry, (desks.get(item.ministry) ?? 0) + 1);
  }
  return {
    grain, from, to, lang, total: seen.size,
    series: seriesKeys(grain, from, to).map((key) => ({ key, label: formatSeriesLabel(grain, key, lang), count: counts.get(key) ?? 0 })),
    desks: [...desks.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}
function articlePath(prid: string, lang: 1 | 2) { return path.join(ARCHIVE_DIR, "articles", `l${lang}`, `${prid}.json`); }
async function readArticleDump(prid: string, lang: 1 | 2): Promise<ReleaseArticle | null> {
  try {
    const dump = JSON.parse(await readFile(articlePath(prid, lang), "utf8")) as { at: number; article: ReleaseArticle };
    if (!dump?.article?.prid || Date.now() - dump.at > ARTICLE_TTL_MS) return null;
    return dump.article;
  } catch { return null; }
}
async function writeArticleDump(article: ReleaseArticle, lang: 1 | 2): Promise<void> {
  try {
    const file = articlePath(article.prid, lang);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ at: Date.now(), article }));
  } catch {}
}
export async function fetchArticles(input: FetchArticlesInput): Promise<ReleaseArticle[]> {
  const lang = input.lang === 2 ? 2 : 1;
  return mapPool([...new Set(input.prids)].slice(0, 40), 3, async (prid) => {
    const cached = await readArticleDump(prid, lang);
    if (cached) return cached.blocks.some((b) => b.type === "image" && !b.dataUrl) ? hydrateImages(cached) : cached;
    const hydrated = await hydrateImages(parseArticle(await fetchHtml(releaseUrl(prid, lang)), prid, lang));
    void writeArticleDump(hydrated, lang);
    return hydrated;
  });
}
