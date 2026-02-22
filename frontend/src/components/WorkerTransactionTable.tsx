import React, { useState } from 'react';
import { ChevronDown, Search, Filter } from 'lucide-react';
import { Card, Button, Badge } from './ui';
import type { Account } from '../hooks/api';

export interface Transaction {
  id: number;
  timestamp: number;
  type: string;
  from_account?: string;
  to_account?: string;
  amount_minor: number;
  amount_usd_cents?: number;
  currency: string;
  status: string;
  idempotency_key?: string;
  direction?: string;
  source?: string;
}

interface WorkerTransactionTableProps {
  transactions: Transaction[];
  accounts: Account[];
  isLoading?: boolean;
  onRowClick?: (transaction: Transaction) => void;
}

const fmtTimestamp = (ts: number) => {
  const millis = ts < 10_000_000_000 ? ts * 1000 : ts;
  return new Date(millis).toLocaleString();
};

const fmtAmount = (amountMinor: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amountMinor / 100);
};

export const WorkerTransactionTable: React.FC<WorkerTransactionTableProps> = ({
  transactions,
  accounts,
  isLoading,
  onRowClick,
}) => {
  void accounts;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = transactions.filter((t) => {
    if (search && !t.from_account?.includes(search) && !t.to_account?.includes(search)) {
      return false;
    }
    if (statusFilter && t.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  if (isLoading) {
    return (
      <Card>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-muted/10 rounded-lg animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Transaction History</h2>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by account..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input-field pl-10"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input-field pl-10 appearance-none pr-8"
            >
              <option value="">All Status</option>
              <option value="EXECUTED">Executed</option>
              <option value="QUEUED">Queued</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/20">
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Timestamp</th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">From Account</th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">To Account</th>
              <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Amount</th>
              <th className="text-right py-3 px-4 font-semibold text-muted-foreground">USD Exposure</th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Status</th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Type</th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Idempotency Key</th>
              <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Source</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((tx) => (
              <tr
                key={`${tx.id}-${tx.timestamp}`}
                onClick={() => onRowClick?.(tx)}
                className="border-b border-border/20 hover:bg-card/50 transition-colors cursor-pointer"
              >
                <td className="py-3 px-4 text-xs text-muted-foreground">{fmtTimestamp(tx.timestamp)}</td>
                <td className="py-3 px-4 font-mono text-xs">{tx.from_account || '-'}</td>
                <td className="py-3 px-4 font-mono text-xs">{tx.to_account || '-'}</td>
                <td className="py-3 px-4 text-right">{fmtAmount(tx.amount_minor, tx.currency)}</td>
                <td className="py-3 px-4 text-right text-muted-foreground">
                  {tx.amount_usd_cents ? `$${(tx.amount_usd_cents / 100).toFixed(2)}` : '-'}
                </td>
                <td className="py-3 px-4">
                  <Badge variant={tx.status === 'EXECUTED' ? 'success' : tx.status === 'QUEUED' ? 'warning' : 'info'}>
                    {tx.status}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-muted-foreground text-xs">{tx.type}</td>
                <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                  {tx.idempotency_key ? `${tx.idempotency_key.substring(0, 8)}...` : '-'}
                </td>
                <td className="py-3 px-4 text-xs">
                  <Badge variant={tx.source === 'db' ? 'info' : 'success'}>
                    {(tx.source || 'unknown').toUpperCase()}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paginated.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No transactions found</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i + 1} onClick={() => setPage(i + 1)}>
                  {i + 1}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
