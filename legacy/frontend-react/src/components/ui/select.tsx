import type { SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-2xl border border-white/15 bg-slate-900/70 px-3 text-sm text-slate-100 outline-none ring-cyan-300/35 focus:ring-2",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
