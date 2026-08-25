export type MinistryGroup = "office" | "cabinet" | "ministry" | "other";
export type Ministry = { id: number; en: string; hi: string; shortEn: string; shortHi: string; group: MinistryGroup; aliases: string[] };
export type DeskFilter = { kind: "all" } | { kind: "id"; id: number } | { kind: "name"; name: string };
type Row = [id: number, group: MinistryGroup, en: string, hi: string, aliases?: string[]];

const ROWS: Row[] = [
  [1, "office", "President's Secretariat", "\u0930\u093e\u0937\u094d\u091f\u094d\u0930\u092a\u0924\u093f \u0938\u091a\u093f\u0935\u093e\u0932\u092f"],
  [2, "office", "Vice President's Secretariat", "\u0909\u092a \u0930\u093e\u0937\u094d\u091f\u094d\u0930\u092a\u0924\u093f \u0938\u091a\u093f\u0935\u093e\u0932\u092f"],
  [3, "office", "Prime Minister's Office", "\u092a\u094d\u0930\u0927\u093e\u0928\u092e\u0902\u0924\u094d\u0930\u0940 \u0915\u093e\u0930\u094d\u092f\u093e\u0932\u092f", ["pmo", "prime minister"]],
  [80, "ministry", "AYUSH", "\u0906\u092f\u0941\u0937", ["ministry of ayush", "ayush"]],
  [27, "ministry", "Ministry of Agriculture & Farmers Welfare", "Agriculture", ["agriculture and farmers welfare"]],
  [26, "ministry", "Ministry of Civil Aviation", "Civil Aviation"],
  [16, "ministry", "Ministry of Commerce & Industry", "Commerce"],
  [24, "ministry", "Ministry of Communications", "Communications"],
  [33, "ministry", "Ministry of Defence", "Defence"],
  [8, "ministry", "Ministry of Education", "Education", ["hrd"]],
  [1323, "ministry", "Ministry of Electronics & IT", "Electronics", ["meity"]],
  [4, "ministry", "Ministry of External Affairs", "MEA", ["mea"]],
  [15, "ministry", "Ministry of Finance", "Finance"],
  [31, "ministry", "Ministry of Health and Family Welfare", "Health", ["mohfw"]],
  [5, "ministry", "Ministry of Home Affairs", "Home", ["mha"]],
  [11, "ministry", "Ministry of Information & Broadcasting", "I&B"],
  [7, "ministry", "Ministry of Law and Justice", "Law"],
  [51, "ministry", "Ministry of Micro, Small & Medium Enterprises", "MSME", ["msme"]],
  [6, "ministry", "Ministry of Personnel, Public Grievances & Pensions", "DoPT"],
  [23, "ministry", "Ministry of Railways", "Railways"],
  [13, "ministry", "Ministry of Science & Technology", "Science"],
  [36, "ministry", "Ministry of Tourism", "Tourism"],
  [9, "ministry", "Ministry of Youth Affairs and Sports", "Sports"],
  [14, "other", "Department of Space", "ISRO", ["isro"]],
  [78, "other", "NITI Aayog", "NITI", ["niti"]],
  [35, "office", "Election Commission", "ECI", ["eci"]],
  [34, "office", "UPSC", "UPSC"],
];

function autoShortEn(en: string): string {
  return en.replace(/^Ministry of\s+/i, "").replace(/^Department of\s+/i, "");
}
export const MINISTRIES: Ministry[] = ROWS.map(([id, group, en, hi, aliases]) => ({
  id, group, en, hi, shortEn: autoShortEn(en), shortHi: hi, aliases: aliases ?? [],
}));
export const MINISTRY_BY_ID = new Map(MINISTRIES.map((m) => [m.id, m]));
export const GROUP_ORDER: MinistryGroup[] = ["office", "cabinet", "ministry", "other"];
export const GROUP_LABEL: Record<MinistryGroup, { en: string; hi: string }> = {
  office: { en: "Offices & commissions", hi: "Offices" },
  cabinet: { en: "Cabinet", hi: "Cabinet" },
  ministry: { en: "Ministries", hi: "Ministries" },
  other: { en: "Departments & other", hi: "Other" },
};
const STOP = new Set(["and", "of", "the", "on", "for", "ministry", "department", "govt", "government", "india"]);
export function normalizeMinistryName(name: string): string {
  return name.toLowerCase().replace(/&/g, " and ").replace(/ministry of/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function tokensOf(normalized: string): Set<string> {
  return new Set(normalized.split(" ").filter((t) => t.length > 1 && !STOP.has(t)));
}
const INDEX = MINISTRIES.map((ministry) => {
  const keys = [normalizeMinistryName(ministry.en), ...ministry.aliases.map(normalizeMinistryName)].filter(Boolean);
  return { ministry, keys, tokenSet: tokensOf(keys[0] ?? "") };
});
export function matchMinistryId(listingName: string): number | null {
  const norm = normalizeMinistryName(listingName);
  if (!norm) return null;
  for (const row of INDEX) if (row.keys.includes(norm)) return row.ministry.id;
  const listingTokens = tokensOf(norm);
  let bestId: number | null = null;
  let bestScore = 0;
  for (const row of INDEX) {
    let overlap = 0;
    for (const token of listingTokens) if (row.tokenSet.has(token)) overlap += 1;
    if (overlap === 0) continue;
    const score = overlap / (listingTokens.size + row.tokenSet.size - overlap);
    if (score > bestScore) { bestScore = score; bestId = row.ministry.id; }
  }
  return bestScore >= 0.72 ? bestId : null;
}
export function deskLabel(ministry: Ministry, lang: 1 | 2): string {
  return lang === 2 ? ministry.shortHi : ministry.shortEn;
}
export function deskFullLabel(ministry: Ministry, lang: 1 | 2): string {
  return lang === 2 ? ministry.hi : ministry.en;
}
export function releaseMatchesDesk(listingName: string, filter: DeskFilter): boolean {
  if (filter.kind === "all") return true;
  if (filter.kind === "name") return listingName === filter.name;
  return matchMinistryId(listingName) === filter.id;
}
export const ALL_DESK: DeskFilter = { kind: "all" };
export function isAllDesk(filter: DeskFilter): filter is { kind: "all" } {
  return filter.kind === "all";
}
export function sameDesk(a: DeskFilter, b: DeskFilter): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "all") return true;
  if (a.kind === "id" && b.kind === "id") return a.id === b.id;
  if (a.kind === "name" && b.kind === "name") return a.name === b.name;
  return false;
}
