import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-cyan-400/90 px-4 py-2 text-slate-950 shadow-lg shadow-cyan-900/30 hover:bg-cyan-300",
        secondary:
          "bg-white/10 px-4 py-2 text-slate-100 hover:bg-white/20 border border-white/20",
        ghost: "px-3 py-2 text-slate-300 hover:bg-white/10 hover:text-slate-100",
        danger:
          "bg-rose-500/85 px-4 py-2 text-white shadow-lg shadow-rose-900/40 hover:bg-rose-400",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10",
        lg: "h-11 px-5 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
