import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, Bookmark, Building2, Calendar, ChevronLeft, ChevronRight, Clock, FileDown, FileText, Filter, Globe, Heart, HelpCircle, Home, Leaf, Loader2, Menu, Newspaper, RefreshCw, Search, Settings, Shield, X } from "lucide-react";
import { lazy, Suspense, useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import { MinistryFilter } from "@/components/ministry-filter";
import { StoryArt } from "@/components/story-art";
import { ViewersBadge } from "@/components/viewers-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchArticlesFn, listReleasesFn } from "@/lib/pib/api";
import { fetchMeaArticlesFn, listMeaFn } from "@/lib/mea/api";
import { fetchAirArticlesFn, listAirFn } from "@/lib/air/api";
import { isSaved, pushHistory, readHistory, readSaved, toggleSaved, type LibraryItem } from "@/lib/library";
import { readLocalQuery, writeLocalQuery } from "@/lib/pib/local-cache";
import { clampIsoDate, clampRange, formatChipDate, MAX_CUSTOM_DAYS, monthRange, shiftIsoDate, shiftMonth, storyClock, todayIst } from "@/lib/pib/dates";
import { ALL_DESK, releaseMatchesDesk, type DeskFilter } from "@/lib/pib/ministries";
import { sourceLabel, topicForRelease, TOPICS, type TopicId } from "@/lib/pib/topics";
import { blocksOf, type DigestSource, type PibLang, type ReleaseArticle, type ReleaseSummary } from "@/lib/pib/types";
import { cn } from "@/lib/utils";

const DigestCharts = lazy(() => import("@/components/digest-charts").then((m) => ({ default: m.DigestCharts })));
type Mode = "day" | "week" | "month" | "custom";
type View = "feed" | "saved" | "history" | "insights" | "settings" | "help";
const MAX_PDF = 40;
const PAGE = 12;
const SOURCES: { id: DigestSource; label: string; Icon: typeof FileText }[] = [
  { id: "pib", label: "PIB", Icon: FileText }, { id: "mea", label: "MEA", Icon: Globe }, { id: "bilateral", label: "Bilaterals", Icon: Newspaper }, { id: "air", label: "AIR", Icon: Newspaper },
];
const TOPIC_ICON: Record<TopicId, typeof BarChart3> = { all: Filter, economy: BarChart3, foreign: Globe, infra: Building2, health: Heart, environment: Leaf, governance: Shield };

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
const NAV: { id: View; label: string; Icon: typeof Home }[] = [
  { id: "feed", label: "Feed", Icon: Home }, { id: "saved", label: "Saved", Icon: Bookmark }, { id: "history", label: "History", Icon: Clock }, { id: "insights", label: "Insights", Icon: BarChart3 },
];

export function DigestApp() {
  const today = todayIst();
  const [view, setView] = useState<View>("feed");
  const [source, setSource] = useState<DigestSource>("pib");
  const [lang, setLang] = useState<PibLang>(1);
  const [mode, setMode] = useState<Mode>("day");
  const [focus, setFocus] = useState(today);
  const [customFrom, setCustomFrom] = useState(shiftIsoDate(today, -6));
  const [customTo, setCustomTo] = useState(today);
  const [desk, setDesk] = useState<DeskFilter>(ALL_DESK);
  const [topic, setTopic] = useState<TopicId>("all");
  const [q, setQ] = useState("");
  const [reader, setReader] = useState<ReleaseArticle | null>(null);
  const [visible, setVisible] = useState(PAGE);
  const [showFilter, setShowFilter] = useState(false);
  const [menu, setMenu] = useState(false);
  const [savedTick, setSavedTick] = useState(0);
  const search = useDeferredValue(q.trim().toLowerCase());
  const minDate = source === "pib" ? "2017-01-01" : source === "air" ? "2018-01-01" : "2003-01-01";
  const { from, to } = rangeFor(mode, focus, customFrom, customTo, minDate);
  const cacheKey = `list:${source}:${lang}:${from}:${to}`;
  const list = useQuery({
    queryKey: ["list", cacheKey],
    queryFn: async () => { const data = await listFor(source, from, to, lang); writeLocalQuery(cacheKey, data); return data; },
    placeholderData: (prev) => prev ?? readLocalQuery(cacheKey),
    staleTime: 10 * 60 * 1000,
    enabled: view === "feed" || view === "insights",
  });
  const countsByName = useMemo(() => { const m = new Map<string, number>(); for (const r of list.data?.releases ?? []) m.set(r.ministry, (m.get(r.ministry) ?? 0) + 1); return m; }, [list.data]);
  const shown = useMemo(() => (list.data?.releases ?? []).filter((r) => {
    if (!releaseMatchesDesk(r.ministry, desk)) return false;
    const t = topicForRelease(r.ministry, r.source ?? source);
    if (topic !== "all" && t !== topic) return false;
    if (search && !r.title.toLowerCase().includes(search) && !r.ministry.toLowerCase().includes(search)) return false;
    return true;
  }), [list.data, desk, topic, search, source]);
  const page = shown.slice(0, visible);
  const savedItems = useMemo(() => readSaved(), [savedTick]);
  const historyItems = useMemo(() => readHistory(), [savedTick, reader]);
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
    mutationFn: async (item: ReleaseSummary) => {
      const article = (await fetchFor(item.source ?? source, [item.prid], lang))[0];
      pushHistory({ prid: item.prid, title: item.title, ministry: item.ministry, postedDate: item.postedDate, url: item.url, source: item.source ?? source, at: Date.now() });
      return article;
    },
    onSuccess: setReader,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not open"),
  });
  const step = (dir: number) => { setVisible(PAGE); if (mode === "month") setFocus(shiftMonth(focus, dir)); else setFocus(shiftIsoDate(focus, dir * (mode === "week" ? 7 : 1))); };
  const bookmark = (item: ReleaseSummary | LibraryItem) => {
    toggleSaved({ prid: item.prid, title: item.title, ministry: item.ministry, postedDate: item.postedDate, url: item.url, source: "source" in item && item.source ? item.source : source, at: Date.now() });
    setSavedTick((n) => n + 1);
  };
  const sidebar = (
    <aside className="flex h-full w-[232px] shrink-0 flex-col border-r border-line bg-surface px-4 py-5">
      <div className="mb-8 flex items-center gap-3 px-1">
        <div className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent"><Newspaper className="size-5" /></div>
        <div><p className="text-[15px] font-semibold tracking-tight text-ink">Press Digest</p><p className="text-[11px] leading-snug text-muted">Your daily policy & public affairs brief</p></div>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map(({ id, label, Icon }) => (
          <button key={id} type="button" onClick={() => { setView(id); setMenu(false); }} className={cn("flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium", view === id ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-ink")}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
        <div className="my-4 h-px bg-line" />
        <button type="button" onClick={() => { setView("settings"); setMenu(false); }} className={cn("flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium", view === "settings" ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-ink")}><Settings className="size-4" /> Settings</button>
        <button type="button" onClick={() => { setView("help"); setMenu(false); }} className={cn("flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium", view === "help" ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-ink")}><HelpCircle className="size-4" /> Help & Feedback</button>
      </nav>
      <div className="mt-4 rounded-2xl bg-violet-soft p-4">
        <p className="text-sm font-semibold text-ink">Stay informed.</p>
        <p className="text-sm font-semibold text-ink">Shape decisions.</p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">Curated from trusted Indian press sources.</p>
      </div>
    </aside>
  );
  return (
    <div className="min-h-dvh bg-bg p-2 sm:p-4">
      <div className="mx-auto flex min-h-[calc(100dvh-1rem)] max-w-[1280px] overflow-hidden rounded-[28px] bg-surface shadow-[var(--shadow-border)] sm:min-h-[calc(100dvh-2rem)]">
        <div className="hidden lg:block">{sidebar}</div>
        {menu && <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMenu(false)}><div className="absolute inset-0 bg-ink/30" /><div className="relative h-full w-[232px] bg-surface" onClick={(e) => e.stopPropagation()}>{sidebar}</div></div>}
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
          <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <button type="button" className="mt-1 rounded-lg p-1.5 text-muted hover:bg-surface-2 lg:hidden" onClick={() => setMenu(true)} aria-label="Menu"><Menu className="size-5" /></button>
              <div>
                <h1 className="text-[28px] font-semibold tracking-tight text-ink">Press Digest</h1>
                <p className="mt-1 max-w-xl text-sm text-muted">Curated stories from India's press on policy, diplomacy & public affairs</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ViewersBadge />
              <div className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-1.5 text-sm text-ink-soft">
                <button type="button" className="rounded-full p-1 hover:bg-surface-2" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft className="size-4" /></button>
                <Calendar className="size-4 text-muted" />
                <span className="px-1 tabular-nums">{formatChipDate(focus)}</span>
                <button type="button" className="rounded-full p-1 hover:bg-surface-2 disabled:opacity-30" disabled={to >= today} onClick={() => step(1)} aria-label="Next"><ChevronRight className="size-4" /></button>
              </div>
            </div>
          </header>
          {view === "feed" && (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {SOURCES.map(({ id, label, Icon }) => (
                  <button key={id} type="button" onClick={() => { setSource(id); setVisible(PAGE); setTopic("all"); }} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium", source === id ? "bg-violet-soft text-violet" : "text-muted hover:bg-surface-2")}>
                    <Icon className="size-3.5" /> {label}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-1">
                  {(["day", "week", "month"] as Mode[]).map((m) => (
                    <button key={m} type="button" onClick={() => { setMode(m); setVisible(PAGE); }} className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium capitalize", mode === m ? "bg-ink text-paper" : "text-faint hover:text-ink")}>{m}</button>
                  ))}
                  <button type="button" onClick={() => list.refetch()} className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted hover:bg-surface-2">
                    <RefreshCw className={cn("size-3.5", list.isFetching && "animate-spin")} /> Refresh feed
                  </button>
                  <button type="button" onClick={() => setShowFilter((v) => !v)} className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-2" aria-label="Filters"><Filter className="size-4" /></button>
                  <button type="button" disabled={pdfMut.isPending || shown.length === 0} onClick={() => pdfMut.mutate(shown.slice(0, MAX_PDF).map((r) => r.prid))} className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-2" aria-label="Download PDF">{pdfMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}</button>
                </div>
              </div>
              <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
                {TOPICS.map((t) => { const Icon = TOPIC_ICON[t.id]; return (
                  <button key={t.id} type="button" onClick={() => { setTopic(t.id); setVisible(PAGE); }} className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium", topic === t.id ? "bg-accent-soft text-accent" : "border border-line bg-surface text-ink-soft hover:bg-surface-2")}>
                    <Icon className="size-3.5" /> {t.label}
                  </button>
                ); })}
              </div>
              {showFilter && (
                <div className="mb-4 grid gap-3 rounded-2xl border border-line p-3 md:grid-cols-[240px_1fr]">
                  <MinistryFilter lang={lang} filter={desk} onChange={setDesk} listingNames={[...countsByName.keys()]} countsByName={countsByName} />
                  <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles" className="h-10 pl-9" /></div>
                </div>
              )}
              {list.isLoading && !list.data && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="mb-3 h-36 rounded-2xl" />)}
              {list.isError && <p className="text-sm text-danger">{list.error instanceof Error ? list.error.message : "Failed to load"}</p>}
              <div className="space-y-3">
                {page.map((r) => {
                  const t = topicForRelease(r.ministry, r.source ?? source);
                  const src = sourceLabel(r.source ?? source);
                  const topicMeta = TOPICS.find((x) => x.id === t)!;
                  const bookmarked = isSaved(r.prid);
                  return (
                    <article key={r.prid} className="list-row relative overflow-hidden rounded-2xl border border-line bg-surface p-4 sm:p-5">
                      <div className="flex gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">{storyClock(r.postedDate)}</span>
                            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-muted">{topicMeta.label}</span>
                          </div>
                          <h2 className="text-[18px] leading-snug font-semibold tracking-tight text-ink sm:text-[20px]">{r.title}</h2>
                          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{r.ministry}</p>
                          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted">
                            <span className="inline-flex items-center gap-1.5"><FileText className="size-3.5" /> {src.short} <span className="text-faint">|</span> {src.full}</span>
                            <button type="button" className="ml-auto inline-flex items-center gap-1 font-medium text-ink hover:text-accent" onClick={() => openMut.mutate(r)}>{openMut.isPending ? "Opening\u2026" : "Read more"} <ArrowRight className="size-3.5" /></button>
                          </div>
                        </div>
                        <StoryArt topic={t} className="hidden h-[132px] w-[200px] shrink-0 sm:block" />
                      </div>
                      <button type="button" onClick={() => bookmark(r)} className="absolute top-4 right-4 text-faint hover:text-violet" aria-label="Save"><Bookmark className={cn("size-4", bookmarked && "fill-violet text-violet")} /></button>
                    </article>
                  );
                })}
              </div>
              {shown.length > visible && <button type="button" onClick={() => setVisible((n) => n + PAGE)} className="mt-4 w-full rounded-2xl border border-line py-3 text-sm font-medium text-ink-soft hover:bg-surface-2">View older stories \u2192</button>}
              {shown.length > 0 && shown.length <= visible && <p className="mt-5 rounded-2xl bg-violet-soft px-4 py-3 text-sm text-ink-soft">That\u2019s all for now. Come back later for more curated stories.</p>}
              {!list.isLoading && shown.length === 0 && <p className="py-16 text-center text-sm text-muted">No releases in this window. Try another day or topic.</p>}
            </>
          )}
          {view === "saved" && <LibraryList title="Saved" empty="Bookmarks you save from the feed live here." items={savedItems} onOpen={(item) => openMut.mutate(item)} onToggle={bookmark} />}
          {view === "history" && <LibraryList title="History" empty="Stories you open will show up here." items={historyItems} onOpen={(item) => openMut.mutate(item)} onToggle={bookmark} />}
          {view === "insights" && (
            <div>
              <p className="mb-4 text-sm text-muted">Release volume and ministry mix for the selected window.</p>
              <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}><DigestCharts anchor={to} lang={lang} desk={desk} onSelectDesk={setDesk} /></Suspense>
            </div>
          )}
          {view === "settings" && (
            <div className="max-w-md space-y-4">
              <p className="text-sm text-muted">Language for titles and ministry names.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setLang(1)} className={cn("h-10 rounded-full px-4 text-sm font-medium", lang === 1 ? "bg-accent text-accent-fg" : "border border-line")}>English</button>
                <button type="button" onClick={() => setLang(2)} className={cn("h-10 rounded-full px-4 text-sm font-medium", lang === 2 ? "bg-accent text-accent-fg" : "border border-line")}>\u0939\u093f\u0928\u094d\u0926\u0940</button>
              </div>
            </div>
          )}
          {view === "help" && (
            <div className="max-w-lg space-y-3 text-sm leading-relaxed text-ink-soft">
              <p>Press Digest pulls official releases from PIB, MEA (press + bilaterals) and News on Air.</p>
              <p>Open a story to read it with images and tables, or download a PDF of the day\u2019s brief.</p>
              <p>Bookmark with the ribbon on each card. Insights shows volume by day, week and month.</p>
            </div>
          )}
        </main>
      </div>
      {reader && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 p-3 sm:p-8" onClick={() => setReader(null)}>
          <article className="mx-auto max-w-2xl rounded-3xl bg-paper p-6 shadow-xl sm:p-9" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-accent uppercase">{reader.ministry}</p>
                <h2 className="mt-1 text-2xl font-semibold leading-snug">{reader.title}</h2>
                <p className="mt-1 text-sm text-muted">{reader.postedOn}</p>
              </div>
              <button type="button" className="rounded-full p-2 text-muted hover:bg-surface-2" onClick={() => setReader(null)} aria-label="Close"><X className="size-4" /></button>
            </div>
            <div className="space-y-4 text-[15px] leading-7 text-ink-soft">
              {blocksOf(reader).map((b, i) => b.type === "p" ? <p key={i}>{b.text}</p> : b.type === "image" ? (
                <figure key={i}><img src={b.dataUrl || b.src} alt={b.alt} loading="lazy" decoding="async" className="w-full rounded-xl" />{b.alt ? <figcaption className="mt-1 text-xs text-muted">{b.alt}</figcaption> : null}</figure>
              ) : (
                <div key={i} className="overflow-x-auto"><table className="w-full border-collapse text-sm"><tbody>{b.rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="border border-line px-2 py-1">{cell}</td>)}</tr>)}</tbody></table></div>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              <Button size="sm" onClick={() => pdfMut.mutate([reader.prid])}>Download PDF</Button>
              {reader.url ? <a className="inline-flex h-9 items-center rounded-full border border-line px-3 text-sm" href={reader.url} target="_blank" rel="noreferrer">Source</a> : null}
            </div>
          </article>
        </div>
      )}
    </div>
  );
}

function LibraryList({ title, empty, items, onOpen, onToggle }: { title: string; empty: string; items: LibraryItem[]; onOpen: (item: LibraryItem) => void; onToggle: (item: LibraryItem) => void }) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {items.length === 0 && <p className="text-sm text-muted">{empty}</p>}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.prid} className="flex items-start gap-3 rounded-2xl border border-line p-4">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(item)}>
              <p className="font-medium text-ink">{item.title}</p>
              <p className="mt-1 text-xs text-muted">{item.ministry} \u00b7 {item.postedDate}</p>
            </button>
            <button type="button" onClick={() => onToggle(item)} className="text-faint hover:text-violet" aria-label="Save"><Bookmark className={cn("size-4", isSaved(item.prid) && "fill-violet text-violet")} /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}
