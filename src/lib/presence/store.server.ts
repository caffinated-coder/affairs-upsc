import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TTL_MS = 45_000;
const FILE = join(tmpdir(), "affairs-presence.json");

type Book = Record<string, number>;
const globalRef = globalThis as typeof globalThis & { __affairsPresence__?: Book };

function load(): Book {
  if (!globalRef.__affairsPresence__) {
    try {
      const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Book;
      globalRef.__affairsPresence__ = parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      globalRef.__affairsPresence__ = {};
    }
  }
  return globalRef.__affairsPresence__;
}

function prune(book: Book) {
  const cutoff = Date.now() - TTL_MS;
  for (const id of Object.keys(book)) if (book[id] < cutoff) delete book[id];
}

function persist(book: Book) {
  try { writeFileSync(FILE, JSON.stringify(book)); } catch {}
}

export function heartbeat(visitorId: string, leave = false): number {
  const book = load();
  prune(book);
  if (leave) delete book[visitorId];
  else book[visitorId] = Date.now();
  persist(book);
  return Object.keys(book).length;
}
