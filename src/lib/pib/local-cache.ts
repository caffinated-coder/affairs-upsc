const PREFIX = "pib:";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Envelope<T> = { at: number; data: T };

export function readLocalQuery<T>(key: string, maxAge = MAX_AGE_MS): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed || typeof parsed.at !== "number") return undefined;
    if (Date.now() - parsed.at > maxAge) return undefined;
    return parsed.data;
  } catch {
    return undefined;
  }
}

export function writeLocalQuery(key: string, data: unknown) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({ at: Date.now(), data } satisfies Envelope<unknown>);
  try {
    window.localStorage.setItem(PREFIX + key, payload);
  } catch {
    try {
      for (const name of Object.keys(window.localStorage)) {
        if (name.startsWith(PREFIX)) window.localStorage.removeItem(name);
      }
      window.localStorage.setItem(PREFIX + key, payload);
    } catch {}
  }
}
