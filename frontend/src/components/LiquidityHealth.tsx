import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, Progress } from './ui';
import { formatCurrency, healthStatus, healthStatusClass } from '../lib/utils';
import { cn } from '../lib/cn';
import type { Account } from '../api';

interface LiquidityHealthPanelProps {
  accounts: Account[];
  isLoading?: boolean;
}

export const LiquidityHealthPanel: React.FC<LiquidityHealthPanelProps> = ({ accounts, isLoading }) => {
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

  const sortedAccounts = [...accounts].sort((a, b) => {
    const ratioA = a.balance_minor / a.min_buffer_minor;
    const ratioB = b.balance_minor / b.min_buffer_minor;
    return ratioA - ratioB;
  });

  return (
    <Card className="col-span-1">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-1">Liquidity Health</h3>
        <p className="text-muted-foreground text-sm">Buffer utilization by pool</p>
      </div>

      <div className="space-y-4">
        {sortedAccounts.map((account) => {
          const ratio = account.balance_minor / account.min_buffer_minor;
          const percentage = Math.min(ratio * 100, 100);
          const status = healthStatus(account.balance_minor, account.min_buffer_minor);
          const statusClass = healthStatusClass(account.balance_minor, account.min_buffer_minor);

          return (
            <div key={account.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {status === 'Healthy' ? (
                    <CheckCircle2 className="w-4 h-4 text-secondary" />
                  ) : status === 'Warning' ? (
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-destructive" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">{account.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(account.balance_minor, account.currency)} / {formatCurrency(account.min_buffer_minor, account.currency)} buffer
                    </p>
                  </div>
                </div>
                <div className={cn('badge', statusClass)}>
                  {status}
                </div>
              </div>

              <div className="h-1.5 bg-muted/20 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    ratio >= 5 ? 'bg-secondary' : ratio >= 2 ? 'bg-yellow-500' : 'bg-destructive'
                  )}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>

              <p className="text-xs text-muted-foreground text-right">{ratio.toFixed(1)}x buffer</p>
            </div>
          );
        })}
      </div>

      {accounts.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No pools configured</p>
        </div>
      )}
    </Card>
  );
};
