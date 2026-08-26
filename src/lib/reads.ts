import { shiftIsoDate, startOfIsoWeek, todayIst } from "./dates";
import type { DigestSource } from "./types";

const KEY = "affairs.reads.v1";
type Store = { reads: Record<string, string>; totals: Record<string, number> };
function empty(): Store { return { reads: {}, totals: {} }; }
function load(): Store {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || typeof parsed !== "object") return empty();
    return { reads: parsed.reads && typeof parsed.reads === "object" ? parsed.reads : {}, totals: parsed.totals && typeof parsed.totals === "object" ? parsed.totals : {} };
  } catch { return empty(); }
}
function save(store: Store) { try { window.localStorage.setItem(KEY, JSON.stringify(store)); } catch {} }
function idKey(source: DigestSource, prid: string) { return `${source}:${prid}`; }
function dayKey(source: DigestSource, iso: string) { return `${source}:${iso}`; }

export function isRead(source: DigestSource, prid: string): boolean {
  return Boolean(load().reads[idKey(source, prid)]);
}
export function markRead(source: DigestSource, prid: string, iso: string) {
  const store = load(); store.reads[idKey(source, prid)] = iso; save(store);
}
export function toggleRead(source: DigestSource, prid: string, iso: string): boolean {
  const store = load(); const key = idKey(source, prid);
  if (store.reads[key]) { delete store.reads[key]; save(store); return false; }
  store.reads[key] = iso; save(store); return true;
}
export function recordDayTotals(source: DigestSource, counts: Record<string, number>) {
  const store = load(); let changed = false;
  for (const [iso, n] of Object.entries(counts)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || n <= 0) continue;
    const key = dayKey(source, iso);
    if ((store.totals[key] ?? 0) < n) { store.totals[key] = n; changed = true; }
  }
  if (changed) save(store);
}
export function dayStats(source: DigestSource, iso: string): { read: number; total: number } {
  const store = load(); const prefix = `${source}:`; let read = 0;
  for (const [id, day] of Object.entries(store.reads)) if (day === iso && id.startsWith(prefix)) read += 1;
  return { read, total: store.totals[dayKey(source, iso)] ?? 0 };
}
export type HeatCell = { iso: string; read: number; total: number; level: 0 | 1 | 2 | 3 | 4 };
export function heatLevel(read: number, total: number): 0 | 1 | 2 | 3 | 4 {
  if (total <= 0 || read <= 0) return 0;
  const r = read / total;
  if (r >= 1) return 4; if (r >= 0.75) return 3; if (r >= 0.4) return 2; return 1;
}
export function heatmapGrid(source: DigestSource, weeks = 18, today = todayIst()): HeatCell[][] {
  const endMonday = startOfIsoWeek(today);
  const start = shiftIsoDate(endMonday, -7 * (weeks - 1));
  const store = load(); const prefix = `${source}:`; const readByDay: Record<string, number> = {};
  for (const [id, day] of Object.entries(store.reads)) { if (!id.startsWith(prefix)) continue; readByDay[day] = (readByDay[day] ?? 0) + 1; }
  const rows: HeatCell[][] = [[], [], [], [], [], [], []];
  for (let i = 0; i < weeks * 7; i++) {
    const iso = shiftIsoDate(start, i);
    if (iso > today) { rows[i % 7].push({ iso, read: 0, total: 0, level: 0 }); continue; }
    const read = readByDay[iso] ?? 0;
    const total = store.totals[dayKey(source, iso)] ?? 0;
    rows[i % 7].push({ iso, read, total, level: heatLevel(read, total) });
  }
  return rows;
}
