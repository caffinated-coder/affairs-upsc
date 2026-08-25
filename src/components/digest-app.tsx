import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileDown, Loader2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MinistryFilter } from "@/components/ministry-filter";
import { DigestCharts } from "@/components/digest-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchArticlesFn, listReleasesFn } from "@/lib/pib/api";
import { fetchMeaArticlesFn, listMeaFn } from "@/lib/mea/api";
import { fetchAirArticlesFn, listAirFn } from "@/lib/air/api";
import { AIR_BRAND, BILATERAL_BRAND, MEA_BRAND, PIB_BRAND, downloadDigestPdf } from "@/lib/pdf";
import { readLocalQuery, writeLocalQuery } from "@/lib/pib/local-cache";
import { clampIsoDate, clampRange, formatDisplayDate, formatMonthLabel, MAX_CUSTOM_DAYS, MIN_DATE, monthRange, shiftIsoDate, shiftMonth, todayIst } from "@/lib/pib/dates";
import { ALL_DESK, isAllDesk, releaseMatchesDesk, type DeskFilter } from "@/lib/pib/ministries";
import { blocksOf, type DigestSource, type PibLang, type ReleaseArticle, type ReleaseSummary } from "@/lib/pib/types";
import { cn } from "@/lib/utils";

type Mode = "day" | "week" | "month" | "custom";
const MAX_PDF = 40;
const SOURCES: { id: DigestSource; label: string }[] = [
  { id: "pib", label: "PIB" }, { id: "mea", label: "MEA" }, { id: "bilateral", label: "Bilaterals" }, { id: "air", label: "AIR" },
];

function rangeFor(mode: Mode, focus: string, from: string, to: string) {
  const today = todayIst();
  if (mode === "day") { const d = clampIsoDate(focus); return { from: d, to: d }; }
  if (mode === "week") { const end = clampIsoDate(focus); return { from: shiftIsoDate(end, -6), to: end }; }
  if (mode === "month") return monthRange(Number(focus.slice(0, 4)), Number(focus.slice(5, 7)), today);
  return clampRange(from, to, MAX_CUSTOM_DAYS);
}
function brandFor(source: DigestSource) {
  if (source === "mea") return MEA_BRAND;
  if (source === "bilateral") return BILATERAL_BRAND;
  if (source === "air") return AIR_BRAND;
  return PIB_BRAND;
}
async function listFor(source: DigestSource, from: string, to: string, lang: PibLang) {
  if (source === "mea" || source === "bilateral") return listMeaFn({ data: { source, from, to, lang } });
  if (source === "air") return listAirFn({ data: { from, to, lang } });
  return listReleasesFn({ data: { from, to, lang } });
}
async function fetchFor(source: DigestSource, prids: string[], lang: PibLang) {
  if (source === "mea" || source === "bilateral") return fetchMeaArticlesFn({ data: { source, prids, lang } });
  if (source === "air") return fetchAirArticlesFn({ data: { prids, lang } });
  return fetchArticlesFn({ data: { prids, lang } });
}

export function DigestApp() {
  const today = todayIst();
  const [source, setSource] = useState<DigestSource>("pib");
  const [lang, setLang] = useState<PibLang>(1);
  const [mode, setMode] = useState<Mode>("day");
  const [focus, setFocus] = useState(today);
  const [customFrom, setCustomFrom] = useState(shiftIsoDate(today, -6));
  const [customTo, setCustomTo] = useState(today);
  const [desk, setDesk] = useState<DeskFilter>(ALL_DESK);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [reader, setReader] = useState<ReleaseArticle | null>(null);
  const { from, to } = rangeFor(mode, focus, customFrom, customTo);
  const cacheKey = `${source}:${lang}:${from}:${to}`;
  const list = useQuery({
    queryKey: ["list", cacheKey],
    queryFn: async () => { const data = await listFor(source, from, to, lang); writeLocalQuery(cacheKey, data); return data; },
    placeholderData: () => readLocalQuery(cacheKey),
    staleTime: 5 * 60 * 1000,
  });
  const countsByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of list.data?.releases ?? []) m.set(r.ministry, (m.get(r.ministry) ?? 0) + 1);
    return m;
  }, [list.data]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (list.data?.releases ?? []).filter((r) => releaseMatchesDesk(r.ministry, desk) && (!needle || r.title.toLowerCase().includes(needle) || r.ministry.toLowerCase().includes(needle)));
  }, [list.data, desk, q]);
  const pdfMut = useMutation({
    mutationFn: async (prids: string[]) => {
      const articles = await fetchFor(source, prids, lang);
      return downloadDigestPdf(articles, from, to, brandFor(source));
    },
    onSuccess: (name) => toast.success(`Saved ${name}`),
    onError: (err) => toast.error(err instanceof Error ? err.message : "PDF failed"),
  });
  const openMut = useMutation({
    mutationFn: async (prid: string) => (await fetchFor(source, [prid], lang))[0],
    onSuccess: setReader,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not open"),
  });
  const toggle = (id: string) => setPicked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else if (next.size < MAX_PDF) next.add(id); return next; });
  const step = (dir: number) => {
    if (mode === "month") setFocus(shiftMonth(focus, dir));
    else setFocus(shiftIsoDate(focus, dir * (mode === "week" ? 7 : 1)));
  };
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-accent">AFFAIRS \u00d7 UPSC</p>
          <h1 className="font-display text-3xl text-ink">Press digest</h1>
          <p className="text-sm text-muted">{formatDisplayDate(from)}{from !== to ? ` \u2013 ${formatDisplayDate(to)}` : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button variant={lang === 1 ? "default" : "outline"} size="sm" onClick={() => setLang(1)}>EN</Button>
          <Button variant={lang === 2 ? "default" : "outline"} size="sm" onClick={() => setLang(2)}>HI</Button>
        </div>
      </header>
      <div className="mb-4 flex flex-wrap gap-2">
        {SOURCES.map((s) => (
          <button key={s.id} type="button" onClick={() => { setSource(s.id); setPicked(new Set()); setDesk(ALL_DESK); }} className={cn("rounded-full px-4 py-1.5 text-sm", source === s.id ? "bg-accent text-accent-fg" : "bg-surface text-ink-soft shadow-[var(--shadow-border)]")}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["day", "week", "month", "custom"] as Mode[]).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={cn("rounded-full px-3 py-1 text-xs capitalize", mode === m ? "bg-ink text-paper" : "text-muted hover:bg-accent-soft")}>
            {m}
          </button>
        ))}
        {mode !== "custom" && (
          <div className="ml-2 flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => step(-1)}><ChevronLeft className="size-4" /></Button>
            <span className="text-sm">{mode === "month" ? formatMonthLabel(Number(focus.slice(0, 4)), Number(focus.slice(5, 7))) : focus}</span>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => step(1)} disabled={focus >= today}><ChevronRight className="size-4" /></Button>
          </div>
        )}
        {mode === "custom" && (
          <div className="flex gap-2">
            <Input type="date" min={MIN_DATE} max={today} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-40" />
            <Input type="date" min={MIN_DATE} max={today} value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-40" />
          </div>
        )}
      </div>
      {source === "pib" && <div className="mb-4"><DigestCharts anchor={to} lang={lang} desk={desk} onSelectDesk={setDesk} /></div>}
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <MinistryFilter lang={lang} filter={desk} onChange={setDesk} listingNames={[...countsByName.keys()]} countsByName={countsByName} />
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles" className="pl-9" />
            </div>
            <Badge variant="muted">{shown.length} releases</Badge>
            <Button size="sm" disabled={!picked.size || pdfMut.isPending} onClick={() => pdfMut.mutate([...picked])}>
              {pdfMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />} PDF ({picked.size})
            </Button>
          </div>
          {list.isLoading && !list.data ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="mb-2 h-16" />) : null}
          {list.isError && <p className="text-sm text-danger">{list.error instanceof Error ? list.error.message : "Failed to load"}</p>}
          <ul className="space-y-2">
            {shown.map((r) => (
              <li key={r.prid} className="flex gap-3 rounded-lg border border-line bg-surface p-3">
                <Checkbox checked={picked.has(r.prid)} onCheckedChange={() => toggle(r.prid)} />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openMut.mutate(r.prid)}>
                  <p className="font-medium text-ink">{r.title}</p>
                  <p className="text-xs text-muted">{r.ministry} \u00b7 {r.postedDate}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {reader && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 p-4" onClick={() => setReader(null)}>
          <article className="mx-auto max-w-3xl rounded-xl bg-paper p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-accent">{reader.ministry}</p>
                <h2 className="font-display text-2xl">{reader.title}</h2>
                <p className="text-sm text-muted">{reader.postedOn}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setReader(null)}><X /></Button>
            </div>
            <div className="space-y-4 text-[15px] leading-7">
              {blocksOf(reader).map((b, i) => b.type === "p" ? <p key={i}>{b.text}</p> : b.type === "image" ? <figure key={i}><img src={b.dataUrl || b.src} alt={b.alt} className="w-full rounded-md" />{b.alt && <figcaption className="mt-1 text-xs text-muted">{b.alt}</figcaption>}</figure> : (
                <div key={i} className="overflow-x-auto"><table className="w-full border-collapse text-sm">{b.rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="border border-line px-2 py-1">{cell}</td>)}</tr>)}</table></div>
              ))}
            </div>
            <div className="mt-6"><Button size="sm" onClick={() => pdfMut.mutate([reader.prid])}>Download PDF</Button></div>
          </article>
        </div>
      )}
    </div>
  );
}
