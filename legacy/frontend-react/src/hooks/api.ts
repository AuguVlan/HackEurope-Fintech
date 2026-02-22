export interface Account {
  id: string;
  kind: string;
  country: string;
  currency: string;
  balance_minor: number;
  min_buffer_minor: number;
}

export interface Obligation {
  id: number;
  from_pool: string;
  to_pool: string;
  amount_usd_cents: number;
  status: string;
  created_at: number;
}

export interface PayoutQueueItem {
  id: number;
  from_pool: string;
  to_pool: string;
  amount_minor: number;
  status: string;
  created_at: number;
}

export interface LedgerState {
  accounts: Account[];
  open_obligations: Obligation[];
  queued_payouts: PayoutQueueItem[];
}

export interface Metrics {
  gross_usd_cents_open: number;
  net_usd_cents_if_settle_now: number;
  queued_count: number;
  settlement_compression_ratio: number;
  transactions_today: number;
}

export interface SettlementResult {
  ok: boolean;
  settlement_batch_id: number | null;
  settlement_count: number;
  message?: string;
}

export interface WorkerTransaction {
  id: string;
  timestamp: number;
  worker_id: string;
  from_pool: string;
  to_pool: string;
  amount_minor: number;
  currency: string;
  usd_exposure_cents: number;
  status: "EXECUTED" | "QUEUED";
  idempotency_key: string;
  type: "Synthetic" | "Settlement";
  journal_entry: Record<string, unknown>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const OPERATOR_TOKEN = import.meta.env.VITE_OPERATOR_TOKEN || "demo-operator-token";

const FX_TO_USD: Record<string, number> = {
  USD: 1,
  GBP: 1.27,
  EUR: 1.08,
  BRL: 0.2,
};

let fallbackStateCache: LedgerState | null = null;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function currencyRate(currency: string): number {
  return FX_TO_USD[currency.toUpperCase()] ?? 1;
}

function toUsdCents(amountMinor: number, currency: string): number {
  const usd = (amountMinor / 100) * currencyRate(currency);
  return Math.round(usd * 100);
}

function inferCurrencyFromPool(poolId: string): string {
  const parts = poolId.split("_");
  const maybeCurrency = parts[parts.length - 1];
  if (maybeCurrency && maybeCurrency.length === 3) return maybeCurrency.toUpperCase();
  return "USD";
}

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

async function tryRequest<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    return await request<T>(path, init);
  } catch {
    return null;
  }
}

function normalizeState(raw: unknown): LedgerState | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<LedgerState>;
  if (!Array.isArray(candidate.accounts)) return null;
  if (!Array.isArray(candidate.open_obligations)) return null;
  if (!Array.isArray(candidate.queued_payouts)) return null;
  return {
    accounts: candidate.accounts.map((account) => ({
      id: String((account as Account).id),
      kind: String((account as Account).kind ?? "POOL"),
      country: String((account as Account).country ?? "GLOBAL"),
      currency: String((account as Account).currency ?? "USD").toUpperCase(),
      balance_minor: Number((account as Account).balance_minor ?? 0),
      min_buffer_minor: Number((account as Account).min_buffer_minor ?? 0),
    })),
    open_obligations: candidate.open_obligations.map((obligation, index) => ({
      id: Number((obligation as Obligation).id ?? index + 1),
      from_pool: String((obligation as Obligation).from_pool),
      to_pool: String((obligation as Obligation).to_pool),
      amount_usd_cents: Number((obligation as Obligation).amount_usd_cents ?? 0),
      status: String((obligation as Obligation).status ?? "OPEN"),
      created_at: Number((obligation as Obligation).created_at ?? nowSeconds() - index * 160),
    })),
    queued_payouts: candidate.queued_payouts.map((queued, index) => ({
      id: Number((queued as PayoutQueueItem).id ?? index + 10_000),
      from_pool: String((queued as PayoutQueueItem).from_pool),
      to_pool: String((queued as PayoutQueueItem).to_pool),
      amount_minor: Number((queued as PayoutQueueItem).amount_minor ?? 0),
      status: String((queued as PayoutQueueItem).status ?? "QUEUED"),
      created_at: Number((queued as PayoutQueueItem).created_at ?? nowSeconds() - index * 120),
    })),
  };
}

interface PoolResponse {
  country: string;
  balance_minor: number;
  currency: string;
}

function buildFallbackStateFromPools(pools: PoolResponse[]): LedgerState {
  const seedPools =
    pools.length > 0
      ? pools
      : [
          { country: "UK", balance_minor: 612_000, currency: "GBP" },
          { country: "BR", balance_minor: 1_202_000, currency: "BRL" },
          { country: "US", balance_minor: 852_000, currency: "USD" },
        ];

  const accounts: Account[] = seedPools.map((pool) => ({
    id: `POOL_${pool.country}_${pool.currency}`,
    kind: "POOL",
    country: pool.country,
    currency: pool.currency.toUpperCase(),
    balance_minor: Number(pool.balance_minor),
    min_buffer_minor: Math.max(Math.floor(Number(pool.balance_minor) * 0.55), 180_000),
  }));

  if (accounts.length === 1) {
    accounts.push({
      id: "POOL_BR_BRL",
      kind: "POOL",
      country: "BR",
      currency: "BRL",
      balance_minor: 540_000,
      min_buffer_minor: 240_000,
    });
  }

  const first = accounts[0];
  const second = accounts[1];
  const third = accounts[2] ?? accounts[0];
  const now = nowSeconds();

  const open_obligations: Obligation[] = [
    {
      id: 1,
      from_pool: first.id,
      to_pool: second.id,
      amount_usd_cents: toUsdCents(Math.floor(first.balance_minor * 0.12), first.currency),
      status: "OPEN",
      created_at: now - 600,
    },
    {
      id: 2,
      from_pool: second.id,
      to_pool: third.id,
      amount_usd_cents: toUsdCents(Math.floor(second.balance_minor * 0.08), second.currency),
      status: "OPEN",
      created_at: now - 420,
    },
    {
      id: 3,
      from_pool: third.id,
      to_pool: first.id,
      amount_usd_cents: toUsdCents(Math.floor(third.balance_minor * 0.07), third.currency),
      status: "OPEN",
      created_at: now - 240,
    },
  ];

  const queued_payouts: PayoutQueueItem[] = [
    {
      id: 11,
      from_pool: first.id,
      to_pool: second.id,
      amount_minor: Math.floor(first.balance_minor * 0.04),
      status: "QUEUED",
      created_at: now - 180,
    },
    {
      id: 12,
      from_pool: second.id,
      to_pool: third.id,
      amount_minor: Math.floor(second.balance_minor * 0.03),
      status: "QUEUED",
      created_at: now - 60,
    },
  ];

  return { accounts, open_obligations, queued_payouts };
}

function netExposure(ledgerState: LedgerState): number {
  const netByPool = new Map<string, number>();
  for (const obligation of ledgerState.open_obligations) {
    netByPool.set(
      obligation.from_pool,
      (netByPool.get(obligation.from_pool) ?? 0) - obligation.amount_usd_cents,
    );
    netByPool.set(
      obligation.to_pool,
      (netByPool.get(obligation.to_pool) ?? 0) + obligation.amount_usd_cents,
    );
  }
  let net = 0;
  for (const value of netByPool.values()) {
    if (value > 0) net += value;
  }
  return net;
}

export async function getState(): Promise<LedgerState> {
  const stateResponse = await tryRequest<unknown>("/state");
  const normalized = normalizeState(stateResponse);
  if (normalized) {
    fallbackStateCache = deepCopy(normalized);
    return normalized;
  }

  const poolsResponse = (await tryRequest<PoolResponse[]>("/pools")) ?? [];
  const fallback = buildFallbackStateFromPools(poolsResponse);
  fallbackStateCache = deepCopy(fallback);
  return fallback;
}

export async function getMetrics(): Promise<Metrics> {
  const metricsResponse = await tryRequest<Partial<Metrics>>("/metrics");
  if (metricsResponse && typeof metricsResponse.gross_usd_cents_open === "number") {
    const gross = Number(metricsResponse.gross_usd_cents_open);
    const net = Number(metricsResponse.net_usd_cents_if_settle_now ?? 0);
    return {
      gross_usd_cents_open: gross,
      net_usd_cents_if_settle_now: net,
      queued_count: Number(metricsResponse.queued_count ?? 0),
      settlement_compression_ratio:
        net > 0 ? gross / net : gross > 0 ? gross : 1,
      transactions_today: Number(metricsResponse.transactions_today ?? 0),
    };
  }

  const state = fallbackStateCache ?? (await getState());
  const gross = state.open_obligations.reduce((sum, item) => sum + item.amount_usd_cents, 0);
  const net = netExposure(state);
  return {
    gross_usd_cents_open: gross,
    net_usd_cents_if_settle_now: net,
    queued_count: state.queued_payouts.length,
    settlement_compression_ratio: net > 0 ? gross / net : gross > 0 ? gross : 1,
    transactions_today: state.open_obligations.length + state.queued_payouts.length,
  };
}

export async function runSettlement(thresholdUsdCents = 0): Promise<SettlementResult> {
  const primary = await tryRequest<Partial<SettlementResult>>("/settle/run", {
    method: "POST",
    body: JSON.stringify({ threshold_usd_cents: thresholdUsdCents }),
  });
  if (primary && typeof primary.ok === "boolean") {
    return {
      ok: primary.ok,
      settlement_batch_id: Number(primary.settlement_batch_id ?? null),
      settlement_count: Number(primary.settlement_count ?? 0),
      message: primary.message,
    };
  }

  const alt = await tryRequest<{
    id: number;
    status?: string;
  }>("/settlements/run", {
    method: "POST",
    headers: { "X-Operator-Token": OPERATOR_TOKEN },
  });
  if (alt && typeof alt.id === "number") {
    if (fallbackStateCache) {
      fallbackStateCache.open_obligations = [];
    }
    return {
      ok: true,
      settlement_batch_id: alt.id,
      settlement_count: 1,
      message: "Settlement run submitted",
    };
  }

  if (!fallbackStateCache) {
    fallbackStateCache = await getState();
  }
  const settledCount = fallbackStateCache.open_obligations.length;
  fallbackStateCache.open_obligations = [];
  return {
    ok: true,
    settlement_batch_id: nowSeconds(),
    settlement_count: settledCount,
    message: "Settlement simulated (mock mode)",
  };
}

function extractWorkerId(fromPool: string, toPool: string, index: number): string {
  const joined = `${fromPool}-${toPool}`.toUpperCase();
  const match = joined.match(/WORKER[_-]([A-Z0-9]+)/);
  if (match && match[1]) return `worker_${match[1].toLowerCase()}`;
  return `worker_${String((index % 12) + 1).padStart(2, "0")}`;
}

export function buildWorkerTransactions(ledgerState: LedgerState): WorkerTransaction[] {
  const obligationRows = ledgerState.open_obligations.map((obligation, index) => ({
    id: `obl-${obligation.id}`,
    timestamp: obligation.created_at,
    worker_id: extractWorkerId(obligation.from_pool, obligation.to_pool, index),
    from_pool: obligation.from_pool,
    to_pool: obligation.to_pool,
    amount_minor: obligation.amount_usd_cents,
    currency: "USD",
    usd_exposure_cents: obligation.amount_usd_cents,
    status: (obligation.status.toUpperCase() === "OPEN" ? "QUEUED" : "EXECUTED") as
      | "QUEUED"
      | "EXECUTED",
    idempotency_key: `syn-${obligation.id.toString(16)}-${obligation.created_at}`,
    type: "Synthetic" as const,
    journal_entry: {
      source: "open_obligation",
      ...obligation,
    },
  }));

  const queuedRows = ledgerState.queued_payouts.map((payout, index) => {
    const currency = inferCurrencyFromPool(payout.from_pool);
    return {
      id: `pay-${payout.id}`,
      timestamp: payout.created_at,
      worker_id: extractWorkerId(payout.from_pool, payout.to_pool, index + 100),
      from_pool: payout.from_pool,
      to_pool: payout.to_pool,
      amount_minor: payout.amount_minor,
      currency,
      usd_exposure_cents: toUsdCents(payout.amount_minor, currency),
      status: "QUEUED" as const,
      idempotency_key: `set-${payout.id.toString(16)}-${payout.created_at}`,
      type: "Settlement" as const,
      journal_entry: {
        source: "queued_payout",
        ...payout,
      },
    };
  });

  return [...queuedRows, ...obligationRows].sort((a, b) => b.timestamp - a.timestamp);
}
