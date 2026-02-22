import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar, Navbar } from './Layout';
import { BalanceGrid } from './BalanceCard';
import { WorkerTransactionTable } from './WorkerTransactionTable';
import { ObligationsPanel } from './ObligationsPanel';
import { MetricsPanel } from './MetricsPanel';
import { ActivityFeed } from './ActivityFeed';
import { api } from '../hooks/api';
import { useIngestionData } from '../hooks/useApi';
import { Card } from './ui';
import { CatboostPanel } from './CatboostPanel';
import type { Transaction } from './WorkerTransactionTable'
// import { toast } from '../lib/toast';

<<<<<<< HEAD
const PAYMENT_STATUS_TO_TABLE_STATUS: Record<string, string> = {
  succeeded: 'EXECUTED',
  requires_confirmation: 'PENDING',
  processing: 'PENDING',
  failed: 'FAILED',
=======
const MOCK_METRICS = {
  gross_usd_cents_open: 5000000, 
  net_usd_cents_if_settle_now: 1250000, 
  queued_count: 14,
  compression_ratio: 75
};

const MOCK_LEDGER_STATE = {
  accounts: [
    { currency: 'USD', balance_minor: 2500000, id: 'pool-1' },
    { currency: 'EUR', balance_minor: 1800000, id: 'pool-2' },
    { currency: 'TRY', balance_minor: 42500000, id: 'pool-3' }
  ],
  open_obligations: [
    { id: '1', from_pool: 'POOL_A', to_pool: 'POOL_B', amount_usd_cents: 50000, status: 'open' }
  ]
>>>>>>> 9d1638336db81f9b7098542b2f101ec8014cfa78
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2000,
      retry: 1,
    },
  },
});

export const DashboardContent: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  // const [transactionDetail, setTransactionDetail] = useState<Transaction | null>(null);

  const ingestion = useIngestionData();
  const ledgerState = ingestion.data?.state || { accounts: [], open_obligations: [], queued_payouts: [] };
  const metrics = ingestion.data?.metrics || {
    gross_usd_cents_open: 0,
    net_usd_cents_if_settle_now: 0,
    queued_count: 0,
    transactions_today: 0,
  };
  const stateLoading = ingestion.isLoading;
  const metricsLoading = ingestion.isLoading;
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
    amount_usd_cents: payment.amount_minor,
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
    amount_usd_cents: obligation.amount_usd_cents,
    currency: 'USD',
    status: String(obligation.status).toUpperCase(),
  }));

  const transactions: Transaction[] = paymentTransactions.length > 0 ? paymentTransactions : obligationTransactions;

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
        // toast(data.message || 'Settlement failed', 'error');
      }
    } catch (error: any) {
      // toast(error.message || 'Settlement failed', 'error');
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
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Ledger Dashboard</h1>
              <p className="text-muted-foreground">
                Real-time view of synthetic liquidity settlement across all pools
              </p>
            </div>

            {/* Balance Cards */}
            <BalanceGrid data={currencyTotals} isLoading={stateLoading} />

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Obligations & Metrics */}
              <div className="lg:col-span-2 space-y-6">
                <ObligationsPanel
                  obligations={ledgerState?.open_obligations || []}
                  grossUsdCents={metrics?.gross_usd_cents_open || 0}
                  netUsdCents={metrics?.net_usd_cents_if_settle_now || 0}
                  isLoading={metricsLoading}
                  onSettleClick={handleSettleClick}
                  isSettling={isSettling}
                />

                <MetricsPanel
                  metrics={metrics || {
                    gross_usd_cents_open: 0,
                    net_usd_cents_if_settle_now: 0,
                    queued_count: 0,
                  }}
                  creditLog={ingestion.data?.credit_log || []}
                  isLoading={metricsLoading}
                />
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <ActivityFeed
                  activities={activities}
                  isLoading={ingestion.isLoading}
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
