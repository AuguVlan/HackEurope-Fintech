import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from './ui'; // Ensure Card is exported from ./ui/index.ts
import { formatCurrency, calculatePercentageChange, generateSparklineData } from '../lib/utils';

// 1. Unified Interfaces
interface BalanceCardProps {
  currency: string;
  total: number;
  previousTotal?: number;
  history?: number[];
  accounts?: number;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({ 
  currency, 
  total, 
  previousTotal = 0, 
  history = [0, 0, 0, 0], // Default history to avoid SVG errors
  accounts = 1 
}) => {
  const change = calculatePercentageChange(total, previousTotal);
  const isPositive = total >= previousTotal;

  return (
    <Card className="p-6"> {/* Use the actual Card component from your UI */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{currency} Balance</p>
          <h3 className="text-2xl font-bold">{formatCurrency(total, currency)}</h3>
        </div>
        <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          {change}
        </div>
      </div>
      
      {/* Sparkline */}
      <div className="h-12 w-full mb-4">
        <svg viewBox="0 0 100 30" className="w-full h-full stroke-primary fill-none opacity-50">
          <polyline 
            strokeWidth="2"
            points={generateSparklineData(history, 100, 30)} 
          />
        </svg>
      </div>
      
      <p className="text-xs text-muted-foreground">{accounts} Linked Accounts</p>
    </Card>
  );
};

interface CurrencyTotal {
  currency: string;
  total: number;
  accounts: number;
  history?: number[]; // Added to pass to BalanceCard
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
          <Card key={i} className="h-40 animate-pulse bg-muted/20" />
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
          history={item.history || [20, 40, 35, 50]} // Mock history if missing
        />
      ))}
    </div>
  );
};