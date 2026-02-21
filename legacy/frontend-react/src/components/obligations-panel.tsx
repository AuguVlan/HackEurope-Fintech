import { AlertTriangle, CheckCircle2, Scale, Sparkles } from "lucide-react";
import { Button, Card } from "./ui";
import { formatUsdCents } from "../lib/format";
import { cn } from "../lib/cn";

interface PairExposure {
  pair: string;
  usd_cents: number;
}

interface ObligationsPanelProps {
  grossUsdCents: number;
  netUsdCents: number;
  topPairs: PairExposure[];
  isRunning: boolean;
  onRunSettlement: () => void;
}

export function ObligationsPanel({
  grossUsdCents,
  netUsdCents,
  topPairs,
  isRunning,
  onRunSettlement,
}: ObligationsPanelProps) {
  const netShare = grossUsdCents > 0 ? netUsdCents / grossUsdCents : 0;
  const isRisky = netShare > 0.7;

  return (
    <Card className="h-full">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Open Obligations</h2>
          <p className="text-sm text-slate-400">
            Settlement exposure across all pools
          </p>
        </div>
        <div
          className={cn(
            "rounded-2xl border p-2",
            isRisky
              ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
              : "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
          )}
        >
          {isRisky ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-slate-900/55 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Gross Exposure</p>
          <p className="mt-1 text-2xl font-semibold text-slate-50">
            {formatUsdCents(grossUsdCents)}
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-slate-900/55 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Net Exposure</p>
          <p className="mt-1 text-2xl font-semibold text-slate-50">
            {formatUsdCents(netUsdCents)}
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-slate-900/55 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Net Share</p>
          <p className={cn("mt-1 text-2xl font-semibold", isRisky ? "text-rose-300" : "text-emerald-300")}>
            {(netShare * 100).toFixed(1)}%
          </p>
        </article>
      </div>

      <div className="mt-5">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
          <Scale className="h-4 w-4 text-cyan-300" />
          Top Pool Pairs by Exposure
        </p>
        <ul className="space-y-2">
          {topPairs.map((pair) => (
            <li
              key={pair.pair}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/45 px-3 py-2 text-sm"
            >
              <span className="font-mono text-slate-300">{pair.pair}</span>
              <span className="font-semibold text-slate-100">
                {formatUsdCents(pair.usd_cents)}
              </span>
            </li>
          ))}
          {topPairs.length === 0 ? (
            <li className="rounded-2xl border border-white/10 bg-slate-900/45 px-3 py-2 text-sm text-slate-400">
              No open obligations.
            </li>
          ) : null}
        </ul>
      </div>

      <div className="mt-5 flex justify-end">
        <Button onClick={onRunSettlement} disabled={isRunning} className="min-w-36">
          <Sparkles className="h-4 w-4" />
          {isRunning ? "Running..." : "Run Settlement"}
        </Button>
      </div>
    </Card>
  );
}
