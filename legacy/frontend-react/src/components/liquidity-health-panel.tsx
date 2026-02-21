import { AlertCircle, ShieldCheck } from "lucide-react";
import type { Account } from "../api";
import { cn } from "../lib/cn";
import { formatMinor } from "../lib/format";
import { Badge, Card } from "./ui";

interface LiquidityHealthPanelProps {
  accounts: Account[];
}

type HealthLevel = "Healthy" | "Warning" | "Critical";

function healthFor(account: Account): HealthLevel {
  if (account.balance_minor < account.min_buffer_minor) return "Critical";
  if (account.balance_minor < account.min_buffer_minor * 1.25) return "Warning";
  return "Healthy";
}

function utilization(account: Account): number {
  if (account.min_buffer_minor <= 0) return 100;
  return (account.balance_minor / account.min_buffer_minor) * 100;
}

export function LiquidityHealthPanel({ accounts }: LiquidityHealthPanelProps) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Liquidity Health</h2>
          <p className="text-sm text-slate-400">
            Pool buffers and utilization thresholds
          </p>
        </div>
        <ShieldCheck className="h-5 w-5 text-cyan-300" />
      </div>

      <div className="space-y-3">
        {accounts.map((account) => {
          const level = healthFor(account);
          const usage = utilization(account);
          return (
            <article
              key={account.id}
              className={cn(
                "rounded-2xl border bg-slate-900/45 p-3",
                level === "Critical" ? "border-rose-400/45" : "border-white/10",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-xs text-slate-300">{account.id}</p>
                <Badge
                  variant={
                    level === "Healthy"
                      ? "success"
                      : level === "Warning"
                        ? "warning"
                        : "danger"
                  }
                >
                  {level}
                </Badge>
              </div>
              <div className="mt-2 grid gap-1 text-sm md:grid-cols-3">
                <p className="text-slate-300">
                  Balance:{" "}
                  <span className="font-semibold text-slate-100">
                    {formatMinor(account.balance_minor, account.currency)}
                  </span>
                </p>
                <p className="text-slate-300">
                  Min Buffer:{" "}
                  <span className="font-semibold text-slate-100">
                    {formatMinor(account.min_buffer_minor, account.currency)}
                  </span>
                </p>
                <p className="text-slate-300">
                  Utilization:{" "}
                  <span className="font-semibold text-slate-100">
                    {usage.toFixed(1)}%
                  </span>
                </p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-800">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all",
                    level === "Healthy" && "bg-emerald-400",
                    level === "Warning" && "bg-amber-400",
                    level === "Critical" && "bg-rose-400",
                  )}
                  style={{ width: `${Math.min(100, usage)}%` }}
                />
              </div>
              {level === "Critical" ? (
                <p className="mt-2 flex items-center gap-1 text-xs text-rose-300">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Below minimum safety buffer.
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </Card>
  );
}
