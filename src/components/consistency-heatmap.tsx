import { useMemo } from "react";
import { heatmapGrid, type HeatCell } from "@/lib/reads";
import { todayIst } from "@/lib/pib/dates";
import type { DigestSource } from "@/lib/pib/types";
import { cn } from "@/lib/utils";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const LEVEL: Record<0 | 1 | 2 | 3 | 4, string> = { 0: "bg-bg-warm", 1: "bg-accent/25", 2: "bg-accent/50", 3: "bg-accent/75", 4: "bg-accent" };
function cellTitle(cell: HeatCell) {
  if (cell.total <= 0 && cell.read <= 0) return `${cell.iso} \u00b7 no data yet`;
  return `${cell.iso} \u00b7 ${cell.read}/${cell.total} read`;
}

export function ConsistencyHeatmap({ source, todayRead, todayTotal, tick }: { source: DigestSource; todayRead: number; todayTotal: number; tick: number }) {
  const today = todayIst();
  const rows = useMemo(() => heatmapGrid(source, 18, today), [source, tick, today]);
  const months = useMemo(() => {
    const first = rows[0] ?? [];
    const labels: { i: number; label: string }[] = [];
    let last = "";
    first.forEach((cell, i) => {
      const label = cell.iso.slice(5, 7);
      if (label !== last) {
        labels.push({ i, label: new Date(`${cell.iso}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }) });
        last = label;
      }
    });
    return labels;
  }, [rows]);
  return (
    <div className="rounded-lg bg-surface p-3 shadow-[var(--shadow-border)]">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">Consistency</p>
        <p className="text-xs tabular-nums text-ink-soft">Today <span className="font-semibold text-accent">{todayRead}</span><span className="text-faint"> / {todayTotal || "\u2013"}</span></p>
      </div>
      <div className="overflow-x-auto">
        <div className="inline-flex gap-1">
          <div className="flex flex-col gap-[3px] pt-4">
            {DAYS.map((d, i) => <span key={i} className="h-[11px] w-3 text-[8px] leading-[11px] text-faint">{i % 2 === 0 ? d : ""}</span>)}
          </div>
          <div>
            <div className="relative mb-1 h-3">
              {months.map((m) => <span key={m.i} className="absolute text-[9px] text-faint" style={{ left: m.i * 14 }}>{m.label}</span>)}
            </div>
            <div className="flex flex-col gap-[3px]">
              {rows.map((row, ri) => (
                <div key={ri} className="flex gap-[3px]">
                  {row.map((cell) => <span key={cell.iso} title={cellTitle(cell)} className={cn("size-[11px] rounded-[2px]", cell.iso > today ? "bg-transparent" : LEVEL[cell.level])} />)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-faint">Less{([0, 1, 2, 3, 4] as const).map((n) => <span key={n} className={cn("size-[11px] rounded-[2px]", LEVEL[n])} />)}More</div>
    </div>
  );
}
