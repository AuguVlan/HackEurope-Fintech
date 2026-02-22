import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, Stat } from './ui';
import { formatCurrency, formatUSD } from '../lib/utils';
import { FileText, CheckCircle2, TrendingUp, Clock } from 'lucide-react';
import type { IngestionCreditLog, Metrics } from '../hooks/api';

interface MetricsPanelProps {
  metrics: Metrics;
  creditLog?: IngestionCreditLog[];
  isLoading?: boolean;
}

const EXPOSURE_COLORS = ['#22c55e', '#38bdf8', '#525252'];
const LOAN_COLORS = ['#34d399', '#f59e0b', '#f43f5e', '#525252'];

export const MetricsPanel: React.FC<MetricsPanelProps> = ({ metrics, creditLog = [], isLoading }) => {
  const compressionRatio = metrics.gross_usd_cents_open > 0
    ? Math.round(((metrics.gross_usd_cents_open - metrics.net_usd_cents_if_settle_now) / metrics.gross_usd_cents_open) * 100)
    : 0;

  const grossExposure = Math.max(metrics.gross_usd_cents_open || 0, 0);
  const netExposure = Math.max(metrics.net_usd_cents_if_settle_now || 0, 0);
  const compressedExposure = Math.max(grossExposure - netExposure, 0);
  const hasExposure = grossExposure > 0 || netExposure > 0;

  const exposureChartData = hasExposure
    ? [
        { name: 'Net Exposure', value: netExposure },
        { name: 'Compressed', value: compressedExposure },
      ]
    : [{ name: 'No Exposure', value: 1 }];

  const bucketTotals = creditLog.reduce(
    (acc, row) => {
      const amount = Math.max(row.advance_minor || 0, 0);
      if (amount < 35_000) {
        acc.small += amount;
      } else if (amount < 55_000) {
        acc.medium += amount;
      } else {
        acc.large += amount;
      }
      return acc;
    },
    { small: 0, medium: 0, large: 0 }
  );

  const totalGrantedExposure = bucketTotals.small + bucketTotals.medium + bucketTotals.large;
  const hasLoanExposure = totalGrantedExposure > 0;
  const avgExposurePerLoan = creditLog.length > 0 ? Math.round(totalGrantedExposure / creditLog.length) : 0;
  const loanExposureData = hasLoanExposure
    ? [
        { name: 'Small (<350 EUR)', value: bucketTotals.small },
        { name: 'Medium (350-550 EUR)', value: bucketTotals.medium },
        { name: 'Large (>=550 EUR)', value: bucketTotals.large },
      ].filter((row) => row.value > 0)
    : [{ name: 'No Loans', value: 1 }];

  const exposureTotal = exposureChartData.reduce((sum, row) => sum + Number(row.value || 0), 0);
  const loanTotal = loanExposureData.reduce((sum, row) => sum + Number(row.value || 0), 0);

  if (isLoading) {
    return (
      <Card className="col-span-1">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted/10 rounded-lg animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="col-span-1">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Key Metrics</h3>
      </div>

      <div className="space-y-6">
        <Stat
          label="Gross Exposure"
          value={formatUSD(metrics.gross_usd_cents_open)}
          icon={<FileText className="w-4 h-4 text-primary" />}
        />

        <Stat
          label="Net Exposure"
          value={formatUSD(metrics.net_usd_cents_if_settle_now)}
          icon={<TrendingUp className="w-4 h-4 text-secondary" />}
        />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border/20 p-3">
            <p className="text-muted-foreground text-xs mb-2">Exposure Mix</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={exposureChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={60}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {exposureChartData.map((entry, idx) => (
                      <Cell key={entry.name} fill={EXPOSURE_COLORS[idx % EXPOSURE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name: string, item: any) => {
                      const numeric = Number(value || 0);
                      const pct = exposureTotal > 0 ? (numeric / exposureTotal) * 100 : 0;
                      return [
                        item?.payload?.name === 'No Exposure'
                          ? '-'
                          : `${formatUSD(numeric)} (${pct.toFixed(1)}%)`,
                        item?.payload?.name || 'Segment',
                      ];
                    }}
                    contentStyle={{
                      background: 'rgba(10, 10, 10, 0.95)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 10,
                      color: '#fafafa',
                    }}
                    labelStyle={{ color: '#a3a3a3' }}
                    itemStyle={{ color: '#fafafa' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1">
              {exposureChartData.map((row) => (
                <div key={row.name} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{row.name}</span>
                  <span className="font-medium">
                    {row.name === 'No Exposure' ? '-' : formatUSD(row.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/20 p-3">
            <p className="text-muted-foreground text-xs mb-2">Exposure per Loan Granted</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={loanExposureData}
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={60}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {loanExposureData.map((entry, idx) => (
                      <Cell key={entry.name} fill={LOAN_COLORS[idx % LOAN_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name: string, item: any) => {
                      const numeric = Number(value || 0);
                      const pct = loanTotal > 0 ? (numeric / loanTotal) * 100 : 0;
                      return [
                        item?.payload?.name === 'No Loans'
                          ? '-'
                          : `${formatCurrency(numeric, 'EUR')} (${pct.toFixed(1)}%)`,
                        item?.payload?.name || 'Segment',
                      ];
                    }}
                    contentStyle={{
                      background: 'rgba(10, 10, 10, 0.95)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 10,
                      color: '#fafafa',
                    }}
                    labelStyle={{ color: '#a3a3a3' }}
                    itemStyle={{ color: '#fafafa' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1">
              {loanExposureData.map((row) => (
                <div key={row.name} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{row.name}</span>
                  <span className="font-medium">
                    {row.name === 'No Loans' ? '-' : formatCurrency(row.value, 'EUR')}
                  </span>
                </div>
              ))}
              <div className="pt-1 mt-1 border-t border-border/20 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Avg per loan</span>
                <span className="font-medium">{formatCurrency(avgExposurePerLoan, 'EUR')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border/20">
          <Stat
            label="Queued Payouts"
            value={metrics.queued_count.toString()} // Stat likely expects a string
            icon={<Clock className="w-4 h-4 text-yellow-400" />}
          />
        </div>

        <div className="border-t border-border/20 pt-4">
          <Stat
            label="Compression Efficiency"
            value={`${compressionRatio}%`}
            icon={<CheckCircle2 className="w-4 h-4 text-secondary" />}
          />
        </div>

        {metrics.transactions_today !== undefined && (
          <div className="border-t border-border/20 pt-4">
            <Stat
              label="Transactions Today"
              value={metrics.transactions_today.toString()}
              icon={<CheckCircle2 className="w-4 h-4 text-secondary" />}
            />
          </div>
        )}
      </div>
    </Card>
  );
};
