import { useViewers } from "@/lib/presence/use-viewers";
import { cn } from "@/lib/utils";

export function ViewersBadge({ className }: { className?: string }) {
  const online = useViewers();
  const label = online == null ? "\u2026" : online === 1 ? "1 viewing" : `${online} viewing`;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent", className)} title="People with this page open right now">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
      </span>
      {label}
    </span>
  );
}
