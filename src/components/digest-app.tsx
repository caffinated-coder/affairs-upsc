import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileDown, Loader2, Search, X } from "lucide-react";
import { lazy, Suspense, useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import { MinistryFilter } from "@/components/ministry-filter";
import { ViewersBadge } from "@/components/viewers-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchArticlesFn, listReleasesFn } from "@/lib/pib/api";
import { fetchMeaArticlesFn, listMeaFn } from "@/lib/mea/api";
import { fetchAirArticlesFn, listAirFn } from "@/lib/air/api";
import { readLocalQuery, writeLocalQuery } from "@/lib/pib/local-cache";
import { clampIsoDate, clampRange, formatDisplayDate, formatMonthLabel, MAX_CUSTOM_DAYS, MIN_DATE, monthRange, shiftIsoDate, shiftMonth, todayIst } from "@/lib/pib/dates";
import { ALL_DESK, releaseMatchesDesk, type DeskFilter } from "@/lib/pib/ministries";
import { blocksOf, type DigestSource, type PibLang, type ReleaseArticle } from "@/lib/pib/types";
import { cn } from "@/lib/utils";

const DigestCharts = lazy(() => import("@/components/digest-charts").then((m) => ({ default: m.DigestCharts })));

type Mode = "day" | "week" | "month" | "custom";
const MAX_PDF = 40;
const PAGE = 60;
const SOURCES: { id: DigestSource; label: string }[] = [
  { id: "pib", label: "PIB" }, { id: "mea", label: "MEA" }, { id: "bilateral", label: "Bilaterals" }, { id: "air", label: "AIR" },
];

function rangeFor(mode: Mode, focus: string, from: string, to: string, minDate: string) {
  const today = todayIst();
  if (mode === "day") { const d = clampIsoDate(focus, minDate); return { from: d, to: d }; }
  if (mode === "week") { const end = clampIsoDate(focus, minDate); return { from: clampIsoDate(shiftIsoDate(end, -6), minDate), to: end }; }
  if (mode === "month") return monthRange(Number(focus.slice(0, 4)), Number(focus.slice(5, 7)), today);
  return clampRange(from, to, MAX_CUSTOM_DAYS);
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
  const [showCharts, setShowCharts] = useState(false);
  const [visible, setVisible] = useState(PAGE);
  const search = useDeferredValue(q.trim().toLowerCase());
  const minDate = source === "pib" ? "2017-01-01" : source === "air" ? "2018-01-01" : "2003-01-01";
  const { from, to } = rangeFor(mode, focus, customFrom, customTo, minDate);
  const cacheKey = `list:${source}:${lang}:${from}:${to}`;
  const list = useQuery({
    queryKey: ["list", cacheKey],
    queryFn: async () => { const data = await listFor(source, from, to, lang); writeLocalQuery(cacheKey, data); return data; },
    placeholderData: (prev) => prev ?? readLocalQuery(cacheKey),
    staleTime: 10 * 60 * 1000,
  });
  const countsByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of list.data?.releases ?? []) m.set(r.ministry, (m.get(r.ministry) ?? 0) + 1);
    return m;
  }, [list.data]);
  const shown = useMemo(() => (list.data?.releases ?? []).filter((r) => releaseMatchesDesk(r.ministry, desk) && (!search || r.title.toLowerCase().includes(search) || r.ministry.toLowerCase().includes(search))), [list.data, desk, search]);
  const page = shown.slice(0, visible);
  const pdfMut = useMutation({
    mutationFn: async (prids: string[]) => {
      const articles = await fetchFor(source, prids.slice(0, MAX_PDF), lang);
      const { downloadDigestPdf, PIB_BRAND, MEA_BRAND, BILATERAL_BRAND, AIR_BRAND } = await import("@/lib/pdf");
      const brand = source === "mea" ? MEA_BRAND : source === "bilateral" ? BILATERAL_BRAND : source === "air" ? AIR_BRAND : PIB_BRAND;
      return downloadDigestPdf(articles, from, to, brand);
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
  const step = (dir: number) => { setVisible(PAGE); if (mode === "month") setFocus(shiftMonth(focus, dir)); else setFocus(shiftIsoDate(focus, dir * (mode === "week" ? 7 : 1))); };
  const dateLabel = mode === "month" ? formatMonthLabel(Number(focus.slice(0, 4)), Number(focus.slice(5, 7))) : formatDisplayDate(from);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-accent uppercase">Affairs \u00d7 UPSC</p>
          <h1 className="mt-0.5 font-display text-3xl font-semibold tracking-tight text-ink">Press digest</h1>
          <p className="mt-1 text-sm text-muted">{dateLabel}{from !== to && mode !== "month" ? ` \u2013 ${formatDisplayDate(to)}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewersBadge />
          <Button variant={lang === 1 ? "default" : "outline"} size="sm" onClick={() => setLang(1)}>EN</Button>
          <Button variant={lang === 2 ? "default" : "outline"} size="sm" onClick={() => setLang(2)}>HI</Button>
        </div>
      </header>
      <nav className="mb-4 flex gap-1 rounded-lg bg-bg-warm p-1">
        {SOURCES.map((s) => (
          <button key={s.id} type="button" onClick={() => { setSource(s.id); setPicked(new Set()); setDesk(ALL_DESK); setVisible(PAGE); setShowCharts(false); }} className={cn("h-9 flex-1 rounded-md text-sm font-medium transition-colors", source === s.id ? "bg-surface text-ink shadow-[var(--shadow-border)]" : "text-muted hover:text-ink")}>
            {s.label}
          </button>
        ))}
      </nav>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["day", "week", "month", "custom"] as Mode[]).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setVisible(PAGE); }} className={cn("rounded-full px-3 py-1 text-xs font-medium capitalize", mode === m ? "bg-ink text-paper" : "text-muted hover:bg-accent-soft")}>{m}</button>
        ))}
        {mode !== "custom" ? (
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft className="size-4" /></Button>
            <span className="min-w-28 text-center text-sm tabular-nums">{dateLabel}</span>
            <Button variant="ghost" size="icon" className="size-8" disabled={to >= today} onClick={() => step(1)} aria-label="Next"><ChevronRight className="size-4" /></Button>
          </div>
        ) : (
          <div className="ml-auto flex gap-2">
            <Input type="date" min={MIN_DATE} max={today} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-36" />
            <Input type="date" min={MIN_DATE} max={today} value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-36" />
          </div>
        )}
      </div>
      {source === "pib" && (
        <div className="mb-4">
          <button type="button" onClick={() => setShowCharts((v) => !v)} className="text-xs font-medium text-muted hover:text-accent">{showCharts ? "Hide trends" : "Show trends"}</button>
          {showCharts && <div className="mt-2"><Suspense fallback={<Skeleton className="h-44" />}><DigestCharts anchor={to} lang={lang} desk={desk} onSelectDesk={setDesk} /></Suspense></div>}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <MinistryFilter lang={lang} filter={desk} onChange={setDesk} listingNames={[...countsByName.keys()]} countsByName={countsByName} />
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles" className="h-10 pl-9" />
            </div>
            <Badge variant="muted">{shown.length}</Badge>
            <Button size="sm" disabled={pdfMut.isPending || (!picked.size && shown.length === 0)} onClick={() => pdfMut.mutate(picked.size ? [...picked] : shown.slice(0, MAX_PDF).map((r) => r.prid))}>
              {pdfMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />} PDF{picked.size ? ` ${picked.size}` : ""}
            </Button>
          </div>
          {list.isLoading && !list.data && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="mb-2 h-14" />)}
          {list.isError && <p className="text-sm text-danger">{list.error instanceof Error ? list.error.message : "Failed to load"}</p>}
          {!list.isLoading && shown.length === 0 && <p className="py-10 text-center text-sm text-muted">No releases in this window.</p>}
          <ul className="space-y-1.5">
            {page.map((r) => (
              <li key={r.prid} className="list-row flex gap-3 rounded-md bg-surface px-3 py-2.5 shadow-[var(--shadow-border)]">
                <Checkbox checked={picked.has(r.prid)} onCheckedChange={() => toggle(r.prid)} aria-label="Select for PDF" />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openMut.mutate(r.prid)}>
                  <p className="line-clamp-2 text-sm font-medium text-ink">{r.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">{r.ministry} \u00b7 {r.postedDate}</p>
                </button>
              </li>
            ))}
          </ul>
          {shown.length > visible && <Button variant="outline" className="mt-3 w-full" onClick={() => setVisible((n) => n + PAGE)}>Show more \u00b7 {shown.length - visible} left</Button>}
        </section>
      </div>
      {reader && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 p-3 sm:p-6" onClick={() => setReader(null)}>
          <article className="mx-auto max-w-2xl rounded-xl bg-paper p-5 shadow-xl sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-accent uppercase">{reader.ministry}</p>
                <h2 className="mt-1 font-display text-2xl leading-snug">{reader.title}</h2>
                <p className="mt-1 text-sm text-muted">{reader.postedOn}</p>
              </div>
              <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setReader(null)} aria-label="Close"><X className="size-4" /></Button>
            </div>
            <div className="space-y-4 text-[15px] leading-7 text-ink-soft">
              {blocksOf(reader).map((b, i) => b.type === "p" ? <p key={i}>{b.text}</p> : b.type === "image" ? <figure key={i}><img src={b.dataUrl || b.src} alt={b.alt} loading="lazy" decoding="async" className="w-full rounded-md" />{b.alt ? <figcaption className="mt-1 text-xs text-muted">{b.alt}</figcaption> : null}</figure> : (
                <div key={i} className="overflow-x-auto"><table className="w-full border-collapse text-sm"><tbody>{b.rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="border border-line px-2 py-1">{cell}</td>)}</tr>)}</tbody></table></div>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              <Button size="sm" onClick={() => pdfMut.mutate([reader.prid])}>Download PDF</Button>
              {reader.url ? <a className="inline-flex h-9 items-center rounded-sm border border-line px-3 text-sm" href={reader.url} target="_blank" rel="noreferrer">Source</a> : null}
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
