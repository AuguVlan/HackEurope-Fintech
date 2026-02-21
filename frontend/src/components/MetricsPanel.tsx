import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, Stat } from './ui';
import { formatUSD } from '../lib/utils';
import { Send, FileText, CheckCircle2, TrendingUp, Clock } from 'lucide-react';
import type { Metrics } from '../hooks/api';

interface MetricsPanelProps {
  metrics: Metrics;
  isLoading?: boolean;
}

const COLORS = ['#2ecc71', '#3498db', '#e74c3c', '#f39c12'];

export const MetricsPanel: React.FC<MetricsPanelProps> = ({ metrics, isLoading }) => {
  // Logic remains the same
  const compressionRatio = metrics.gross_usd_cents_open > 0
    ? Math.round(((metrics.gross_usd_cents_open - metrics.net_usd_cents_if_settle_now) / metrics.gross_usd_cents_open) * 100)
    : 0;

  const chartData = [
    { name: 'Compression Saved', value: compressionRatio },
    { name: 'Net Exposure', value: 100 - compressionRatio },
  ];

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

        <div>
          <p className="text-muted-foreground text-sm mb-2">Settlement Compression</p>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      dataKey="value"
                      startAngle={90}
                      endAngle={450}
                      isAnimationActive={false} // Faster rendering for hackathons
                    >
                      <Cell fill="#2ecc71" />
                      <Cell fill="#444" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-secondary">{compressionRatio}%</p>
              <p className="text-xs text-muted-foreground">efficiency</p>
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