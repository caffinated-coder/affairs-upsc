import { jsPDF } from "jspdf";
import { formatDisplayDate, formatShortDate, todayIst } from "./pib/dates";
import { blocksOf, type ArticleBlock, type ReleaseArticle } from "./pib/types";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;
const INK: [number, number, number] = [28, 25, 20];
const TEAL: [number, number, number] = [30, 77, 69];
const PAPER: [number, number, number] = [250, 246, 238];
const RULE: [number, number, number] = [196, 185, 168];
const MUTED: [number, number, number] = [111, 103, 92];
const STRIPE: [number, number, number] = [244, 239, 230];

export type PdfBrand = { kicker: string; title: string; prefix: string; footer: string; disclaimer: string };
export const PIB_BRAND: PdfBrand = { kicker: "PRESS INFORMATION BUREAU  \u00b7  GOVERNMENT OF INDIA", title: "PIB Digest", prefix: "pib", footer: "PIB Digest  \u00b7  Source: pib.gov.in", disclaimer: "Unofficial reading copy from official PIB pages." };
export const MEA_BRAND: PdfBrand = { kicker: "MINISTRY OF EXTERNAL AFFAIRS  \u00b7  GOVERNMENT OF INDIA", title: "MEA Press", prefix: "mea", footer: "MEA Press  \u00b7  Source: mea.gov.in", disclaimer: "Unofficial reading copy from official MEA pages." };
export const BILATERAL_BRAND: PdfBrand = { kicker: "MINISTRY OF EXTERNAL AFFAIRS  \u00b7  GOVERNMENT OF INDIA", title: "Bilateral Documents", prefix: "mea-bilateral", footer: "MEA Bilaterals  \u00b7  Source: mea.gov.in", disclaimer: "Unofficial reading copy from official MEA documents." };
export const AIR_BRAND: PdfBrand = { kicker: "NEWS ON AIR  \u00b7  AKASHVANI", title: "AIR Digest", prefix: "air", footer: "AIR Digest  \u00b7  Source: newsonair.gov.in", disclaimer: "Unofficial reading copy from News on Air." };

type Doc = jsPDF & { __y: number; __brand: PdfBrand };
function makeDoc(brand: PdfBrand): Doc {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true }) as Doc;
  doc.setProperties({ title: brand.title, author: brand.title });
  doc.__y = MARGIN;
  doc.__brand = brand;
  return doc;
}
function paintPage(doc: Doc) {
  doc.setFillColor(...PAPER); doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  doc.setDrawColor(...TEAL); doc.setLineWidth(0.4); doc.line(MARGIN, 10, PAGE_W - MARGIN, 10);
}
function addFooter(doc: Doc) {
  doc.setFont("times", "italic"); doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text(doc.__brand.footer, MARGIN, PAGE_H - 10);
  doc.text(String(doc.getCurrentPageInfo().pageNumber), PAGE_W - MARGIN, PAGE_H - 10, { align: "right" });
}
function ensureSpace(doc: Doc, needed: number) {
  if (doc.__y + needed <= PAGE_H - 16) return;
  addFooter(doc); doc.addPage(); paintPage(doc); doc.__y = MARGIN + 10;
}
function clean(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/[^\t\n\r\x20-\x7E\xA0-\xFF]/g, " ").replace(/[ ]{2,}/g, " ").trim();
}
function writeWrapped(doc: Doc, text: string, font: string, style: string, size: number, color: [number, number, number], leading: number) {
  const s = clean(text);
  if (!s) return;
  doc.setFont(font, style); doc.setFontSize(size); doc.setTextColor(...color);
  for (const line of doc.splitTextToSize(s, CONTENT_W) as string[]) {
    ensureSpace(doc, leading); doc.text(line, MARGIN, doc.__y); doc.__y += leading;
  }
}
async function addImageBlock(doc: Doc, block: Extract<ArticleBlock, { type: "image" }>) {
  if (!block.dataUrl) return;
  try {
    const props = doc.getImageProperties(block.dataUrl);
    let w = CONTENT_W; let h = (props.height / props.width) * w;
    if (h > 118) { h = 118; w = (props.width / props.height) * h; }
    ensureSpace(doc, h + 8);
    doc.addImage(block.dataUrl, (props.fileType || "JPEG").toUpperCase(), MARGIN + (CONTENT_W - w) / 2, doc.__y, w, h, undefined, "FAST");
    doc.__y += h + 2;
    if (block.alt) writeWrapped(doc, block.alt, "helvetica", "italic", 8, MUTED, 4);
    doc.__y += 3;
  } catch {}
}
function addTableBlock(doc: Doc, rows: string[][], caption?: string) {
  if (!rows.length) return;
  if (caption) { writeWrapped(doc, caption, "helvetica", "italic", 8, MUTED, 4); doc.__y += 1.5; }
  const cols = Math.max(...rows.map((r) => r.length), 1);
  const colW = CONTENT_W / cols;
  const fontSize = cols > 6 ? 6 : cols > 4 ? 7 : 8;
  const lineH = fontSize * 0.42;
  for (let r = 0; r < rows.length; r++) {
    const wrapped = Array.from({ length: cols }, (_, c) => {
      doc.setFont("helvetica", r === 0 ? "bold" : "normal"); doc.setFontSize(fontSize);
      return doc.splitTextToSize(clean(rows[r][c] || ""), Math.max(6, colW - 2)) as string[];
    });
    const h = Math.max(6, Math.max(...wrapped.map((w) => w.length)) * lineH + 2.2);
    ensureSpace(doc, h);
    if (r === 0) { doc.setFillColor(...TEAL); doc.rect(MARGIN, doc.__y, CONTENT_W, h, "F"); }
    else if (r % 2 === 1) { doc.setFillColor(...STRIPE); doc.rect(MARGIN, doc.__y, CONTENT_W, h, "F"); }
    doc.setDrawColor(...RULE);
    for (let c = 0; c < cols; c++) {
      const x = MARGIN + c * colW;
      doc.rect(x, doc.__y, colW, h, "S");
      doc.setTextColor(...(r === 0 ? ([250, 246, 238] as [number, number, number]) : INK));
      doc.setFont("helvetica", r === 0 ? "bold" : "normal"); doc.setFontSize(fontSize);
      wrapped[c].forEach((line, i) => doc.text(line, x + 1.1, doc.__y + 2.5 + i * lineH));
    }
    doc.__y += h;
  }
  doc.__y += 4;
}
async function writeFullArticle(doc: Doc, article: ReleaseArticle) {
  writeWrapped(doc, article.ministry.toUpperCase(), "helvetica", "bold", 8, TEAL, 5);
  doc.__y += 2;
  writeWrapped(doc, article.title, "times", "bold", 16, INK, 7.2);
  doc.__y += 2;
  writeWrapped(doc, [article.postedOn, `Release ID ${article.prid}`].filter(Boolean).join("  \u00b7  "), "helvetica", "normal", 8, MUTED, 4.5);
  doc.__y += 4;
  for (const block of blocksOf(article)) {
    if (block.type === "p") { writeWrapped(doc, block.text, "times", "normal", 11, INK, 5.6); doc.__y += 2.4; }
    else if (block.type === "image") await addImageBlock(doc, block);
    else if (block.type === "table") addTableBlock(doc, block.rows, block.caption);
  }
  writeWrapped(doc, `Source  ${article.url}`, "helvetica", "italic", 8, MUTED, 4.2);
  addFooter(doc);
}
export async function downloadDigestPdf(articles: ReleaseArticle[], from: string, to: string, brand: PdfBrand = PIB_BRAND): Promise<string> {
  if (!articles.length) throw new Error("No articles to export.");
  const doc = makeDoc(brand);
  if (articles.length === 1) { paintPage(doc); doc.__y = MARGIN + 6; await writeFullArticle(doc, articles[0]); }
  else {
    paintPage(doc);
    doc.setFillColor(...TEAL); doc.rect(0, 0, PAGE_W, 52, "F");
    doc.setTextColor(250, 246, 238); doc.setFont("times", "bold"); doc.setFontSize(28);
    doc.text(brand.title, PAGE_W / 2, 36, { align: "center" });
    doc.__y = 68;
    const rangeLabel = from === to ? formatDisplayDate(from) : `${formatShortDate(from)} \u2013 ${formatShortDate(to)}`;
    writeWrapped(doc, `${articles.length} documents \u00b7 ${rangeLabel} \u00b7 compiled ${formatShortDate(todayIst())}. ${brand.disclaimer}`, "times", "italic", 10, MUTED, 5);
    addFooter(doc);
    for (const article of articles) { doc.addPage(); paintPage(doc); doc.__y = MARGIN + 6; await writeFullArticle(doc, article); }
  }
  const name = from === to ? `${brand.prefix}-${from}.pdf` : `${brand.prefix}-${from}-to-${to}.pdf`;
  doc.save(articles.length === 1 ? `${brand.prefix}-${articles[0].prid}.pdf` : name);
  return name;
}
