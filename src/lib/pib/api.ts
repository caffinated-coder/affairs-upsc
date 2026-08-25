import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ListReleasesResult, ListVolumeResult, ReleaseArticle } from "./types";

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

const volumeInput = z.object({
  to: isoDate,
  grain: z.enum(["day", "week", "month"]),
  lang: pibLang,
});

export const listReleasesFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => listInput.parse(d))
  .handler(async ({ data }): Promise<ListReleasesResult> => {
    const { listReleasesForRange } = await import("./scrape.server");
    return listReleasesForRange(data);
  });

export const listVolumeFn = createServerFn({ method: "GET" })
  .validator((d: unknown) => volumeInput.parse(d))
  .handler(async ({ data }): Promise<ListVolumeResult> => {
    const { listVolume } = await import("./scrape.server");
    return listVolume(data);
  });

export const fetchArticlesFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => articlesInput.parse(d))
  .handler(async ({ data }): Promise<ReleaseArticle[]> => {
    const { fetchArticles } = await import("./scrape.server");
    return fetchArticles(data);
  });
