import type { DigestSource } from "@/lib/pib/types";

export type LibraryItem = {
  prid: string; title: string; ministry: string; postedDate: string; url: string; source: DigestSource; at: number;
};

const SAVED = "affairs.saved";
const HISTORY = "affairs.history";

function read(key: string): LibraryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LibraryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function write(key: string, items: LibraryItem[]) {
  try { window.localStorage.setItem(key, JSON.stringify(items)); } catch {}
}
export function readSaved(): LibraryItem[] { return read(SAVED); }
export function isSaved(prid: string): boolean { return read(SAVED).some((x) => x.prid === prid); }
export function toggleSaved(item: LibraryItem): boolean {
  const cur = read(SAVED);
  const exists = cur.some((x) => x.prid === item.prid);
  write(SAVED, exists ? cur.filter((x) => x.prid !== item.prid) : [{ ...item, at: Date.now() }, ...cur].slice(0, 200));
  return !exists;
}
export function readHistory(): LibraryItem[] { return read(HISTORY); }
export function pushHistory(item: LibraryItem) {
  write(HISTORY, [{ ...item, at: Date.now() }, ...read(HISTORY).filter((x) => x.prid !== item.prid)].slice(0, 80));
}
export function clearLibrary() { write(SAVED, []); write(HISTORY, []); }
