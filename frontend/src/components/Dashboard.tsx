import React, { useState, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar, Navbar } from './Layout';
import { BalanceGrid } from './BalanceCard';
import { WorkerTransactionTable } from './WorkerTransactionTable';
import { MetricsPanel } from './MetricsPanel';
import { ActivityFeed } from './ActivityFeed';
import { api } from '../hooks/api';
import { useIngestionData } from '../hooks/useApi';
import { Card } from './ui';
import { CatboostPanel } from './CatboostPanel';
import { CurrencyPools } from './CurrencyPools';
import {
  mockLedgerState, mockMetrics, mockTransactions, mockActivities,
  mockCreditLog, mockSettlements,
} from '../lib/mockData';
import type { Transaction } from './WorkerTransactionTable'
// import { toast } from '../lib/toast';

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
      refetchOnWindowFocus: false,   // prevent refetch storms on tab switch
    },
  },
});

export const DashboardContent: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  // const [transactionDetail, setTransactionDetail] = useState<Transaction | null>(null);

  const ingestion = useIngestionData();

  // ── Mock data (stable across renders) ──
  const MOCK_STATE = useMemo(() => mockLedgerState(), []);
  const MOCK_METRICS = useMemo(() => mockMetrics(), []);
  const MOCK_TRANSACTIONS = useMemo(() => mockTransactions(), []);
  const MOCK_ACTIVITIES = useMemo(() => mockActivities(), []);
  const MOCK_CREDIT_LOG = useMemo(() => mockCreditLog(), []);

  // Use backend data when available, fall back to mock
  const hasBackendData = !!(ingestion.data?.state?.accounts?.length);
  const ledgerState = hasBackendData
    ? ingestion.data!.state
    : MOCK_STATE;
  const metrics = hasBackendData
    ? (ingestion.data!.metrics || MOCK_METRICS)
    : MOCK_METRICS;
  const creditLog = hasBackendData
    ? (ingestion.data?.credit_log || [])
    : MOCK_CREDIT_LOG;
  const stateLoading = false; // never show skeleton — we always have mock data
  const metricsLoading = false;
  // Group accounts by currency
  const currencyTotals = ledgerState?.accounts.reduce(
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
  ) || [];

  const paymentTransactions: Transaction[] = (ingestion.data?.recent_payments || []).map((payment) => ({
    id: payment.id,
    timestamp: payment.timestamp,
    type: payment.service_type || 'payment',
    from_account: `COMPANY_${payment.company_id}`,
    to_account: `POOL_${payment.country}`,
    amount_minor: payment.amount_minor,
    currency: payment.currency,
    status: PAYMENT_STATUS_TO_TABLE_STATUS[payment.status] || String(payment.status).toUpperCase(),
    idempotency_key: payment.idempotency_key,
  }));

  // Fallback when ingestion payload has no recent payment rows yet.
  const obligationTransactions: Transaction[] = (ledgerState?.open_obligations || []).map((obligation) => ({
    id: obligation.id,
    timestamp: obligation.created_at || Math.floor(Date.now() / 1000),
    type: 'obligation',
    from_account: obligation.from_pool,
    to_account: obligation.to_pool,
    amount_minor: obligation.amount_usd_cents,
    currency: obligation.from_pool?.includes('EUR') ? 'EUR' : obligation.from_pool?.includes('TRY') ? 'TRY' : 'EUR',
    status: String(obligation.status).toUpperCase(),
  }));

  const transactions: Transaction[] = hasBackendData
    ? (paymentTransactions.length > 0 ? paymentTransactions : obligationTransactions)
    : MOCK_TRANSACTIONS;

  const activities = hasBackendData ? [
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
    .slice(0, 8) : MOCK_ACTIVITIES;

  const handleSettleClick = async () => {
    setSettleError(null);
    setIsSettling(true);
    try {
      const response = await api.runSettlement();
      const data = response.data as { id?: number };
      if (typeof data.id === 'number') {
        // toast('Settlement executed successfully', 'success');
        // Auto-refetch after settlement
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

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-64">
        {/* Navbar */}
        <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        {/* Page Content */}
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

            {/* Currency Pools with FX Overview */}
            <CurrencyPools />

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Obligations & Metrics */}
              <div className="lg:col-span-2 space-y-6">
                <MetricsPanel
                  metrics={metrics || {
                    gross_usd_cents_open: 0,
                    net_usd_cents_if_settle_now: 0,
                    queued_count: 0,
                  }}
                  creditLog={creditLog}
                  isLoading={metricsLoading}
                />
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <ActivityFeed
                  activities={activities}
                  isLoading={false}
                />
              </div>
            </div>

            <CatboostPanel />

            {/* Transaction Table */}
            <WorkerTransactionTable
              transactions={transactions}
              accounts={ledgerState?.accounts || []}
              isLoading={stateLoading}
              // onRowClick={setTransactionDetail}
            />

            {/* Detail Panel */}
            {/* {transactionDetail && ( */}
              <Card className="col-span-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Transaction Details</h3>
                  <button
                    // onClick={() => setTransactionDetail(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">From</p>
                    {/* <p className="font-mono font-semibold">{transactionDetail.from_account}</p> */}
                  </div>
                  <div>
                    <p className="text-muted-foreground">To</p>
                    {/* <p className="font-mono font-semibold">{transactionDetail.to_account}</p> */}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Amount (USD)</p>
                    {/* <p className="font-semibold">${(transactionDetail.amount_usd_cents! / 100).toFixed(2)}</p> */}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    {/* <p className="font-semibold text-secondary">{transactionDetail.status}</p> */}
                  </div>
                </div>
              </Card>
            {/* )} */}
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
