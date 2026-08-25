import { cn } from "@/lib/utils";
export function Input({ className, type, suppressHydrationWarning, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-11 w-full rounded-md border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-faint outline-none focus-visible:ring-2 focus-visible:ring-accent/35 disabled:opacity-50",
        className,
      )}
      suppressHydrationWarning={type === "date" || suppressHydrationWarning}
      {...props}
    />
  );
}
