import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar, Navbar } from './Layout';
import { BalanceGrid } from './BalanceCard';
import { WorkerTransactionTable } from './WorkerTransactionTable';
import { ObligationsPanel } from './ObligationsPanel';
import { LiquidityHealthPanel } from './LiquidityHealth';
import { MetricsPanel } from './MetricsPanel';
import { ActivityFeed } from './ActivityFeed';
import { mockActivityFeed, api } from '../hooks/api';
import { Card } from './ui';
import { CatboostPanel } from './CatboostPanel';
import type { Transaction } from './WorkerTransactionTable'
// import { toast } from '../lib/toast';

const MOCK_METRICS = {
  gross_usd_cents_open: 5000000, 
  net_usd_cents_if_settle_now: 1250000, 
  queued_count: 14,
  compression_ratio: 75
};

const MOCK_LEDGER_STATE = {
  accounts: [
    { currency: 'USD', balance_minor: 2500000, id: 'pool-1' },
    { currency: 'EUR', balance_minor: 1800000, id: 'pool-2' }
  ],
  open_obligations: [
    { id: '1', from_pool: 'POOL_A', to_pool: 'POOL_B', amount_usd_cents: 50000, status: 'open' }
  ]
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

  // const { data: ledgerState, isLoading: stateLoading } = useLedgerState();
  // const { data: metrics, isLoading: metricsLoading } = useMetrics();
  const ledgerState = MOCK_LEDGER_STATE;
  const metrics = MOCK_METRICS;
  const stateLoading = false; 
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

  // Convert obligations to transaction format
  const transactions: Transaction[] = (ledgerState?.open_obligations || []).map((o) => ({
    id: o.id,
    timestamp: o.created_at || Math.floor(Date.now() / 1000),
    type: 'obligation',
    from_account: o.from_pool,
    to_account: o.to_pool,
    amount_minor: Math.round((o.amount_usd_cents / 100) * 100), // Approximate
    amount_usd_cents: o.amount_usd_cents,
    currency: 'USD',
    status: o.status,
  }));

  const handleSettleClick = async () => {
    setIsSettling(true);
    try {
      const response = await api.runSettlement();
      const data = response.data as { id?: number };
      if (typeof data.id === 'number') {
        // toast('Settlement executed successfully', 'success');
        // Auto-refetch after settlement
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

                <LiquidityHealthPanel
                  accounts={ledgerState?.accounts || []}
                  isLoading={stateLoading}
                />
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <MetricsPanel metrics={metrics || {
                  gross_usd_cents_open: 0,
                  net_usd_cents_if_settle_now: 0,
                  queued_count: 0,
                }} isLoading={metricsLoading} />

                <ActivityFeed
                  activities={mockActivityFeed()}
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
