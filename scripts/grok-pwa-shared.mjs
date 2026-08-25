import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function isDocumentPath(path) {
  return path === "/" || path === "/index.html" || !path.includes(".");
}
export function isInstallQuery(url) {
  return /[?&]install=1(?:&|$)/.test(url);
}
export function acceptsHtml(accept) {
  return !accept || String(accept).includes("text/html") || String(accept).includes("*/*");
}
export function snapshotOgIdentity(cwd = process.cwd()) {
  try {
    const site = JSON.parse(readFileSync(join(cwd, "src/lib/og/site.json"), "utf8"));
    return { site };
  } catch {
    return { site: { title: "Affairs \u00d7 UPSC", card: "custom", color: "1E4D45" } };
  }
}
export function renderWebManifest(host) {
  const title = snapshotOgIdentity().site.title || "Affairs x UPSC";
  return JSON.stringify({
    name: title, short_name: title, start_url: "/", display: "standalone",
    background_color: "#efe8dc", theme_color: "#1e4d45",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
  });
}
export function renderInstallPageHtml(template, { host, url }) {
  return String(template).replaceAll("{{HOST}}", host || "").replaceAll("{{URL}}", url || "/");
}
export function injectGrokPwaHead(html, { host, cwd, site } = {}) {
  if (!html.includes("</head>")) return html;
  const tags = [
    `<link rel="manifest" href="/__grok/manifest.webmanifest">`,
    `<meta name="theme-color" content="#1e4d45">`,
  ].join("");
  return html.replace("</head>", `${tags}</head>`);
}
export function createHeadInjector({ host, cwd, site } = {}) {
  let buf = Buffer.alloc(0);
  let done = false;
  return {
    push(chunk) {
      if (done) return [chunk];
      buf = Buffer.concat([buf, chunk]);
      const html = buf.toString("utf8");
      const i = html.toLowerCase().indexOf("</head>");
      if (i < 0) return [];
      done = true;
      const injected = injectGrokPwaHead(html, { host, cwd, site });
      return [Buffer.from(injected, "utf8")];
    },
    flush() {
      if (done || buf.length === 0) return [];
      done = true;
      return [buf];
    },
  };
}
function publicAppHost(_host) { return ""; }
