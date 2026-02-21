import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";
import type { Metrics } from "../api";
import { formatUsdCents } from "../lib/format";
import { Card } from "./ui";

interface MetricsPanelProps {
  metrics: Metrics;
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  const ratio = Number.isFinite(metrics.settlement_compression_ratio)
    ? metrics.settlement_compression_ratio
    : 1;
  const radialPercent = Math.min(100, Math.max(0, ((ratio - 1) / 4) * 100));

  return (
    <Card>
      <h2 className="text-xl font-semibold text-slate-100">Key Metrics</h2>
      <p className="text-sm text-slate-400">Compression and settlement KPIs</p>

      <div className="mt-4 grid gap-3">
        <article className="rounded-2xl border border-white/10 bg-slate-900/45 p-3">
          <p className="text-xs uppercase text-slate-400">Gross USD Open</p>
          <p className="mt-1 text-2xl font-semibold text-slate-50">
            {formatUsdCents(metrics.gross_usd_cents_open)}
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-slate-900/45 p-3">
          <p className="text-xs uppercase text-slate-400">Net USD If Settled</p>
          <p className="mt-1 text-2xl font-semibold text-slate-50">
            {formatUsdCents(metrics.net_usd_cents_if_settle_now)}
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-slate-900/45 p-3">
          <p className="text-xs uppercase text-slate-400">Queued Payout Count</p>
          <p className="mt-1 text-2xl font-semibold text-slate-50">
            {metrics.queued_count}
          </p>
        </article>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/45 p-3">
        <p className="text-xs uppercase text-slate-400">Compression Ratio (Gross / Net)</p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-28 w-28">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="68%"
                outerRadius="100%"
                data={[{ value: radialPercent }]}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar
                  background={{ fill: "#1e293b" }}
                  dataKey="value"
                  cornerRadius={10}
                  fill="#22d3ee"
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-3xl font-semibold text-slate-50">{ratio.toFixed(2)}x</p>
            <p className="text-sm text-slate-400">
              Higher is better compression efficiency
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
