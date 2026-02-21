import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-xl border px-2.5 py-1 text-xs font-semibold tracking-wide",
  {
    variants: {
      variant: {
        success: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
        warning: "border-amber-400/40 bg-amber-500/15 text-amber-300",
        danger: "border-rose-400/45 bg-rose-500/15 text-rose-300",
        info: "border-cyan-400/40 bg-cyan-500/15 text-cyan-300",
        neutral: "border-white/20 bg-white/10 text-slate-200",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
