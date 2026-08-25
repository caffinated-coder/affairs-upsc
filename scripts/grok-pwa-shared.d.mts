export function isDocumentPath(path: string): boolean;
export function isInstallQuery(url: string): boolean;
export function acceptsHtml(accept: string | null | undefined): boolean;
export function snapshotOgIdentity(cwd?: string): { site: Record<string, string | undefined> };
export function renderWebManifest(host: string | undefined): string;
export function renderInstallPageHtml(template: string, opts: { host?: string; url?: string }): string;
export function injectGrokPwaHead(html: string, opts?: { host?: string; cwd?: string; site?: unknown }): string;
export function createHeadInjector(opts?: { host?: string; cwd?: string; site?: unknown }): {
  push: (chunk: Uint8Array) => Uint8Array[];
  flush: () => Uint8Array[];
};
