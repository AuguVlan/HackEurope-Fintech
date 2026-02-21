import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-2xl border border-white/15 bg-slate-900/70 px-3 text-sm text-slate-100 outline-none ring-cyan-300/35 placeholder:text-slate-500 focus:ring-2",
        className,
      )}
      {...props}
    />
  );
}
