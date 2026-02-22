import React, { useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar, Navbar } from './Layout';
import { BalanceGrid } from './BalanceCard';
import { WorkerTransactionTable } from './WorkerTransactionTable';
import { MetricsPanel } from './MetricsPanel';
import { ActivityFeed } from './ActivityFeed';
import { api } from '../hooks/api';
import { useIngestionData } from '../hooks/useApi';
import { Badge, Card } from './ui';
import { CatboostPanel } from './CatboostPanel';
import { CurrencyPools } from './CurrencyPools';
import type { Transaction } from './WorkerTransactionTable';
import { formatCurrency } from '../lib/utils';

const PAYMENT_STATUS_TO_TABLE_STATUS: Record<string, string> = {
  succeeded: 'EXECUTED',
  requires_confirmation: 'PENDING',
  processing: 'PENDING',
  failed: 'FAILED',
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      retryDelay: 3000,
      refetchOnWindowFocus: false,
    },
  },
});

export const DashboardContent: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const workersScrollRef = useRef<HTMLDivElement | null>(null);
  const remittancesScrollRef = useRef<HTMLDivElement | null>(null);
  const workersDragRef = useRef({
    isDown: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const remittancesDragRef = useRef({
    isDown: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  const ingestion = useIngestionData();
  const ledgerState = ingestion.data?.state || { accounts: [], open_obligations: [], queued_payouts: [] };
  const metrics = ingestion.data?.metrics || {
    gross_usd_cents_open: 0,
    net_usd_cents_if_settle_now: 0,
    queued_count: 0,
    transactions_today: 0,
  };
  const creditLog = ingestion.data?.credit_log || [];
  const workers = ingestion.data?.workers || [];
  const remittances = ingestion.data?.recent_remittances || [];
  const stateLoading = ingestion.isLoading;
  const metricsLoading = ingestion.isLoading;

  const currencyTotals = ledgerState.accounts.reduce(
    (acc, account) => {
      const found = acc.find((c) => c.currency === account.currency);
      if (found) {
        found.total += account.balance_minor;
        found.accounts += 1;
      } else {
        acc.push({
          currency: account.currency,
          total: account.balance_minor,
          accounts: 1,
        });
      }
      return acc;
    },
    [] as Array<{ currency: string; total: number; accounts: number }>
  );

  const paymentTransactions: Transaction[] = (ingestion.data?.recent_payments || []).map((payment) => ({
    id: payment.id,
    timestamp: payment.timestamp,
    type: payment.service_type || 'payment',
    from_account: `COMPANY_${payment.company_id}`,
    to_account: `POOL_${payment.country}`,
    amount_minor: payment.amount_minor,
    amount_usd_cents: payment.amount_minor,
    currency: payment.currency,
    status: PAYMENT_STATUS_TO_TABLE_STATUS[payment.status] || String(payment.status).toUpperCase(),
    idempotency_key: payment.idempotency_key,
    source: payment.source || 'unknown',
  }));

  const obligationTransactions: Transaction[] = ledgerState.open_obligations.map((obligation) => ({
    id: obligation.id,
    timestamp: obligation.created_at || Math.floor(Date.now() / 1000),
    type: 'obligation',
    from_account: obligation.from_pool,
    to_account: obligation.to_pool,
    amount_minor: obligation.amount_usd_cents,
    amount_usd_cents: obligation.amount_usd_cents,
    currency: 'USD',
    status: String(obligation.status).toUpperCase(),
    source: 'db',
  }));

  const transactions: Transaction[] =
    paymentTransactions.length > 0 ? paymentTransactions : obligationTransactions;
  const topWorkers = workers;

  const activities = [
    ...(ingestion.data?.settlements || []).slice(0, 4).map((row) => ({
      id: `settlement-${row.id}`,
      type: 'settlement_batch' as const,
      timestamp: Math.floor(new Date(row.created_at).getTime() / 1000),
      data: row,
      description: `${row.from_country} -> ${row.to_country} ${row.status}`,
      icon: 'CheckCircle2',
    })),
    ...(ingestion.data?.recent_payments || []).slice(0, 4).map((payment) => ({
      id: `payment-${payment.id}`,
      type: 'obligation_created' as const,
      timestamp: payment.timestamp,
      data: payment,
      description: `${payment.worker_id} ${payment.status} ${payment.amount_minor / 100} ${payment.currency}`,
      icon: 'FileText',
    })),
  ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 8);

  const handleSettleClick = async () => {
    setSettleError(null);
    setIsSettling(true);
    try {
      const response = await api.runSettlement();
      const data = response.data as { id?: number };
      if (typeof data.id === 'number') {
        queryClient.invalidateQueries({ queryKey: ['ingestionData'] });
        queryClient.invalidateQueries({ queryKey: ['ledgerState'] });
        queryClient.invalidateQueries({ queryKey: ['metrics'] });
      } else {
        setSettleError('Settlement did not return an id.');
      }
    } catch (error: any) {
      const detail = error?.response?.data?.detail || error?.message || 'Settlement failed.';
      setSettleError(String(detail));
    } finally {
      setIsSettling(false);
    }
  };

  const onWorkersMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const el = workersScrollRef.current;
    if (!el) return;
    workersDragRef.current = {
      isDown: true,
      startX: event.pageX - el.offsetLeft,
      startY: event.pageY - el.offsetTop,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
  };

  const onWorkersMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const el = workersScrollRef.current;
    const drag = workersDragRef.current;
    if (!el || !drag.isDown) return;
    event.preventDefault();
    const x = event.pageX - el.offsetLeft;
    const y = event.pageY - el.offsetTop;
    const walkX = x - drag.startX;
    const walkY = y - drag.startY;
    el.scrollLeft = drag.scrollLeft - walkX;
    el.scrollTop = drag.scrollTop - walkY;
  };

  const onWorkersMouseUpOrLeave = () => {
    workersDragRef.current.isDown = false;
  };

  const onRemittancesMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const el = remittancesScrollRef.current;
    if (!el) return;
    remittancesDragRef.current = {
      isDown: true,
      startX: event.pageX - el.offsetLeft,
      startY: event.pageY - el.offsetTop,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
  };

  const onRemittancesMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const el = remittancesScrollRef.current;
    const drag = remittancesDragRef.current;
    if (!el || !drag.isDown) return;
    event.preventDefault();
    const x = event.pageX - el.offsetLeft;
    const y = event.pageY - el.offsetTop;
    const walkX = x - drag.startX;
    const walkY = y - drag.startY;
    el.scrollLeft = drag.scrollLeft - walkX;
    el.scrollTop = drag.scrollTop - walkY;
  };

  const onRemittancesMouseUpOrLeave = () => {
    remittancesDragRef.current.isDown = false;
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col lg:ml-64">
        <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Ledger Dashboard</h1>
              <p className="text-muted-foreground">Real-time view of TideBridge settlement across all pools</p>
            </div>

            <CurrencyPools />
            <BalanceGrid data={currencyTotals} isLoading={stateLoading} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <MetricsPanel
                  metrics={metrics}
                  creditLog={creditLog}
                  isLoading={metricsLoading}
                />
              </div>

              <div className="space-y-6">
                <ActivityFeed activities={activities} isLoading={ingestion.isLoading} />
              </div>
            </div>

            <CatboostPanel />

            <Card id="workers" className="col-span-full">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Workers (workers_500.csv)</h3>
                  <p className="text-sm text-muted-foreground">
                    Showing {topWorkers.length} workers from ingestion snapshot.
                  </p>
                </div>
              </div>
              <div
                ref={workersScrollRef}
                className="overflow-auto max-h-[460px] cursor-grab active:cursor-grabbing"
                onMouseDown={onWorkersMouseDown}
                onMouseMove={onWorkersMouseMove}
                onMouseUp={onWorkersMouseUpOrLeave}
                onMouseLeave={onWorkersMouseUpOrLeave}
              >
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/20">
                      <th className="text-left py-2 pr-4">Worker</th>
                      <th className="text-left py-2 pr-4">Platform</th>
                      <th className="text-left py-2 pr-4">Country</th>
                      <th className="text-left py-2 pr-4">Income State</th>
                      <th className="text-right py-2 pr-4">Avg Wage</th>
                      <th className="text-right py-2 pr-4">Repayments</th>
                      <th className="text-right py-2 pr-4">On-time</th>
                      <th className="text-right py-2 pr-4">Defaults</th>
                      <th className="text-left py-2 pr-4">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topWorkers.map((worker) => (
                      <tr key={worker.worker_id} className="border-b border-border/10">
                        <td className="py-2 pr-4">
                          <div className="font-mono text-xs">{worker.worker_id}</div>
                          {worker.name && <div className="text-xs text-muted-foreground">{worker.name}</div>}
                        </td>
                        <td className="py-2 pr-4">{worker.platform || worker.company_id}</td>
                        <td className="py-2 pr-4">
                          {worker.country} {worker.currency ? `(${worker.currency})` : ''}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge
                            variant={
                              worker.income_state === 'FAMINE'
                                ? 'danger'
                                : worker.income_state === 'NORMAL'
                                  ? 'warning'
                                  : 'success'
                            }
                          >
                            {worker.income_state || 'UNKNOWN'}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {worker.avg_wage_minor !== undefined
                            ? formatCurrency(worker.avg_wage_minor, worker.currency || 'EUR')
                            : '-'}
                        </td>
                        <td className="py-2 pr-4 text-right">{worker.repayment_count ?? worker.succeeded_payments}</td>
                        <td className="py-2 pr-4 text-right">
                          {worker.on_time_rate !== undefined ? `${(worker.on_time_rate * 100).toFixed(1)}%` : '-'}
                        </td>
                        <td className="py-2 pr-4 text-right">{worker.default_count ?? 0}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={worker.source === 'db' ? 'info' : 'success'}>
                            {(worker.source || 'unknown').toUpperCase()}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {topWorkers.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-4 text-muted-foreground">
                          No workers loaded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card id="remittances" className="col-span-full">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Remittances</h3>
                  <p className="text-sm text-muted-foreground">
                    FX transfer records from `remittances_detail.csv` or `fx_transactions.csv`.
                  </p>
                </div>
              </div>
              <div
                ref={remittancesScrollRef}
                className="overflow-auto max-h-[460px] cursor-grab active:cursor-grabbing"
                onMouseDown={onRemittancesMouseDown}
                onMouseMove={onRemittancesMouseMove}
                onMouseUp={onRemittancesMouseUpOrLeave}
                onMouseLeave={onRemittancesMouseUpOrLeave}
              >
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/20">
                      <th className="text-left py-2 pr-4">Date</th>
                      <th className="text-left py-2 pr-4">Worker</th>
                      <th className="text-left py-2 pr-4">Route</th>
                      <th className="text-right py-2 pr-4">Sent</th>
                      <th className="text-right py-2 pr-4">Received</th>
                      <th className="text-right py-2 pr-4">FX Rate</th>
                      <th className="text-left py-2 pr-4">Status</th>
                      <th className="text-left py-2 pr-4">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {remittances.map((row) => (
                      <tr key={`${row.tx_id}-${row.id}`} className="border-b border-border/10">
                        <td className="py-2 pr-4">{row.date}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{row.worker_id || '-'}</td>
                        <td className="py-2 pr-4">{row.currency_sent} {'->'} {row.currency_received} ({row.destination_country})</td>
                        <td className="py-2 pr-4 text-right">{formatCurrency(row.amount_sent_minor, row.currency_sent || 'EUR')}</td>
                        <td className="py-2 pr-4 text-right">{formatCurrency(row.amount_received_minor, row.currency_received || 'TRY')}</td>
                        <td className="py-2 pr-4 text-right">{row.exchange_rate.toFixed(4)}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={String(row.status).toLowerCase() === 'completed' ? 'success' : 'warning'}>
                            {row.status}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant={row.source === 'db' ? 'info' : 'success'}>
                            {(row.source || 'unknown').toUpperCase()}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {remittances.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-4 text-muted-foreground">
                          No remittances loaded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <WorkerTransactionTable
              transactions={transactions}
              accounts={ledgerState.accounts}
              isLoading={stateLoading}
            />

            <Card className="col-span-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Transaction Details</h3>
                <button className="text-muted-foreground hover:text-foreground">x</button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">From</p>
                </div>
                <div>
                  <p className="text-muted-foreground">To</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount (USD)</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                </div>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardContent />
    </QueryClientProvider>
  );
};

export default Dashboard;
