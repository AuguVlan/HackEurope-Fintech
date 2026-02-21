import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn(
        "glass-card rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  );
}
