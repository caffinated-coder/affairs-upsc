import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DigestSource, ListReleasesResult, ReleaseArticle } from "@/lib/pib/types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const pibLang = z
  .union([z.literal(1), z.literal(2), z.literal("1"), z.literal("2")])
  .transform((v) => Number(v) as 1 | 2);

const sourceSchema = z.enum(["mea", "bilateral"]);

const listInput = z.object({
  source: sourceSchema,
  from: isoDate,
  to: isoDate,
  lang: pibLang,
});

const articlesInput = z.object({
  source: sourceSchema,
  prids: z.array(z.string().regex(/^\d+$/)).min(1).max(40),
  lang: pibLang,
});

export const listMeaFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => listInput.parse(d))
  .handler(async ({ data }): Promise<ListReleasesResult> => {
    const { listMeaForRange } = await import("./scrape.server");
    return listMeaForRange(data.source as DigestSource, data);
  });

export const fetchMeaArticlesFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => articlesInput.parse(d))
  .handler(async ({ data }): Promise<ReleaseArticle[]> => {
    const { fetchMeaArticles } = await import("./scrape.server");
    return fetchMeaArticles(data.source as DigestSource, data.prids, data.lang);
  });
