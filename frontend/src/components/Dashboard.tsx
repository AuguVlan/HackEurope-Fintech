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
import {
  mockLedgerState,
  mockMetrics,
  mockCreditLog,
  mockWorkers,
  mockRemittances,
  mockPayments,
  mockActivities,
  mockTransactions,
} from '../lib/mockData';

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
  const hasBackendData = !!(ingestion.data?.credit_log?.length);
  const ledgerState = hasBackendData ? ingestion.data!.state : mockLedgerState();
  const metrics = hasBackendData ? ingestion.data!.metrics : mockMetrics();
  const creditLog = hasBackendData ? ingestion.data!.credit_log : mockCreditLog();
  const workers = hasBackendData ? ingestion.data!.workers : mockWorkers().slice(0, 50);
  const remittances = hasBackendData ? ingestion.data!.recent_remittances : mockRemittances();
  const stateLoading = false;
  const metricsLoading = false;

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

  const recentPayments = hasBackendData ? (ingestion.data?.recent_payments || []) : mockPayments();
  const paymentTransactions: Transaction[] = recentPayments.map((payment) => ({
    id: payment.id,
    timestamp: payment.timestamp,
    type: payment.service_type || 'payment',
    from_account: `COMPANY_${payment.company_id}_${payment.currency}`,
    to_account: `POOL_${payment.country}_${payment.currency}`,
    amount_minor: payment.amount_minor,
    currency: payment.currency,
    status: PAYMENT_STATUS_TO_TABLE_STATUS[payment.status] || String(payment.status).toUpperCase(),
    idempotency_key: payment.idempotency_key,
    source: payment.source || 'csv',
  }));

  const obligationTransactions: Transaction[] = ledgerState.open_obligations.map((obligation) => ({
    id: obligation.id,
    timestamp: obligation.created_at || Math.floor(Date.now() / 1000),
    type: 'obligation',
    from_account: obligation.from_pool,
    to_account: obligation.to_pool,
    amount_minor: obligation.amount_usd_cents,
    currency: obligation.from_pool?.includes('EUR') ? 'EUR' : obligation.from_pool?.includes('TRY') ? 'TRY' : 'EUR',
    status: String(obligation.status).toUpperCase(),
    source: 'db',
  }));

  const transactions: Transaction[] =
    paymentTransactions.length > 0 ? paymentTransactions : obligationTransactions;
  const topWorkers = workers;

  const activities = hasBackendData
    ? [
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
        .slice(0, 8)
    : mockActivities();

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
        <main className="flex-1 overflow-auto bg-gradient-to-br from-background via-background to-background/95">
          <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
            {/* Professional Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-2 h-8 rounded-full bg-gradient-to-b from-primary to-accent" />
                  <h1 className="text-3xl font-bold text-foreground tracking-tight">Ledger Dashboard</h1>
                </div>
                <p className="text-muted-foreground ml-5">
                  Real-time view of TideBridge settlement across all pools
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Last Updated</span>
                  <p className="text-sm font-semibold text-foreground">{new Date().toLocaleTimeString()}</p>
                </div>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative group">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative p-5 rounded-2xl bg-card/60 border border-border/50 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Lending Capacity</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    €{((metrics?.lending_capacity_eur_cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Max available to lend</p>
                </div>
              </div>
              
              <div className="relative group">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/20 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative p-5 rounded-2xl bg-card/60 border border-border/50 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Utilization</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <p className="text-2xl font-bold text-foreground">{metrics?.utilization_pct || 0}%</p>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-accent to-primary transition-all duration-500"
                      style={{ width: `${Math.min(100, metrics?.utilization_pct || 0)}%` }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="relative group">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative p-5 rounded-2xl bg-card/60 border border-border/50 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Active Advances</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{metrics?.active_advances || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Currently outstanding</p>
                </div>
              </div>
              
              <div className="relative group">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative p-5 rounded-2xl bg-card/60 border border-border/50 backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                    </div>
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Avg Advance</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    €{((metrics?.avg_advance_eur_cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Per worker average</p>
                </div>
              </div>
            </div>

            <CurrencyPools />

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
