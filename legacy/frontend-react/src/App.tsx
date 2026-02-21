import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildWorkerTransactions,
  type Account,
  type LedgerState,
  type Metrics,
  type WorkerTransaction,
} from "./api";
import { ActivityFeed, type ActivityItem } from "./components/activity-feed";
import {
  CurrencyBalanceGrid,
  type CurrencyTotal,
} from "./components/currency-balance-grid";
import { LayoutShell } from "./components/layout-shell";
import { LiquidityHealthPanel } from "./components/liquidity-health-panel";
import { MetricsPanel } from "./components/metrics-panel";
import { ObligationsPanel } from "./components/obligations-panel";
import { TransactionDrawer } from "./components/transaction-drawer";
import { WorkerTransactionTable } from "./components/worker-transaction-table";
import { useLedgerState, useMetrics, useRunSettlement } from "./hooks/useDashboardData";
import { useToast } from "./lib/toast";

const EMPTY_STATE: LedgerState = {
  accounts: [],
  open_obligations: [],
  queued_payouts: [],
};

const EMPTY_METRICS: Metrics = {
  gross_usd_cents_open: 0,
  net_usd_cents_if_settle_now: 0,
  queued_count: 0,
  settlement_compression_ratio: 1,
  transactions_today: 0,
};

function sparklineFromSeed(seed: number): number[] {
  return Array.from({ length: 14 }).map((_, index) => {
    return (
      40 +
      Math.sin((seed + index) / 2.4) * 11 +
      Math.cos((seed + index) / 3.5) * 6
    );
  });
}

function buildCurrencyTotals(accounts: Account[]): CurrencyTotal[] {
  const aggregate = new Map<string, { total: number; pools: number }>();
  for (const account of accounts) {
    const key = account.currency.toUpperCase();
    const current = aggregate.get(key) ?? { total: 0, pools: 0 };
    current.total += account.balance_minor;
    current.pools += 1;
    aggregate.set(key, current);
  }

  const priority = ["GBP", "BRL", "USD"];
  const sorted = [...aggregate.entries()].sort((a, b) => {
    const ia = priority.indexOf(a[0]);
    const ib = priority.indexOf(b[0]);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a[0].localeCompare(b[0]);
  });

  return sorted.map(([currency, values], index) => ({
    currency,
    total_minor: values.total,
    pools: values.pools,
    change_percent: 1.2 + ((values.total / 10_000 + index * 3.7) % 6.5),
    sparkline: sparklineFromSeed(values.total / 100 + index * 5),
  }));
}

function topExposurePairs(state: LedgerState) {
  const pairMap = new Map<string, number>();
  for (const obligation of state.open_obligations) {
    const pair = `${obligation.from_pool} → ${obligation.to_pool}`;
    pairMap.set(pair, (pairMap.get(pair) ?? 0) + obligation.amount_usd_cents);
  }
  return [...pairMap.entries()]
    .map(([pair, usd_cents]) => ({ pair, usd_cents }))
    .sort((a, b) => b.usd_cents - a.usd_cents)
    .slice(0, 4);
}

function deriveActivity(
  state: LedgerState,
  settlementEvents: ActivityItem[],
): ActivityItem[] {
  const queued = state.queued_payouts.map((item) => ({
    id: `queued-${item.id}`,
    type: "payout_queued" as const,
    at: item.created_at,
    description: `Payout queued ${item.from_pool} → ${item.to_pool}`,
  }));

  const executed = state.open_obligations.map((item) => ({
    id: `exec-${item.id}`,
    type: "payout_executed" as const,
    at: item.created_at,
    description: `Synthetic transfer ${item.from_pool} → ${item.to_pool}`,
  }));

  const topup = state.accounts.slice(0, 1).map((account) => ({
    id: `topup-${account.id}`,
    type: "liquidity_topup" as const,
    at: Math.floor(Date.now() / 1000) - 180,
    description: `Liquidity top-up available in ${account.id}`,
  }));

  return [...settlementEvents, ...queued, ...executed, ...topup]
    .sort((a, b) => b.at - a.at)
    .slice(0, 10);
}

export default function App() {
  const { data: stateData } = useLedgerState();
  const { data: metricsData } = useMetrics();
  const settlementMutation = useRunSettlement();
  const { notify } = useToast();

  const [selectedTransaction, setSelectedTransaction] =
    useState<WorkerTransaction | null>(null);
  const [settlementEvents, setSettlementEvents] = useState<ActivityItem[]>([]);
  const queuedCountRef = useRef(0);
  const warnedPoolsRef = useRef<Set<string>>(new Set());

  const state = stateData ?? EMPTY_STATE;
  const metrics = metricsData ?? EMPTY_METRICS;

  const currencyTotals = useMemo(() => buildCurrencyTotals(state.accounts), [state.accounts]);
  const transactions = useMemo(() => buildWorkerTransactions(state), [state]);
  const topPairs = useMemo(() => topExposurePairs(state), [state]);
  const activities = useMemo(
    () => deriveActivity(state, settlementEvents),
    [settlementEvents, state],
  );

  useEffect(() => {
    if (metrics.queued_count > queuedCountRef.current) {
      notify({
        variant: "warning",
        title: "Payout queued",
        description: `${metrics.queued_count} payouts are currently in queue`,
      });
    }
    queuedCountRef.current = metrics.queued_count;
  }, [metrics.queued_count, notify]);

  useEffect(() => {
    for (const account of state.accounts) {
      const isCritical = account.balance_minor < account.min_buffer_minor;
      const alreadyWarned = warnedPoolsRef.current.has(account.id);
      if (isCritical && !alreadyWarned) {
        warnedPoolsRef.current.add(account.id);
        notify({
          variant: "error",
          title: "Liquidity warning",
          description: `${account.id} is below its minimum buffer`,
        });
      }
      if (!isCritical && alreadyWarned) {
        warnedPoolsRef.current.delete(account.id);
      }
    }
  }, [notify, state.accounts]);

  async function handleRunSettlement() {
    try {
      const result = await settlementMutation.mutateAsync(0);
      if (!result.ok) {
        notify({
          variant: "error",
          title: "Settlement failed",
          description: result.message ?? "No settlement batch created",
        });
        return;
      }
      setSettlementEvents((prev) => [
        {
          id: `settlement-${Date.now()}`,
          type: "settlement_batch_created",
          at: Math.floor(Date.now() / 1000),
          description: `Settlement batch #${result.settlement_batch_id ?? "N/A"} created`,
        },
        ...prev,
      ]);
      notify({
        variant: "success",
        title: "Settlement run completed",
        description: `Settled ${result.settlement_count} obligations`,
      });
    } catch (error) {
      notify({
        variant: "error",
        title: "Settlement request failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return (
    <LayoutShell>
      <div className="space-y-5">
        <CurrencyBalanceGrid totals={currencyTotals} />

        <div className="grid gap-5 xl:grid-cols-12">
          <div className="space-y-5 xl:col-span-8">
            <ObligationsPanel
              grossUsdCents={metrics.gross_usd_cents_open}
              netUsdCents={metrics.net_usd_cents_if_settle_now}
              topPairs={topPairs}
              isRunning={settlementMutation.isPending}
              onRunSettlement={handleRunSettlement}
            />
            <LiquidityHealthPanel accounts={state.accounts} />
          </div>
          <div className="space-y-5 xl:col-span-4">
            <MetricsPanel metrics={metrics} />
            <ActivityFeed items={activities} />
          </div>
        </div>

        <WorkerTransactionTable rows={transactions} onSelect={setSelectedTransaction} />
      </div>

      <TransactionDrawer
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </LayoutShell>
  );
}
