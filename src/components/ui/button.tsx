import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-fg shadow-sm hover:bg-accent/90",
        secondary: "bg-surface text-ink shadow-[var(--shadow-border)]",
        outline: "border border-line bg-transparent text-ink hover:bg-accent-soft",
        ghost: "bg-transparent text-ink-soft hover:bg-accent-soft hover:text-ink",
        danger: "bg-danger text-paper hover:bg-danger/90",
      },
      size: {
        default: "h-11 rounded-md px-4 text-sm",
        sm: "h-9 rounded-sm px-3 text-sm",
        lg: "h-12 rounded-md px-5 text-base",
        icon: "size-11 rounded-md",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className, variant, size, asChild = false, ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
