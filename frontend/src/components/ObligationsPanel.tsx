import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, Button, Badge, Progress } from './ui';
import { formatUSD, formatNumber } from '../lib/utils';
import type { Obligation } from '../hooks/api';

interface ObligationsPanelProps {
  obligations: Obligation[];
  grossUsdCents: number;
  netUsdCents: number;
  isLoading?: boolean;
  onSettleClick?: () => void;
  isSettling?: boolean;
  settleError?: string | null;
}

export const ObligationsPanel: React.FC<ObligationsPanelProps> = ({
  obligations,
  grossUsdCents,
  netUsdCents,
  isLoading,
  onSettleClick,
  isSettling,
  settleError,
}) => {
  // Group obligations by pool pair
  const poolPairs = new Map<string, number>();
  obligations.forEach((o) => {
    const key = [o.from_pool, o.to_pool].sort().join('|');
    poolPairs.set(key, (poolPairs.get(key) || 0) + o.amount_usd_cents);
  });

  const topPairs = Array.from(poolPairs.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const compressionRatio = grossUsdCents > 0 ? Math.round(((grossUsdCents - netUsdCents) / grossUsdCents) * 100) : 0;
  const isHealthy = netUsdCents < grossUsdCents * 0.2;

  if (isLoading) {
    return (
      <Card className="col-span-1 lg:col-span-2">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-muted/10 rounded-lg animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 lg:col-span-2">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold mb-1">Open Obligations</h3>
          <p className="text-muted-foreground text-sm">Settlement exposure across pools</p>
        </div>
        <div className={`rounded-lg p-2 ${isHealthy ? 'bg-secondary/10' : 'bg-destructive/10'}`}>
          {isHealthy ? (
            <CheckCircle2 className="w-5 h-5 text-secondary" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-destructive" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card/50 rounded-xl p-3 border border-border/20">
          <p className="text-muted-foreground text-xs mb-1">Gross Exposure</p>
          <p className="text-lg font-bold text-foreground">{formatUSD(grossUsdCents)}</p>
        </div>
        <div className="bg-card/50 rounded-xl p-3 border border-border/20">
          <p className="text-muted-foreground text-xs mb-1">Net Exposure</p>
          <p className="text-lg font-bold text-foreground">{formatUSD(netUsdCents)}</p>
        </div>
        <div className="bg-card/50 rounded-xl p-3 border border-border/20">
          <p className="text-muted-foreground text-xs mb-1">Compression</p>
          <p className="text-lg font-bold text-secondary">{compressionRatio}%</p>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="text-sm font-semibold mb-3">Top Pool Pairs</h4>
        <div className="space-y-2">
          {topPairs.length > 0 ? (
            topPairs.map(([key, amount]) => {
              const [pool1, pool2] = key.split('|');
              return (
                <div key={key} className="flex items-center justify-between py-2 border-b border-border/10 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">
                      <span className="font-mono font-semibold">{pool1}</span>
                      <span className="text-muted-foreground mx-2">↔</span>
                      <span className="font-mono font-semibold">{pool2}</span>
                    </span>
                  </div>
                  <Badge variant="info">{formatUSD(amount)}</Badge>
                </div>
              );
            })
          ) : (
            <p className="text-muted-foreground text-sm">No active obligations</p>
          )}
        </div>
      </div>

      <Button
        variant="secondary"
        className="w-full"
        onClick={onSettleClick}
        disabled={Boolean(isSettling || isLoading)}
      >
        {isSettling ? 'Settling...' : 'Run Settlement'}
      </Button>
      {settleError && (
        <p className="mt-2 text-sm text-destructive">{settleError}</p>
      )}
    </Card>
  );
};
