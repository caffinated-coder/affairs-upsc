import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import type { ArticleBlock, ReleaseArticle, ReleaseSummary } from "../pib/types";

const AIR = "https://newsonair.gov.in";
const MAX_IMAGES = 12;
const CHROME_IMG = /facebook|twitter|whatsapp|logo|favicon|sprite|placeholder|gravatar/i;

export const AIR_CATEGORIES: Record<number, string> = {
  41706: "National", 33: "International", 37: "Regional News", 11: "Sports",
  39: "Business", 388: "Elections", 382: "Miscellaneous", 1: "DD News",
  43: "Health", 12: "Science", 384: "Entertainment", 386: "Mann Ki Baat",
};

export function decodeHtml(html: string): string {
  const $ = cheerio.load(`<div>${html}</div>`);
  return $("div").first().text().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function airAbsUrl(src: string): string {
  const raw = src.trim();
  if (!raw) return "";
  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/")) return `${AIR}${raw}`;
  return `${AIR}/${raw.replace(/^\.\//, "")}`;
}

function deskFor(ids: number[] | undefined): string {
  if (!ids?.length) return "News on Air";
  for (const id of ids) if (AIR_CATEGORIES[id]) return AIR_CATEGORIES[id];
  return "News on Air";
}

export type WpPost = {
  id: number; date?: string; link?: string;
  title?: { rendered?: string }; content?: { rendered?: string }; categories?: number[];
};

export function summaryFromPost(post: WpPost): ReleaseSummary | null {
  const id = String(post.id ?? "");
  if (!/^\d+$/.test(id)) return null;
  const title = decodeHtml(post.title?.rendered || "");
  if (title.length < 8) return null;
  const postedDate = (post.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(postedDate)) return null;
  return {
    prid: id, title, ministry: deskFor(post.categories), postedDate,
    url: post.link || `${AIR}/?p=${id}`, source: "air",
    tags: (post.categories ?? []).map((c) => AIR_CATEGORIES[c]).filter(Boolean),
  };
}

function extractTable(el: Element, $: cheerio.CheerioAPI): string[][] {
  const rows: string[][] = [];
  $(el).find("tr").each((_, tr) => {
    const cells = $(tr).find("th, td").toArray().map((cell) => decodeHtml($(cell).html() || $(cell).text()));
    if (cells.some(Boolean)) rows.push(cells);
  });
  return rows;
}

function walkBlocks(root: cheerio.Cheerio<AnyNode>, $: cheerio.CheerioAPI): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  let images = 0;
  const visit = (node: AnyNode) => {
    if (node.type !== "tag") return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === "script" || tag === "style" || tag === "noscript" || tag === "form") return;
    if (tag === "table") { const rows = extractTable(el, $); if (rows.length) blocks.push({ type: "table", rows }); return; }
    if (tag === "img") {
      const src = airAbsUrl($(el).attr("src") || $(el).attr("data-src") || "");
      const alt = decodeHtml($(el).attr("alt") || "");
      if (src && !CHROME_IMG.test(`${src} ${alt}`) && images < MAX_IMAGES) { blocks.push({ type: "image", src, alt }); images += 1; }
      return;
    }
    if (tag === "p" || tag === "h2" || tag === "h3" || tag === "li" || tag === "blockquote") {
      const text = decodeHtml($(el).html() || $(el).text());
      if (text) blocks.push({ type: "p", text });
      $(el).find("img").each((_, img) => visit(img));
      return;
    }
    if (tag === "div" || tag === "span" || tag === "section") {
      const kids = $(el).children();
      if (kids.length === 0) { const text = decodeHtml($(el).html() || $(el).text()); if (text) blocks.push({ type: "p", text }); return; }
      kids.each((_, child) => visit(child));
      return;
    }
    $(el).contents().each((_, child) => visit(child));
  };
  root.contents().each((_, child) => visit(child));
  return blocks;
}

export function parseAirArticle(post: WpPost): ReleaseArticle {
  const summary = summaryFromPost(post);
  if (!summary) throw new Error("AIR article was empty.");
  const $ = cheerio.load(`<div id="air-root">${post.content?.rendered || ""}</div>`);
  $("script, style, noscript, .sharedaddy, .jp-relatedposts").remove();
  const blocks = walkBlocks($("#air-root"), $);
  const paragraphs = blocks.filter((b): b is Extract<ArticleBlock, { type: "p" }> => b.type === "p").map((b) => b.text);
  const postedOn = post.date ? post.date.replace("T", " ").slice(0, 16) : summary.postedDate;
  return { ...summary, subtitle: postedOn, postedOn, paragraphs, blocks: blocks.length ? blocks : paragraphs.map((text) => ({ type: "p" as const, text })), office: "News on Air · Akashvani" };
}
