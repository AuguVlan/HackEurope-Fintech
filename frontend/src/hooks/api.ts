import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = 'http://localhost:8000';
const OPERATOR_TOKEN = (import.meta as any).env?.VITE_OPERATOR_TOKEN || 'demo-operator-token';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface Account {
  id: string;
  kind: string;
  country: string;
  currency: string;
  balance_minor: number;
  min_buffer_minor: number;
}

export interface FXRate {
  currency: string;
  usd_per_unit: number;
}

export interface JournalEntry {
  id: number;
  created_at: number;
  type: string;
  external_id?: string;
  metadata_json?: string;
}

export interface Posting {
  id: number;
  entry_id: number;
  account_id: string;
  direction: string;
  amount_minor: number;
}

export interface Obligation {
  id: number;
  from_pool: string;
  to_pool: string;
  amount_usd_cents: number;
  status: string;
  created_at?: number;
  settlement_batch_id?: number;
}

export interface PayoutQueueItem {
  id: number;
  from_pool: string;
  to_pool: string;
  amount_minor: number;
  status: string;
  created_at?: number;
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
  transactions_today?: number;
}

export interface ForecastSignal {
  country: string;
  period: string;
  expected_inflow_minor: number;
  expected_outflow_minor: number;
  net_minor: number;
  confidence: number;
  method: 'catboost-underwriting-v1' | 'heuristic-underwriting-v1' | string;
  baseline_income_minor: number;
  current_earnings_minor: number;
  trigger_state: 'famine' | 'feast' | 'stable' | string;
  micro_credit_advance_minor: number;
  auto_repayment_minor: number;
  p_default: number;
  risk_band: 'low' | 'medium' | 'high' | string;
  fair_lending_disparate_impact_ratio: number;
  fair_lending_audit_status: string;
  overdraft_risk_score: number;
  overdraft_risk_band: 'low' | 'medium' | 'high' | 'critical' | string;
  max_credit_limit_minor: number;
  overdraft_headroom_minor: number;
  overdraft_limit_utilization: number;
  overdraft_analysis_confidence: number;
  overdraft_analysis_method: string;
}

export interface IncomeSignal extends ForecastSignal {
  worker_id: string;
  company_id: string | null;
  default_state: 'current' | 'delinquent' | 'default' | 'unknown' | string;
  default_state_confidence: number;
  repayment_samples: number;
  repayment_paid_samples: number;
  repayment_total_due_minor: number;
  repayment_total_paid_minor: number;
  repayment_ratio: number;
  repayment_on_time_rate: number;
  repayment_avg_days_late: number;
  repayment_p90_days_late: number;
  repayment_max_days_late: number;
  repayment_amount_cv: number;
  repayment_interval_cv: number;
  repayment_missed_count: number;
  repayment_risk_adjustment: number;
}

export interface SettlementLog {
  id: number;
  period: string;
  from_country: string;
  to_country: string;
  from_currency?: string;
  to_currency?: string;
  base_transfer_minor: number;
  forecast_adjustment_minor: number;
  recommended_minor: number;
  executed_minor: number | null;
  status: string;
  rationale: string;
  stripe_transfer_id: string | null;
  created_at: string;
}

export interface IngestionRepositoryHealth {
  name: string;
  alive: boolean;
}

export interface IngestionWorker {
  worker_id: string;
  company_id: string;
  country: string;
  succeeded_payments: number;
  catboost_ready: boolean;
  latest_payment_at: string;
}

export interface IngestionPayment {
  id: number;
  company_id: string;
  worker_id: string;
  country: string;
  amount_minor: number;
  currency: string;
  service_type: string;
  idempotency_key: string;
  status: string;
  created_at: string;
  timestamp: number;
}

export interface IngestionRepayment {
  id: number;
  company_id: string;
  worker_id: string;
  due_date: string;
  due_amount_minor: number;
  paid_at: string | null;
  paid_amount_minor: number | null;
  status: string;
  created_at: string;
}

export interface IngestionCreditLog {
  advance_id: string;
  worker_id: string;
  captured_at: string;
  method: string;
  p_default: number;
  risk_band: 'low' | 'medium' | 'high' | string;
  trigger_state: string;
  advance_minor: number;
  auto_repayment_minor: number;
  confidence: number;
  status: string;
  days_late: number;
  currency?: string;
}

export interface IngestionData {
  generated_at: string;
  repositories: IngestionRepositoryHealth[];
  state: LedgerState;
  metrics: Metrics;
  workers: IngestionWorker[];
  recent_payments: IngestionPayment[];
  recent_repayments: IngestionRepayment[];
  credit_log: IngestionCreditLog[];
  settlements: SettlementLog[];
  net_positions: NetPosition[];
}

export interface PayoutRequest {
  from_pool: string;
  to_pool: string;
  amount_minor: number;
  idempotency_key?: string;
}

export interface SettleRunRequest {
  threshold_usd_cents?: number;
}

export interface ActivityItem {
  id: string;
  type: 'payout_executed' | 'payout_queued' | 'settlement_batch' | 'topup' | 'obligation_created';
  timestamp: number;
  data: Record<string, any>;
  description: string;
  icon: string;
}

// API Calls
export const api = {
  // Health
  health: () => apiClient.get('/health'),

  // State
  getState: () => apiClient.get<LedgerState>('/state'),
  getMetrics: () => apiClient.get<Metrics>('/metrics'),
  getForecastSignal: (country: 'COUNTRY_A' | 'COUNTRY_B', period?: string) =>
    apiClient.get<ForecastSignal>('/forecast', {
      params: {
        country,
        ...(period ? { period } : {}),
      },
    }),
  getIncomeSignal: (workerId: string, companyId?: string, period?: string) =>
    apiClient.get<IncomeSignal>('/income-signal', {
      params: {
        worker_id: workerId,
        ...(companyId ? { company_id: companyId } : {}),
        ...(period ? { period } : {}),
      },
    }),
  getSettlements: () => apiClient.get<SettlementLog[]>('/settlements'),
  getIngestionData: () => apiClient.get<IngestionData>('/ingestion/data'),

  // Payout
  createPayout: (data: PayoutRequest) => 
    apiClient.post('/payout', data, {
      headers: { 'Idempotency-Key': data.idempotency_key || crypto.randomUUID() }
    }),

  // Settlement
  runSettlement: (_data: SettleRunRequest = {}) =>
    apiClient.post('/settlements/run', {}, {
      headers: { 'X-Operator-Token': OPERATOR_TOKEN },
    }),

  // Admin
  topup: (accountId: string, amountMinor: number) =>
    apiClient.post('/admin/topup', { account_id: accountId, amount_minor: amountMinor }),

  init: () => apiClient.post('/init', {}),
};

// Mock activity data (in production, this would come from the API)
export const mockActivityFeed = (): ActivityItem[] => {
  const now = Math.floor(Date.now() / 1000);
  return [
    {
      id: '1',
      type: 'payout_executed',
      timestamp: now - 300,
      data: { from: 'POOL_UK_GBP', to: 'POOL_BR_BRL', amount: 50000 },
      description: 'Payout executed to POOL_BR_BRL',
      icon: 'Send',
    },
    {
      id: '2',
      type: 'obligation_created',
      timestamp: now - 600,
      data: { from: 'POOL_UK_GBP', to: 'POOL_EU_EUR', amount_usd: 12500 },
      description: 'Obligation created: £10,000.00',
      icon: 'FileText',
    },
    {
      id: '3',
      type: 'settlement_batch',
      timestamp: now - 900,
      data: { batch_id: 42, count: 3 },
      description: 'Settlement batch #42 completed (3 settlements)',
      icon: 'CheckCircle2',
    },
    {
      id: '4',
      type: 'topup',
      timestamp: now - 1200,
      data: { account: 'POOL_UK_GBP', amount: 100000 },
      description: 'Liquidity top-up: +£1,000.00',
      icon: 'TrendingUp',
    },
    {
      id: '5',
      type: 'payout_queued',
      timestamp: now - 1800,
      data: { from: 'POOL_EU_EUR', to: 'POOL_BR_BRL', amount: 75000 },
      description: 'Payout queued (insufficient liquidity)',
      icon: 'Clock',
    },
  ];
};

// Helper functions for API calls
async function get<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  const response = await apiClient.get<T>(path, { params });
  return response.data;
}

async function post<T = any>(path: string, data?: any): Promise<T> {
  const response = await apiClient.post<T>(path, data);
  return response.data;
}

// Worker Portal
export async function getWorkerBalance(workerId: string) {
  return get<{ worker_id: string; balance_minor: number; currency: string; country?: string }>(`/worker/${workerId}/balance`);
}

export async function getWorkerTransactions(
  workerId: string,
  opts?: { limit?: number; offset?: number; from_ts?: number; to_ts?: number; type?: string }
) {
  return get<WorkerTransaction[]>(`/worker/${workerId}/transactions`, opts as Record<string, number | string | undefined>);
}

export async function getWorkerSummary(workerId: string) {
  return get<{ worker_id: string; balance_minor: number; currency: string; transaction_count: number }>(`/worker/${workerId}/summary`);
}

// Admin
export async function getMetrics() {
  return get<{
    gross_usd_cents_open: number;
    net_usd_cents_if_settle_now: number;
    queued_count: number;
    transactions_today: number;
  }>('/metrics');
}

export async function getAdminTransactions(opts?: {
  limit?: number;
  offset?: number;
  from_ts?: number;
  to_ts?: number;
  type?: string;
  currency?: string;
}) {
  return get<AdminTransaction[]>('/admin/transactions', opts as Record<string, number | string | undefined>);
}

export async function getAdminObligationsOpen() {
  return get<{ obligations: Obligation[]; count: number }>('/admin/obligations/open');
}

export async function getAdminNetPositions() {
  return get<{ net_positions: NetPosition[] }>('/admin/net_positions');
}

export async function getState(): Promise<{ accounts: { id: string; kind: string; currency: string }[] }> {
  return get('/state');
}

export async function postSettleRun(threshold_usd_cents: number) {
  void threshold_usd_cents;
  const response = await apiClient.post('/settlements/run', {}, {
    headers: { 'X-Operator-Token': OPERATOR_TOKEN },
  });
  return response.data;
}

export async function postAdminTopup(account_id: string, amount_minor: number) {
  return post<{ ok: boolean; account_id: string; message?: string }>('/admin/topup', { account_id, amount_minor });
}

export function getExportTransactionsUrl(params?: { from_ts?: number; to_ts?: number; type?: string; currency?: string }) {
  const url = new URL(`${API_BASE_URL}/admin/export/transactions`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

// Types
export interface WorkerTransaction {
  id: number;
  posting_id: number | null;
  type: string;
  amount_minor: number;
  direction: string | null;
  currency: string;
  created_at: number | null;
  metadata_json: string | null;
  status: string;
}

export interface AdminTransaction {
  id: number;
  posting_id: number | null;
  type: string;
  account_id: string | null;
  direction: string | null;
  amount_minor: number;
  created_at: number | null;
  metadata_json: string | null;
  external_id: string | null;
}

export interface Obligation {
  id: number;
  from_pool: string;
  to_pool: string;
  amount_usd_cents: number;
  status: string;
  created_at?: number;
  settlement_batch_id?: number;
}

export interface NetPosition {
  pool_a: string;
  pool_b: string;
  net_usd_cents: number;
  abs_usd_cents: number;
}

export interface SettleRunResult {
  ok: boolean;
  settlement_batch_id: number | null;
  settlement_count: number;
  settlements: { payer: string; payee: string; amount_usd_cents: number }[];
  message?: string;
}
