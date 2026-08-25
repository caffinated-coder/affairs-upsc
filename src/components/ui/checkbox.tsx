import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root className={cn("grid size-5 shrink-0 place-items-center rounded-sm border border-line-strong bg-surface-2 data-[state=checked]:bg-accent data-[state=checked]:text-accent-fg outline-none focus-visible:ring-2", className)} {...props}>
      <CheckboxPrimitive.Indicator><Check className="size-3.5" strokeWidth={3} /></CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
