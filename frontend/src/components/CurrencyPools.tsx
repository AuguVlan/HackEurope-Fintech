import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { ArrowRightLeft, Euro, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, Badge } from './ui';
import { formatCurrency } from '../lib/utils';

/* ───────────── Simulated data generators ───────────── */

/** Generate 30 days of realistic EUR/TRY rate history around ~36.5 */
function generateFxHistory(days = 30): { date: string; rate: number }[] {
  const data: { date: string; rate: number }[] = [];
  let rate = 34.8;
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    // Random walk with slight upward drift (TRY weakening)
    rate += (Math.random() - 0.47) * 0.35;
    rate = Math.max(33.5, Math.min(38.0, rate));
    data.push({
      date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      rate: parseFloat(rate.toFixed(4)),
    });
  }
  return data;
}

/** Simulated pool balances (minor units = cents/kuruş) — aligned with mockAccounts */
function generatePoolData() {
  const eurBalance = 7_200_000 + Math.floor(Math.random() * 600_000);    // ~€72,000–€78,000
  const tryBalance = 72_000_000 + Math.floor(Math.random() * 6_000_000); // ~₺720,000–₺780,000
  return { eurBalance, tryBalance };
}

/* ───────────── Helpers ───────────── */

const COLORS = {
  eur: '#38bdf8',    // sky-400
  try: '#a855f7',    // violet-500
  eurGlow: 'rgba(56,189,248,0.25)',
  tryGlow: 'rgba(168,85,247,0.25)',
};

const PIE_COLORS = [COLORS.eur, COLORS.try];

const formatTRY = (v: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(v / 100);

const formatEUR = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v / 100);

/* ───────────── Component ───────────── */

export const CurrencyPools: React.FC = () => {
  const fxHistory = useMemo(() => generateFxHistory(30), []);
  const { eurBalance, tryBalance } = useMemo(() => generatePoolData(), []);

  const currentRate = fxHistory[fxHistory.length - 1].rate;
  const prevRate = fxHistory[fxHistory.length - 2].rate;
  const rateChange = currentRate - prevRate;
  const rateChangePct = ((rateChange / prevRate) * 100).toFixed(2);
  const rateUp = rateChange >= 0;

  // Convert TRY pool to EUR-equivalent for the pie chart
  const tryInEur = Math.round(tryBalance / currentRate);
  const totalEurEquiv = eurBalance + tryInEur;

  const pieData = [
    { name: 'EUR', value: eurBalance, color: COLORS.eur },
    { name: 'TRY', value: tryInEur, color: COLORS.try },
  ];

  const eurPct = totalEurEquiv > 0 ? ((eurBalance / totalEurEquiv) * 100).toFixed(1) : '0';
  const tryPct = totalEurEquiv > 0 ? ((tryInEur / totalEurEquiv) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* ── Two Pool Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* EUR Pool */}
        <Card className="relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-10 blur-2xl"
               style={{ background: COLORS.eur }} />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                 style={{ background: 'rgba(56,189,248,0.12)', color: COLORS.eur }}>
              €
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">EUR Pool</p>
              <p className="text-2xl font-bold tracking-tight" style={{ color: COLORS.eur }}>
                {formatEUR(eurBalance)}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{Math.floor(eurBalance / 100).toLocaleString()} EUR available</span>
            <Badge variant="info">{eurPct}% of total</Badge>
          </div>
        </Card>

        {/* TRY Pool */}
        <Card className="relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-10 blur-2xl"
               style={{ background: COLORS.try }} />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                 style={{ background: 'rgba(168,85,247,0.12)', color: COLORS.try }}>
              ₺
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">TRY Pool</p>
              <p className="text-2xl font-bold tracking-tight" style={{ color: COLORS.try }}>
                {formatTRY(tryBalance)}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>≈ {formatEUR(tryInEur)} equivalent</span>
            <Badge variant="warning">{tryPct}% of total</Badge>
          </div>
        </Card>
      </div>

      {/* ── FX Rate + Line Chart + Pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FX Rate Card with Line Chart (2/3 width) */}
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between mb-1">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  EUR / TRY Exchange Rate
                </h3>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold tracking-tight">{currentRate.toFixed(4)}</span>
                <div className={`flex items-center gap-1 text-sm font-semibold ${rateUp ? 'text-red-400' : 'text-green-400'}`}>
                  {rateUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {rateUp ? '+' : ''}{rateChangePct}%
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                1 EUR = {currentRate.toFixed(2)} TRY &nbsp;·&nbsp; 1 TRY = {(1 / currentRate).toFixed(4)} EUR
              </p>
            </div>
            <Badge variant={rateUp ? 'danger' : 'success'}>
              {rateUp ? 'TRY weakening' : 'TRY strengthening'}
            </Badge>
          </div>

          <div className="h-56 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fxHistory} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fxGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.eur} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={COLORS.eur} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#6b6b80', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  tickLine={false}
                  interval={4}
                />
                <YAxis
                  domain={['dataMin - 0.3', 'dataMax + 0.3']}
                  tick={{ fill: '#6b6b80', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => v.toFixed(1)}
                  width={45}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(10,10,16,0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    color: '#f0f0f5',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#6b6b80' }}
                  formatter={(value: number) => [`${value.toFixed(4)} TRY`, 'Rate']}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke={COLORS.eur}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: COLORS.eur, stroke: '#000', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center gap-6 mt-3 text-xs text-muted-foreground">
            <span>30-day range: {Math.min(...fxHistory.map(d => d.rate)).toFixed(2)} – {Math.max(...fxHistory.map(d => d.rate)).toFixed(2)}</span>
            <span>Avg: {(fxHistory.reduce((s, d) => s + d.rate, 0) / fxHistory.length).toFixed(2)}</span>
          </div>
        </Card>

        {/* Pie Chart — Asset Repartition (1/3 width) */}
        <Card>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Asset Repartition
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Total equivalent: {formatEUR(totalEurEquiv)}
          </p>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                  isAnimationActive={true}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(10,10,16,0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    color: '#f0f0f5',
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    `${formatEUR(value)} (${totalEurEquiv > 0 ? ((value / totalEurEquiv) * 100).toFixed(1) : 0}%)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="space-y-3 mt-2">
            {pieData.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: entry.color }} />
                  <span className="text-sm font-medium">{entry.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold">
                    {formatEUR(entry.value)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {totalEurEquiv > 0 ? ((entry.value / totalEurEquiv) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
