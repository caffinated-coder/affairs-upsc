import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { listVolumeFn } from "@/lib/pib/api";
import { readLocalQuery, writeLocalQuery } from "@/lib/pib/local-cache";
import type { VolumeGrain } from "@/lib/pib/dates";
import { ALL_DESK, matchMinistryId, type DeskFilter } from "@/lib/pib/ministries";
import type { ListVolumeResult, PibLang } from "@/lib/pib/types";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const SLICE_COLORS = ["#1e4d45", "#3f6b63", "#6f675c", "#9a9184", "#c4b9a8", "#1c1914", "#3f3a32", "#d9d0c2"];

type Props = { anchor: string; lang: PibLang; desk: DeskFilter; onSelectDesk: (next: DeskFilter) => void };

export function DigestCharts({ anchor, lang, desk, onSelectDesk }: Props) {
  const [grain, setGrain] = useState<VolumeGrain>("day");
  const q = useQuery({
    queryKey: ["volume", grain, anchor, lang],
    queryFn: async () => {
      const data = await listVolumeFn({ data: { to: anchor, grain, lang } });
      writeLocalQuery(`vol:${grain}:${anchor}:${lang}`, data);
      return data;
    },
    placeholderData: () => readLocalQuery<ListVolumeResult>(`vol:${grain}:${anchor}:${lang}`),
    staleTime: 5 * 60 * 1000,
  });
  useEffect(() => { if (q.data) writeLocalQuery(`vol:${grain}:${anchor}:${lang}`, q.data); }, [q.data, grain, anchor, lang]);
  const series = q.data?.series ?? [];
  const desks = (q.data?.desks ?? []).slice(0, 8);
  return (
    <section className="grid gap-4 rounded-xl border border-line bg-surface p-4 md:grid-cols-2">
      <div>
        <div className="mb-2 flex gap-1">
          {(["day", "week", "month"] as VolumeGrain[]).map((g) => (
            <button key={g} type="button" onClick={() => setGrain(g)} className={cn("rounded-full px-3 py-1 text-xs capitalize", grain === g ? "bg-accent text-accent-fg" : "text-muted hover:bg-accent-soft")}>
              {g}
            </button>
          ))}
        </div>
        <p className="mb-2 text-xs text-muted">{q.data ? `${q.data.total} releases` : "Volume"}</p>
        {q.isLoading && !q.data ? <Skeleton className="h-40" /> : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={series}>
              <CartesianGrid stroke="#d9d0c2" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={28} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#1e4d45" fill="#e4ece8" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div>
        <p className="mb-2 text-xs text-muted">By desk</p>
        {q.isLoading && !q.data ? <Skeleton className="h-40" /> : desks.length === 0 ? <p className="text-sm text-muted">No data</p> : (
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={desks} dataKey="count" nameKey="name" innerRadius={36} outerRadius={64} onClick={(d) => {
                const id = matchMinistryId(String((d as { name?: string }).name || ""));
                onSelectDesk(id != null ? { kind: "id", id } : ALL_DESK);
              }}>
                {desks.map((_, i) => <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
