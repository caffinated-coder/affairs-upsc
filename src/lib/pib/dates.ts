const IST = "Asia/Kolkata";
export const MIN_DATE = "2003-01-01";
export const MAX_CUSTOM_DAYS = 31;
export type VolumeGrain = "day" | "week" | "month";
const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
export function todayIst(): string { return new Date().toLocaleDateString("en-CA", { timeZone: IST }); }
export function clampIsoDate(iso: string, min = MIN_DATE, max = todayIst()): string {
  if (iso < min) return min; if (iso > max) return max; return iso;
}
export function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
export function shiftMonth(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(d, last));
  return dt.toISOString().slice(0, 10);
}
export function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
export function formatChipDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const date = dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  const weekday = dt.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  return `${date}  |  ${weekday}`;
}
export function storyClock(postedDate: string): string {
  const t = postedDate.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
  if (t) return t[1].replace(/\s+/g, " ").toUpperCase();
  return postedDate.replace(/\s+/g, " ").slice(0, 12);
}
export function parsePostedDate(raw: string): string | null {
  const text = raw.replace(/\s+/g, " ").trim();
  const match = text.match(/(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?),?\s+(20\d{2})/i);
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}
export function eachMonthInRange(from: string, to: string): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const [ey, em] = to.slice(0, 7).split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) { months.push({ year: y, month: m }); m += 1; if (m > 12) { m = 1; y += 1; } }
  return months;
}
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
export function clampRange(from: string, to: string, maxDays = MAX_CUSTOM_DAYS): { from: string; to: string } {
  const today = todayIst();
  let start = clampIsoDate(from, MIN_DATE, today);
  let end = clampIsoDate(to, MIN_DATE, today);
  if (end < start) [start, end] = [end, start];
  if (daysBetween(start, end) > maxDays) return { from: shiftIsoDate(end, -maxDays), to: end };
  return { from: start, to: end };
}
export function monthRange(year: number, month: number, today = todayIst()): { from: string; to: string } {
  const mm = String(month).padStart(2, "0");
  const from = `${year}-${mm}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let to = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
  if (from > today) return { from: today, to: today };
  if (from < MIN_DATE) return monthRange(2017, 1, today);
  if (to > today) to = today;
  return { from: clampIsoDate(from), to: clampIsoDate(to, MIN_DATE, today) };
}
export function formatMonthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}
export function startOfIsoWeek(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return shiftIsoDate(iso, dow === 0 ? -6 : 1 - dow);
}
export function volumeWindow(grain: VolumeGrain, anchor: string, today = todayIst()): { from: string; to: string } {
  const end = clampIsoDate(anchor, MIN_DATE, today);
  if (grain === "day") return monthRange(Number(end.slice(0, 4)), Number(end.slice(5, 7)), today);
  if (grain === "week") return { from: clampIsoDate(shiftIsoDate(startOfIsoWeek(end), -7 * 11)), to: end };
  return { from: clampIsoDate(shiftMonth(`${end.slice(0, 7)}-01`, -11)), to: end };
}
export function bucketKey(grain: VolumeGrain, iso: string): string {
  if (grain === "day") return iso;
  if (grain === "week") return startOfIsoWeek(iso);
  return `${iso.slice(0, 7)}-01`;
}
export function seriesKeys(grain: VolumeGrain, from: string, to: string): string[] {
  if (grain === "day") {
    const keys: string[] = [];
    for (let cur = from; cur <= to; cur = shiftIsoDate(cur, 1)) keys.push(cur);
    return keys;
  }
  if (grain === "week") {
    const keys: string[] = [];
    let cur = startOfIsoWeek(from);
    const last = startOfIsoWeek(to);
    while (cur <= last) { keys.push(cur); cur = shiftIsoDate(cur, 7); }
    return keys;
  }
  return eachMonthInRange(from, to).map(({ year, month }) => `${year}-${String(month).padStart(2, "0")}-01`);
}
export function formatSeriesLabel(grain: VolumeGrain, key: string, lang: 1 | 2 = 1): string {
  const locale = lang === 2 ? "hi-IN" : "en-IN";
  if (grain === "day") return String(Number(key.slice(8, 10)));
  if (grain === "week") {
    const end = shiftIsoDate(key, 6);
    const a = new Date(`${key}T00:00:00Z`);
    const b = new Date(`${end}T00:00:00Z`);
    const mon = a.toLocaleDateString(locale, { month: "short", timeZone: "UTC" });
    const mon2 = b.toLocaleDateString(locale, { month: "short", timeZone: "UTC" });
    return a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()}\u2013${b.getUTCDate()} ${mon}` : `${a.getUTCDate()} ${mon}\u2013${b.getUTCDate()} ${mon2}`;
  }
  return new Date(`${key}T00:00:00Z`).toLocaleDateString(locale, { month: "short", year: "2-digit", timeZone: "UTC" });
}
