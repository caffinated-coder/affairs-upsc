import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { parsePostedDate } from "./dates";
import type { ArticleBlock, ReleaseArticle, ReleaseSummary } from "./types";

const PIB_ORIGIN = "https://www.pib.gov.in";
const MAX_IMAGES = 12;
const CHROME_IMG =
  /socialmedianew|facebook|twitter|whatsapp|linkedin|email1|indian-emblem|azadi|ph2023818240601|theme\.png|handicape|close_flat|g20-india/i;
const JUNK_PARA = /^(?:\*{3,}|PR\/[A-Z]+|Release ID:|Visitor Counter|[A-Z]{2,}(?:\/[A-Z]{2,})+$)/i;

function decode(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
function pridFromHref(href: string | undefined): string | null {
  if (!href) return null;
  return href.match(/PRID=(\d+)/i)?.[1] ?? null;
}
export function releaseUrl(prid: string, lang: 1 | 2): string {
  return `${PIB_ORIGIN}/PressReleasePage.aspx?PRID=${prid}&lang=${lang}`;
}
export function absUrl(src: string): string {
  const raw = src.trim();
  if (!raw) return "";
  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/")) return `${PIB_ORIGIN}${raw}`;
  return `${PIB_ORIGIN}/${raw.replace(/^\.\//, "")}`;
}
function isChromeImg(src: string, alt: string): boolean {
  return CHROME_IMG.test(`${src} ${alt}`) || /^share on/i.test(alt);
}
export function extractAspNetFields(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const fields: Record<string, string> = {};
  $("input[name]").each((_, el) => {
    const $el = $(el);
    const name = $el.attr("name");
    if (!name) return;
    const type = ($el.attr("type") || "text").toLowerCase();
    if (type === "submit" || type === "button" || type === "image" || type === "checkbox" || type === "radio") return;
    fields[name] = $el.attr("value") ?? "";
  });
  return fields;
}
export function readListingCalendar(html: string): { day: number; month: number; year: number } | null {
  const $ = cheerio.load(html);
  const selected = (id: string): number | null => {
    const raw = $(`#${id}`).val();
    const value = Array.isArray(raw) ? raw[0] : raw;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const month = selected("ContentPlaceHolder1_ddlMonth");
  const year = selected("ContentPlaceHolder1_ddlYear");
  if (!month || !year) return null;
  return { day: selected("ContentPlaceHolder1_ddlday") ?? 0, month, year };
}
export function parseListing(html: string, fallbackDate: string, lang: 1 | 2): ReleaseSummary[] {
  const $ = cheerio.load(html);
  const items: ReleaseSummary[] = [];
  const seen = new Set<string>();
  const push = (prid: string, title: string, ministry: string, postedDate: string) => {
    if (seen.has(prid) || !title) return;
    seen.add(prid);
    items.push({ prid, title, ministry: ministry || "Unspecified", postedDate, url: releaseUrl(prid, lang) });
  };
  const area = $(".content-area");
  const roots = area.length ? area : $("body");
  roots.find("ul.num").each((_, ul) => {
    const $ul = $(ul);
    let ministry = decode($ul.closest("li").children("h3").first().text() || $ul.parent().children("h3").first().text() || $ul.prevAll("h3").first().text());
    $ul.children().each((__, child) => {
      if (child.type !== "tag") return;
      const el = child as Element;
      const tag = (el.tagName || "").toLowerCase();
      const $child = $(el);
      if (tag === "h3") { const name = decode($child.text()); if (name) ministry = name; return; }
      if (tag !== "li") return;
      const a = $child.find("a[href*='PRID=']").first();
      const prid = pridFromHref(a.attr("href"));
      if (!prid) return;
      const title = decode(a.attr("title") || a.text());
      const dateRaw = $child.find(".publishdatesmall").text() || $child.text().match(/Posted on:\s*[^<\n]+/i)?.[0] || "";
      push(prid, title, ministry, parsePostedDate(dateRaw) ?? fallbackDate);
    });
  });
  if (items.length > 0) return items;
  roots.find("a[href*='PRID=']").each((_, a) => {
    const href = $(a).attr("href") || "";
    if (!/PressRele[as]e/i.test(href)) return;
    const prid = pridFromHref(href);
    if (!prid) return;
    const title = decode($(a).attr("title") || $(a).text());
    if (title.length < 12) return;
    const ministry = decode($(a).closest("ul").prevAll("h3").first().text() || $(a).closest("li").find("h3").first().text());
    push(prid, title, ministry, parsePostedDate($(a).parent().find(".publishdatesmall").text()) ?? fallbackDate);
  });
  return items;
}
function spanOf($cell: cheerio.Cheerio<Element>, attr: "colspan" | "rowspan"): number {
  const n = Number.parseInt(String($cell.attr(attr) || "1"), 10);
  return !Number.isFinite(n) || n < 1 ? 1 : Math.min(n, 24);
}
function extractTable($: cheerio.CheerioAPI, $table: cheerio.Cheerio<Element>): { caption: string; rows: string[][]; notes: string[] } | null {
  if ($table.closest("#PdfDiv").length || $table.find("table").length) return null;
  const grid: string[][] = [];
  const occupied: boolean[][] = [];
  const ensure = (r: number, c: number) => {
    while (grid.length <= r) { grid.push([]); occupied.push([]); }
    while (grid[r].length <= c) { grid[r].push(""); occupied[r].push(false); }
  };
  $table.find("> thead > tr, > tbody > tr, > tfoot > tr, > tr").toArray().forEach((node, r) => {
    if (node.type !== "tag") return;
    let c = 0;
    $(node).children("th, td").each((_, cell) => {
      const $cell = $(cell) as cheerio.Cheerio<Element>;
      while (occupied[r]?.[c]) c += 1;
      const clone = $cell.clone();
      clone.find("table, img, script, style").remove();
      const text = decode(clone.text());
      const cs = spanOf($cell, "colspan");
      const rs = spanOf($cell, "rowspan");
      for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) {
        ensure(r + i, c + j);
        occupied[r + i][c + j] = true;
        if (i === 0 && j === 0) grid[r + i][c + j] = text;
      }
      c += cs;
    });
  });
  const cols = Math.max(0, ...grid.map((row) => row.length));
  if (cols < 2) return null;
  const rows = grid.map((row) => { const next = row.slice(); while (next.length < cols) next.push(""); return next; }).filter((row) => row.some((cell) => cell));
  const captionParts: string[] = [];
  while (rows.length > 2 && rows[0].filter(Boolean).length === 1) { captionParts.push(rows[0].find(Boolean) as string); rows.shift(); }
  const notes: string[] = [];
  while (rows.length > 2 && rows[rows.length - 1].filter(Boolean).length === 1) {
    const note = rows[rows.length - 1].find(Boolean) as string;
    if (note.length < 40) break;
    notes.unshift(note);
    rows.pop();
  }
  const cellCount = rows.reduce((n, row) => n + row.filter(Boolean).length, 0);
  if (rows.length < 2 || cols < 2 || cellCount < 4) return null;
  if (rows.length >= 2) {
    const sub = rows[1];
    const leadingEmpty = sub.findIndex((cell) => Boolean(cell));
    const subFilled = sub.filter(Boolean).length;
    if (leadingEmpty >= 2 && subFilled > 0 && subFilled < sub.length) {
      rows[0] = rows[0].map((cell, i) => [cell, sub[i]].filter(Boolean).join(" "));
      rows.splice(1, 1);
    }
  }
  return { caption: captionParts.join(" — "), rows, notes };
}
function collectBlocks($: cheerio.CheerioAPI, source: cheerio.Cheerio<AnyNode>): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  const seen = new Set<string>();
  let imageCount = 0;
  const addP = (text: string) => {
    const t = decode(text);
    if (!t || JUNK_PARA.test(t) || t.length < 3) return;
    const key = `p:${t}`;
    if (seen.has(key)) return;
    seen.add(key);
    blocks.push({ type: "p", text: t });
  };
  const addImg = ($img: cheerio.Cheerio<Element>) => {
    if (imageCount >= MAX_IMAGES) return;
    const src = absUrl($img.attr("src") || $img.attr("data-src") || "");
    const altRaw = decode($img.attr("alt") || "");
    if (!src || isChromeImg(src, altRaw)) return;
    const key = `img:${src}`;
    if (seen.has(key)) return;
    seen.add(key);
    let alt = altRaw;
    if (!alt) {
      const prev = [...blocks].reverse().find((b) => b.type === "p");
      if (prev && prev.type === "p" && prev.text.length < 220) alt = prev.text;
    }
    imageCount += 1;
    blocks.push({ type: "image", src, alt });
  };
  const addTable = ($table: cheerio.Cheerio<Element>) => {
    const extracted = extractTable($, $table);
    if (!extracted) return;
    const key = `tbl:${extracted.rows.slice(0, 4).map((r) => r.join("|")).join(";")}`;
    if (seen.has(key)) return;
    seen.add(key);
    blocks.push({ type: "table", rows: extracted.rows, caption: extracted.caption || undefined });
    for (const note of extracted.notes) addP(note);
  };
  source.find("table, p, li, h3, h4, img, figure").each((_, node) => {
    if (node.type !== "tag") return;
    const el = node as Element;
    const tag = (el.tagName || "").toLowerCase();
    const $el = $(el);
    if ($el.closest("#PdfDiv, .ReleaseLang, .RelLink, .RelTag").length) return;
    if (tag === "table") { addTable($el as cheerio.Cheerio<Element>); return; }
    if (tag === "img") { addImg($el as cheerio.Cheerio<Element>); return; }
    if ($el.closest("table").length) return;
    $el.find("img").each((__, img) => addImg($(img) as cheerio.Cheerio<Element>));
    const clone = $el.clone();
    clone.find("img, table, script, style").remove();
    addP(clone.text());
  });
  return blocks;
}
export function parseArticle(html: string, prid: string, lang: 1 | 2): ReleaseArticle {
  const $ = cheerio.load(html);
  const ministry = decode($("#MinistryName").text()) || "Press Information Bureau";
  const title = decode($("#Titleh2").text()) || decode($("h2").first().text());
  const subtitle = decode($("#ltrSubtitle").text());
  const rawPosted = decode($("#PrDateTime").text());
  const dateBit = rawPosted.match(/(\d{1,2}\s+[A-Za-z]{3,9}\s+20\d{2}.*)$/);
  const postedOn = dateBit ? `Posted On: ${dateBit[1]}` : rawPosted;
  const postedDate = parsePostedDate(postedOn) ?? "";
  const root = $(".innner-page-main-about-us-content-right-part");
  root.find("script, style, iframe, .twitter-tweet, #lg_g, .ReleaseLang, .RelTag, .RelLink, #lblViews, #reel_pic, #PdfDiv, noscript").remove();
  const source = root.length ? root : $("body");
  const blocks = collectBlocks($, source);
  const paragraphs = blocks.filter((b): b is Extract<ArticleBlock, { type: "p" }> => b.type === "p").map((b) => b.text);
  const officeMatch = postedOn.match(/by\s+(.+)$/i);
  return {
    prid, title: title || `Press release ${prid}`, ministry, postedDate, url: releaseUrl(prid, lang),
    subtitle, postedOn, paragraphs, blocks, office: officeMatch ? officeMatch[1].trim() : "",
  };
}
