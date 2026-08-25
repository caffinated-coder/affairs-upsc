import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ALL_DESK, GROUP_LABEL, GROUP_ORDER, MINISTRIES, deskLabel, isAllDesk, matchMinistryId, sameDesk, type DeskFilter } from "@/lib/pib/ministries";
import type { PibLang } from "@/lib/pib/types";
import { cn } from "@/lib/utils";

type Props = { lang: PibLang; filter: DeskFilter; onChange: (next: DeskFilter) => void; listingNames: string[]; countsByName: Map<string, number> };

export function MinistryFilter({ lang, filter, onChange, countsByName }: Props) {
  const [q, setQ] = useState("");
  const total = useMemo(() => [...countsByName.values()].reduce((a, b) => a + b, 0), [countsByName]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return MINISTRIES.filter((m) => !needle || m.en.toLowerCase().includes(needle) || m.shortEn.toLowerCase().includes(needle))
      .map((m) => {
        let count = 0;
        for (const [name, n] of countsByName) if (matchMinistryId(name) === m.id) count += n;
        return { m, count };
      })
      .filter((r) => r.count > 0 || needle);
  }, [q, countsByName]);
  return (
    <aside className="rounded-lg bg-surface p-3 shadow-[var(--shadow-border)]">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">Desk</p>
        <button type="button" className={cn("text-xs", isAllDesk(filter) ? "font-semibold text-accent" : "text-muted")} onClick={() => onChange(ALL_DESK)}>All \u00b7 {total}</button>
      </div>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter desks" className="h-9 pl-7 text-sm" />
      </div>
      <div className="max-h-72 overflow-y-auto overscroll-contain text-sm">
        {GROUP_ORDER.map((group) => {
          const gRows = rows.filter((r) => r.m.group === group);
          if (!gRows.length) return null;
          return (
            <div key={group} className="mb-2">
              <p className="px-1 py-1 text-[10px] tracking-wider text-faint uppercase">{GROUP_LABEL[group].en}</p>
              {gRows.map(({ m, count }) => {
                const active = sameDesk(filter, { kind: "id", id: m.id });
                return (
                  <button key={m.id} type="button" onClick={() => onChange({ kind: "id", id: m.id })} className={cn("flex w-full items-center justify-between rounded-sm px-2 py-1 text-left", active ? "bg-accent-soft text-accent" : "hover:bg-accent-soft/50")}>
                    <span className="truncate">{deskLabel(m, lang)}</span>
                    <span className="ml-2 text-xs text-muted tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
