import { ArrowUpRight, Wallet } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { Card } from "./ui";
import { currencySymbol, formatMinor, formatPercent } from "../lib/format";

export interface CurrencyTotal {
  currency: string;
  total_minor: number;
  pools: number;
  change_percent: number;
  sparkline: number[];
}

interface CurrencyBalanceGridProps {
  totals: CurrencyTotal[];
}

function Sparkline({ values }: { values: number[] }) {
  const data = values.map((value, index) => ({ index, value }));
  return (
    <div className="h-12">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke="#22d3ee"
            strokeWidth={2.3}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CurrencyBalanceGrid({ totals }: CurrencyBalanceGridProps) {
  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {totals.map((item) => (
        <Card key={item.currency}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400">
                Total {item.currency} ({currencySymbol(item.currency)})
              </p>
              <p className="mt-1 text-3xl font-semibold text-slate-50">
                {formatMinor(item.total_minor, item.currency)}
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-2">
              <Wallet className="h-4 w-4 text-cyan-300" />
            </div>
          </div>

          <div className="mt-4">
            <Sparkline values={item.sparkline} />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {item.pools} pool{item.pools === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1 text-sm text-emerald-300">
              <ArrowUpRight className="h-3.5 w-3.5" />
              {formatPercent(item.change_percent)}
            </span>
          </div>
        </Card>
      ))}
    </section>
  );
}
