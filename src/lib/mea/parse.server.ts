import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { parsePostedDate } from "../pib/dates";
import type { ArticleBlock, DigestSource, ReleaseArticle, ReleaseSummary } from "../pib/types";

const MEA = "https://www.mea.gov.in";
const MAX_IMAGES = 12;
const CHROME_IMG =
  /facebook|twitter|whatsapp|linkedin|email|emblem|favicon|logo|bhashini|search\.svg|language\.svg|g20/i;

function decode(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function meaAbsUrl(src: string): string {
  const raw = src.trim();
  if (!raw) return "";
  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/")) return `${MEA}${raw}`;
  return `${MEA}/${raw.replace(/^\.\//, "")}`;
}

export function meaArticleUrl(source: DigestSource, pkid: string, slug?: string): string {
  const path = source === "bilateral" ? "bilateral-documents" : "press-releases";
  const tail = slug ? `/${slug}` : "";
  return `${MEA}/${path}?dtl/${pkid}${tail}`;
}

function pkidFromHref(href: string): { pkid: string; slug: string; kind: DigestSource } | null {
  const match = href.match(/(press-releases|bilateral-documents)(?:\.htm)?\?dtl\/(\d+)(?:\/([^?#]*))?/i);
  if (!match) return null;
  const kind: DigestSource = match[1].toLowerCase().includes("bilateral") ? "bilateral" : "mea";
  return { kind, pkid: match[2], slug: decodeURIComponent((match[3] || "").replace(/\/$/, "")) };
}

function dateNear($: cheerio.CheerioAPI, el: cheerio.Cheerio<Element>): string | null {
  const scopes = [
    $(el).closest("li, article, .col, .row, .pressList, .media-box, .releaseBox"),
    $(el).parent(),
    $(el).parent().parent(),
  ];
  for (const scope of scopes) {
    const labeled = decode(scope.find(".date, .pressDate, time, .pub-date").first().text());
    const parsed = labeled ? parsePostedDate(labeled) : null;
    if (parsed) return parsed;
    const fromText = parsePostedDate(decode(scope.text()).slice(0, 220));
    if (fromText) return fromText;
  }
  return null;
}

function tagsNear($: cheerio.CheerioAPI, el: cheerio.Cheerio<Element>): string[] {
  const scope = $(el).closest("li, article, .col, .row, .pressList, .media-box");
  const tags = new Set<string>();
  scope.find(".tag, .tags a, .chip, .badge, .country").each((_, node) => {
    const text = decode($(node).text());
    if (text && text.length < 48 && !/^\d/.test(text)) tags.add(text);
  });
  return [...tags];
}

export function parseMeaListing(html: string, source: DigestSource, fallbackDate: string): ReleaseSummary[] {
  const $ = cheerio.load(html);
  const items: ReleaseSummary[] = [];
  const seen = new Set<string>();
  $("a[href*='dtl/']").each((_, el) => {
    const href = $(el).attr("href") || "";
    const parsed = pkidFromHref(href);
    if (!parsed || source !== parsed.kind) return;
    const title = decode($(el).text());
    if (title.length < 8) return;
    if (/^(press releases|bilateral|read more|view all)$/i.test(title)) return;
    if (seen.has(parsed.pkid)) return;
    seen.add(parsed.pkid);
    const tags = tagsNear($, $(el) as cheerio.Cheerio<Element>);
    items.push({
      prid: parsed.pkid,
      title,
      ministry: tags[0] || (source === "bilateral" ? "Bilateral documents" : "Ministry of External Affairs"),
      postedDate: dateNear($, $(el) as cheerio.Cheerio<Element>) ?? fallbackDate,
      url: meaArticleUrl(source, parsed.pkid, parsed.slug),
      source,
      tags,
    });
  });
  return items;
}

function extractTable(el: Element, $: cheerio.CheerioAPI): string[][] {
  const rows: string[][] = [];
  $(el).find("tr").each((_, tr) => {
    const cells = $(tr).find("th, td").toArray().map((cell) => decode($(cell).text()));
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
    if (tag === "script" || tag === "style" || tag === "noscript") return;
    if (tag === "table") {
      const rows = extractTable(el, $);
      if (rows.length) blocks.push({ type: "table", rows });
      return;
    }
    if (tag === "img") {
      const src = meaAbsUrl($(el).attr("src") || $(el).attr("data-src") || "");
      const alt = decode($(el).attr("alt") || "");
      if (src && !CHROME_IMG.test(`${src} ${alt}`) && images < MAX_IMAGES) {
        blocks.push({ type: "image", src, alt });
        images += 1;
      }
      return;
    }
    if (tag === "p" || tag === "h3" || tag === "h4" || tag === "li") {
      const text = decode($(el).text());
      if (text) blocks.push({ type: "p", text });
      $(el).find("img").each((_, img) => visit(img));
      return;
    }
    $(el).contents().each((_, child) => visit(child));
  };
  root.contents().each((_, child) => visit(child));
  return blocks;
}

export function parseMeaArticle(html: string, pkid: string, source: DigestSource, lang: 1 | 2): ReleaseArticle {
  const $ = cheerio.load(html);
  $("script, style, noscript, .filterBar, .sideBar, header, footer, nav").remove();
  const title = decode($("h2.titleText, h1, h2").first().text()) || `MEA ${pkid}`;
  const dateText = decode($(".date, time, .pressDate").first().text());
  const postedDate = parsePostedDate(dateText) || "";
  const root = $(".publication-detail, .pressReleaseContent, .innerContent, #DivListing, article").first();
  const scope = root.length ? root : $("body");
  const blocks = walkBlocks(scope, $);
  const paragraphs = blocks.filter((b): b is Extract<ArticleBlock, { type: "p" }> => b.type === "p").map((b) => b.text);
  const tags = $("a.tag, .tags a, .chip").toArray().map((el) => decode($(el).text())).filter((t) => t && t.length < 48);
  return {
    prid: pkid,
    title,
    ministry: tags[0] || (source === "bilateral" ? "Bilateral documents" : "Ministry of External Affairs"),
    postedDate,
    url: meaArticleUrl(source, pkid),
    source,
    tags,
    subtitle: dateText,
    postedOn: dateText,
    paragraphs,
    blocks: blocks.length ? blocks : paragraphs.map((text) => ({ type: "p" as const, text })),
    office: source === "bilateral" ? "MEA · Bilateral documents" : "MEA · Press releases",
  };
}
