import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ListReleasesResult, ReleaseArticle } from "@/lib/pib/types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const pibLang = z
  .union([z.literal(1), z.literal(2), z.literal("1"), z.literal("2")])
  .transform((v) => Number(v) as 1 | 2);

const listInput = z.object({
  from: isoDate,
  to: isoDate,
  lang: pibLang,
});

const articlesInput = z.object({
  prids: z.array(z.string().regex(/^\d+$/)).min(1).max(40),
  lang: pibLang,
});

export const listAirFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => listInput.parse(d))
  .handler(async ({ data }): Promise<ListReleasesResult> => {
    const { listAirForRange } = await import("./scrape.server");
    return listAirForRange(data);
  });

export const fetchAirArticlesFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => articlesInput.parse(d))
  .handler(async ({ data }): Promise<ReleaseArticle[]> => {
    const { fetchAirArticles } = await import("./scrape.server");
    return fetchAirArticles(data.prids, data.lang);
  });
