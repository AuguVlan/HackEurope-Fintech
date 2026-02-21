import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, Stat } from './ui';
import { formatCurrency, calculatePercentageChange, generateSparklineData } from '../lib/utils';
import { cn } from '../lib/cn';

interface BalanceCardProps {
  currency: string;
  total: number;
  accounts?: number;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({ currency, total, accounts = 1 }) => {
  const change = calculatePercentageChange();
  const sparklineData = generateSparklineData().map((value, index) => ({
    index,
    value: 50 + value,
  }));

  return (
    <Card className="col-span-1">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-muted-foreground text-sm mb-1">Total {currency}</p>
          <h3 className="text-2xl font-bold text-foreground">{formatCurrency(total, currency)}</h3>
        </div>
        <div className={cn('rounded-lg p-2', change >= 0 ? 'bg-secondary/10' : 'bg-destructive/10')}>
          {change >= 0 ? (
            <TrendingUp className="w-5 h-5 text-secondary" />
          ) : (
            <TrendingDown className="w-5 h-5 text-destructive" />
          )}
        </div>
      </div>

      <div className="h-12 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparklineData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={change >= 0 ? '#2ecc71' : '#e74c3c'}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{accounts} pool{accounts !== 1 ? 's' : ''}</span>
        <span className={cn(change >= 0 ? 'text-secondary' : 'text-destructive')}>
          {change > 0 ? '+' : ''}{change.toFixed(1)}% this month
        </span>
      </div>
    </Card>
  );
};

interface CurrencyTotal {
  currency: string;
  total: number;
  accounts: number;
}

interface BalanceGridProps {
  data: CurrencyTotal[];
  isLoading?: boolean;
}

export const BalanceGrid: React.FC<BalanceGridProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="h-48 animate-pulse bg-muted/10" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      {data.map((item) => (
        <BalanceCard
          key={item.currency}
          currency={item.currency}
          total={item.total}
          accounts={item.accounts}
        />
      ))}
    </div>
  );
};
