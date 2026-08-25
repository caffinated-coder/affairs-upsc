import { matchMinistryId } from "./ministries";
import type { DigestSource } from "./types";

export type TopicId = "all" | "economy" | "foreign" | "infra" | "health" | "environment" | "governance";

export const TOPICS: { id: TopicId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "economy", label: "Economy & Finance" },
  { id: "foreign", label: "Foreign Affairs" },
  { id: "infra", label: "Infrastructure" },
  { id: "health", label: "Health & Education" },
  { id: "environment", label: "Environment" },
  { id: "governance", label: "Governance" },
];

const TOPIC_IDS: Record<Exclude<TopicId, "all">, Set<number>> = {
  economy: new Set([15, 16, 66, 63, 51, 40, 39, 41, 1440, 48, 60, 18, 19, 71, 75]),
  foreign: new Set([4, 59]),
  infra: new Set([47, 26, 23, 69, 46, 70, 52, 1336, 73, 28, 42, 44, 53]),
  health: new Set([31, 8, 80, 64, 9]),
  environment: new Set([30, 67, 28]),
  governance: new Set([5, 7, 6, 3, 1, 2, 61, 68, 11, 12, 10, 49, 65, 2608, 2934]),
};

export function topicForRelease(ministry: string, source?: DigestSource): Exclude<TopicId, "all"> {
  if (source === "mea" || source === "bilateral") return "foreign";
  const id = matchMinistryId(ministry);
  if (id != null) {
    for (const [topic, ids] of Object.entries(TOPIC_IDS) as [Exclude<TopicId, "all">, Set<number>][]) {
      if (ids.has(id)) return topic;
    }
  }
  const n = ministry.toLowerCase();
  if (/finance|commerce|econom|gst|budget|bank/.test(n)) return "economy";
  if (/external|foreign|mea|bilateral/.test(n)) return "foreign";
  if (/road|rail|power|housing|port|infra|aviation|highway/.test(n)) return "infra";
  if (/health|education|ayush|school|medical/.test(n)) return "health";
  if (/environment|forest|climate|earth|renewable/.test(n)) return "environment";
  return "governance";
}

export function sourceLabel(source?: DigestSource): { short: string; full: string } {
  if (source === "mea") return { short: "MEA", full: "Ministry of External Affairs" };
  if (source === "bilateral") return { short: "MEA", full: "Bilateral Documents" };
  if (source === "air") return { short: "AIR", full: "News on Air \u00b7 Akashvani" };
  return { short: "PIB", full: "Press Information Bureau" };
}
