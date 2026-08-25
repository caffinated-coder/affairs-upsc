import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  acceptsHtml, createHeadInjector, injectGrokPwaHead, isDocumentPath,
  isInstallQuery, renderInstallPageHtml, renderWebManifest, snapshotOgIdentity,
} from "./grok-pwa-shared.mjs";

export const GROK_OG_IDENTITY_ID = "virtual:grok-og-identity";
const INSTALL_PAGE_PATH = join(dirname(fileURLToPath(import.meta.url)), "install-page.html");

function requestHost(req) {
  const forwarded = req.headers["x-forwarded-host"];
  const host = forwarded ?? req.headers.host ?? req.headers[":authority"];
  return Array.isArray(host) ? host[0] : host;
}
export function renderInstallPage(hostHeader, url = "/") {
  return renderInstallPageHtml(readFileSync(INSTALL_PAGE_PATH, "utf8"), { host: hostHeader, url });
}
function sendHtml(res, html) {
  const body = Buffer.from(html, "utf8");
  res.statusCode = 200;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", "no-cache");
  res.setHeader("content-length", String(body.byteLength));
  res.end(body);
}
function serveGrokPwa(middlewares) {
  middlewares.use((req, res, next) => {
    const rawUrl = req.url ?? "";
    const pathOnly = rawUrl.split("?", 1)[0] ?? "";
    if ((req.method ?? "GET").toUpperCase() !== "GET") { next(); return; }
    if (pathOnly === "/__grok/manifest.webmanifest" || pathOnly === "/__grok/manifest.json") {
      const body = Buffer.from(renderWebManifest(requestHost(req)), "utf8");
      res.statusCode = 200;
      res.setHeader("content-type", "application/manifest+json; charset=utf-8");
      res.setHeader("cache-control", "no-cache");
      res.setHeader("content-length", String(body.byteLength));
      res.end(body);
      return;
    }
    if (isInstallQuery(rawUrl) && isDocumentPath(pathOnly) && acceptsHtml(req.headers.accept)) {
      try { sendHtml(res, renderInstallPage(requestHost(req), rawUrl)); }
      catch (err) { console.error("[app-builder] install page missing:", err); res.statusCode = 500; res.end("install page unavailable"); }
      return;
    }
    next();
  });
}
export function grokPwaPlugin() {
  let root = process.cwd();
  return {
    name: "app-builder:grok-pwa",
    configResolved(config) { root = config.root; },
    resolveId(id) { if (id === GROK_OG_IDENTITY_ID) return `\0${GROK_OG_IDENTITY_ID}`; },
    load(id) {
      if (id !== `\0${GROK_OG_IDENTITY_ID}`) return;
      return `export const grokOgIdentity = ${JSON.stringify(snapshotOgIdentity(root))};`;
    },
    transformIndexHtml(html) {
      return injectGrokPwaHead(html, { host: process.env.VITE_PUBLIC_HOSTNAME ?? "", cwd: root });
    },
    configureServer(server) { serveGrokPwa(server.middlewares); },
    configurePreviewServer(server) { serveGrokPwa(server.middlewares); },
  };
}
