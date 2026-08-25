export type PibLang = 1 | 2;

export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "image"; src: string; alt: string; dataUrl?: string }
  | { type: "table"; rows: string[][]; caption?: string };

export type DigestSource = "pib" | "mea" | "bilateral" | "air";

export type ReleaseSummary = {
  prid: string;
  title: string;
  ministry: string;
  postedDate: string;
  url: string;
  source?: DigestSource;
  tags?: string[];
};

export type ReleaseArticle = ReleaseSummary & {
  subtitle: string;
  postedOn: string;
  paragraphs: string[];
  blocks: ArticleBlock[];
  office: string;
};

export type ListReleasesInput = {
  from: string;
  to: string;
  lang: PibLang;
};

export type ListReleasesResult = {
  from: string;
  to: string;
  lang: PibLang;
  count: number;
  ministries: string[];
  releases: ReleaseSummary[];
};

export type FetchArticlesInput = {
  prids: string[];
  lang: PibLang;
};

export type VolumeGrain = "day" | "week" | "month";

export type VolumePoint = {
  key: string;
  label: string;
  count: number;
};

export type VolumeDesk = {
  name: string;
  count: number;
};

export type ListVolumeInput = {
  to: string;
  grain: VolumeGrain;
  lang: PibLang;
};

export type ListVolumeResult = {
  grain: VolumeGrain;
  from: string;
  to: string;
  lang: PibLang;
  total: number;
  series: VolumePoint[];
  desks: VolumeDesk[];
};

export function blocksOf(article: ReleaseArticle): ArticleBlock[] {
  if (article.blocks && article.blocks.length > 0) return article.blocks;
  return (article.paragraphs ?? []).map((text) => ({ type: "p" as const, text }));
}
