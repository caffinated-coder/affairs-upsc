export type MinistryGroup = "office" | "cabinet" | "ministry" | "other";
export type Ministry = { id: number; en: string; hi: string; shortEn: string; shortHi: string; group: MinistryGroup; aliases: string[]; };
export type DeskFilter = { kind: "all" } | { kind: "id"; id: number } | { kind: "name"; name: string };
type Row = [id: number, group: MinistryGroup, en: string, hi: string, aliases?: string[]];

const ROWS: Row[] = [
  [1, "office", "President's Secretariat", "President Secretariat"],
  [2, "office", "Vice President's Secretariat", "Vice President Secretariat"],
  [3, "office", "Prime Minister's Office", "Prime Minister Office", ["pmo", "prime minister"]],
  [2608, "office", "Lok Sabha Secretariat", "Lok Sabha Secretariat"],
  [2934, "office", "Rajya Sabha Secretariat", "Rajya Sabha Secretariat"],
  [61, "cabinet", "Cabinet", "Cabinet"],
  [62, "cabinet", "Cabinet Committee Decisions", "Cabinet Committee Decisions"],
  [63, "cabinet", "Cabinet Committee on Economic Affairs (CCEA)", "CCEA", ["ccea"]],
  [68, "cabinet", "Cabinet Secretariat", "Cabinet Secretariat"],
  [70, "cabinet", "Cabinet Committee on Infrastructure", "Cabinet Infrastructure"],
  [71, "cabinet", "Cabinet Committee on Price", "Cabinet Price"],
  [75, "cabinet", "Cabinet Committee on Investment", "Cabinet Investment"],
  [72, "cabinet", "Other Cabinet Committees", "Other Cabinet Committees"],
  [80, "ministry", "AYUSH", "AYUSH", ["ministry of ayush", "ayush"]],
  [27, "ministry", "Ministry of Agriculture & Farmers Welfare", "Agriculture", ["agriculture and farmers welfare"]],
  [58, "ministry", "Ministry of Agro & Rural Industries", "Agro & Rural Industries"],
  [41, "ministry", "Ministry of Chemicals and Fertilizers", "Chemicals and Fertilizers"],
  [26, "ministry", "Ministry of Civil Aviation", "Civil Aviation"],
  [42, "ministry", "Ministry of Coal", "Coal"],
  [16, "ministry", "Ministry of Commerce & Industry", "Commerce & Industry"],
  [24, "ministry", "Ministry of Communications", "Communications"],
  [60, "ministry", "Ministry of Company Affairs", "Company Affairs"],
  [39, "ministry", "Ministry of Consumer Affairs, Food & Public Distribution", "Consumer Affairs"],
  [1440, "ministry", "Ministry of Cooperation", "Cooperation"],
  [66, "ministry", "Ministry of Corporate Affairs", "Corporate Affairs"],
  [17, "ministry", "Ministry of Culture", "Culture"],
  [33, "ministry", "Ministry of Defence", "Defence"],
  [57, "ministry", "Ministry of Development of North-East Region", "DoNER", ["doner", "north east region", "north-east"]],
  [48, "ministry", "Ministry of Disinvestment", "Disinvestment"],
  [73, "ministry", "Ministry of Drinking Water & Sanitation", "Drinking Water"],
  [67, "ministry", "Ministry of Earth Sciences", "Earth Sciences"],
  [8, "ministry", "Ministry of Education", "Education", ["hrd", "human resource development"]],
  [1323, "ministry", "Ministry of Electronics & IT", "Electronics & IT", ["electronics and information technology", "meity"]],
  [30, "ministry", "Ministry of Environment, Forest and Climate Change", "Environment", ["moefcc", "environment and forests"]],
  [4, "ministry", "Ministry of External Affairs", "External Affairs", ["mea"]],
  [15, "ministry", "Ministry of Finance", "Finance"],
  [1340, "ministry", "Ministry of Fisheries, Animal Husbandry & Dairying", "Fisheries"],
  [40, "ministry", "Ministry of Food Processing Industries", "Food Processing"],
  [31, "ministry", "Ministry of Health and Family Welfare", "Health", ["mohfw"]],
  [53, "ministry", "Ministry of Heavy Industries", "Heavy Industries"],
  [5, "ministry", "Ministry of Home Affairs", "Home Affairs", ["mha"]],
  [47, "ministry", "Ministry of Housing & Urban Affairs", "Housing", ["mohua"]],
  [11, "ministry", "Ministry of Information & Broadcasting", "I&B", ["information and broadcasting", "i and b"]],
  [1336, "ministry", "Ministry of Jal Shakti", "Jal Shakti"],
  [21, "ministry", "Ministry of Labour & Employment", "Labour"],
  [7, "ministry", "Ministry of Law and Justice", "Law and Justice"],
  [51, "ministry", "Ministry of Micro, Small & Medium Enterprises", "MSME", ["msme", "micro,small & medium enterprises", "micro small and medium"]],
  [44, "ministry", "Ministry of Mines", "Mines"],
  [65, "ministry", "Ministry of Minority Affairs", "Minority Affairs"],
  [28, "ministry", "Ministry of New and Renewable Energy", "MNRE", ["mnre"]],
  [59, "ministry", "Ministry of Overseas Indian Affairs", "Overseas Indian Affairs"],
  [10, "ministry", "Ministry of Panchayati Raj", "Panchayati Raj"],
  [12, "ministry", "Ministry of Parliamentary Affairs", "Parliamentary Affairs"],
  [6, "ministry", "Ministry of Personnel, Public Grievances & Pensions", "Personnel", ["dopt", "doppw"]],
  [20, "ministry", "Ministry of Petroleum & Natural Gas", "Petroleum"],
  [79, "ministry", "Ministry of Planning", "Planning"],
  [52, "ministry", "Ministry of Power", "Power"],
  [23, "ministry", "Ministry of Railways", "Railways"],
  [69, "ministry", "Ministry of Road Transport & Highways", "Highways", ["morth"]],
  [43, "ministry", "Ministry of Rural Development", "Rural Development"],
  [13, "ministry", "Ministry of Science & Technology", "Science & Technology"],
  [46, "ministry", "Ministry of Ports, Shipping and Waterways", "Ports", ["shipping"]],
  [77, "ministry", "Ministry of Skill Development and Entrepreneurship", "Skill Development"],
  [50, "ministry", "Ministry of Social Justice & Empowerment", "Social Justice"],
  [55, "ministry", "Ministry of Statistics & Programme Implementation", "MoSPI", ["mospi"]],
  [18, "ministry", "Ministry of Steel", "Steel"],
  [25, "ministry", "Ministry of Surface Transport", "Surface Transport"],
  [19, "ministry", "Ministry of Textiles", "Textiles"],
  [36, "ministry", "Ministry of Tourism", "Tourism"],
  [49, "ministry", "Ministry of Tribal Affairs", "Tribal Affairs"],
  [32, "ministry", "Ministry of Urban Development", "Urban Development"],
  [38, "ministry", "Ministry of Water Resources, River Development and Ganga Rejuvenation", "Water Resources"],
  [64, "ministry", "Ministry of Women and Child Development", "WCD", ["wcd"]],
  [9, "ministry", "Ministry of Youth Affairs and Sports", "Youth Affairs"],
  [14, "other", "Department of Space", "Space", ["isro"]],
  [45, "other", "Department of Ocean Development", "Ocean Development"],
  [56, "other", "Department of Atomic Energy", "Atomic Energy"],
  [35, "office", "Election Commission", "Election Commission", ["eci"]],
  [1330, "office", "Finance Commission", "Finance Commission"],
  [78, "other", "NITI Aayog", "NITI Aayog", ["niti"]],
  [1325, "other", "PM Speech", "PM Speech", ["prime minister speech"]],
  [74, "other", "EAC-PM", "EAC-PM"],
  [34, "office", "UPSC", "UPSC"],
  [37, "other", "Special Service and Features", "Special Service"],
  [1005, "other", "PIB Backgrounder", "PIB Backgrounder"],
  [1406, "office", "Office of Principal Scientific Advisor to GoI", "Scientific Advisor"],
  [1454, "office", "National Financial Reporting Authority", "NFRA", ["nfra"]],
  [1458, "office", "Competition Commission of India", "CCI", ["cci"]],
  [1470, "office", "IFSC Authority", "IFSCA", ["ifsca"]],
  [1484, "office", "National Security Council Secretariat", "NSCS", ["nscs"]],
  [2586, "office", "National Human Rights Commission", "NHRC", ["nhrc"]],
  [2611, "office", "Lokpal of India", "Lokpal", ["lokpal"]],
];

const SHORT_EN: Record<number, string> = { 1: "President", 2: "Vice President", 3: "PMO", 2608: "Lok Sabha", 2934: "Rajya Sabha", 63: "CCEA", 57: "DoNER", 51: "MSME", 11: "I&B", 1323: "Electronics & IT", 64: "WCD", 1406: "Scientific Advisor", 1454: "NFRA", 1458: "CCI", 1470: "IFSCA", 1484: "NSCS", 2586: "NHRC", 2611: "Lokpal" };
function autoShortEn(en: string): string {
  return en.replace(/^Ministry of\s+/i, "").replace(/^Department of\s+/i, "").replace(/^Cabinet Committee on\s+/i, "Cabinet \u00b7 ");
}
function autoShortHi(hi: string): string { return hi.replace(/\s*Ministry$/i, "").trim() || hi; }
export const MINISTRIES: Ministry[] = ROWS.map(([id, group, en, hi, aliases]) => ({ id, group, en, hi, shortEn: SHORT_EN[id] ?? autoShortEn(en), shortHi: autoShortHi(hi), aliases: aliases ?? [] }));
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
  return name.replace(/[\u200b-\u200f\u202a-\u202e\ufeff\u00a0]/g, " ").replace(/\u200d/g, "").toLowerCase().replace(/&/g, " and ").replace(/ministry of/g, " ").replace(/department of/g, " ").replace(/[^a-z0-9\u0900-\u097f]+/g, " ").replace(/\s+/g, " ").trim();
}
function tokensOf(normalized: string): Set<string> {
  return new Set(normalized.split(" ").filter((t) => t.length > 1 && !STOP.has(t)));
}
const INDEX = MINISTRIES.map((ministry) => {
  const keys = [normalizeMinistryName(ministry.en), normalizeMinistryName(ministry.hi), normalizeMinistryName(ministry.shortEn), ...ministry.aliases.map(normalizeMinistryName)].filter(Boolean);
  return { ministry, keys, tokenSet: tokensOf(keys[0] ?? "") };
});
export function matchMinistryId(listingName: string): number | null {
  const norm = normalizeMinistryName(listingName);
  if (!norm) return null;
  for (const row of INDEX) if (row.keys.includes(norm)) return row.ministry.id;
  const listingTokens = tokensOf(norm);
  if (listingTokens.size === 0) return null;
  let bestId: number | null = null; let bestScore = 0;
  for (const row of INDEX) {
    let overlap = 0;
    for (const token of listingTokens) if (row.tokenSet.has(token)) overlap += 1;
    if (!overlap) continue;
    const union = listingTokens.size + row.tokenSet.size - overlap;
    const jaccard = overlap / union;
    const contained = overlap >= 2 && (overlap === listingTokens.size || overlap === row.tokenSet.size);
    const score = contained ? 0.85 + jaccard * 0.15 : jaccard;
    if (score > bestScore) { bestScore = score; bestId = row.ministry.id; }
  }
  return bestScore >= 0.72 ? bestId : null;
}
export function deskLabel(ministry: Ministry, lang: 1 | 2): string { return lang === 2 ? ministry.shortHi : ministry.shortEn; }
export function deskFullLabel(ministry: Ministry, lang: 1 | 2): string { return lang === 2 ? ministry.hi : ministry.en; }
export function releaseMatchesDesk(listingName: string, filter: DeskFilter): boolean {
  if (filter.kind === "all") return true;
  if (filter.kind === "name") return listingName === filter.name;
  return matchMinistryId(listingName) === filter.id;
}
export const ALL_DESK: DeskFilter = { kind: "all" };
export function isAllDesk(filter: DeskFilter): filter is { kind: "all" } { return filter.kind === "all"; }
export function sameDesk(a: DeskFilter, b: DeskFilter): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "all") return true;
  if (a.kind === "id" && b.kind === "id") return a.id === b.id;
  if (a.kind === "name" && b.kind === "name") return a.name === b.name;
  return false;
}
