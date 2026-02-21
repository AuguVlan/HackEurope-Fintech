import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

  // Payout
  createPayout: (data: PayoutRequest) => 
    apiClient.post('/payout', data, {
      headers: { 'Idempotency-Key': data.idempotency_key || crypto.randomUUID() }
    }),

  // Settlement
  runSettlement: (data: SettleRunRequest = {}) => 
    apiClient.post('/settle/run', data),

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
  return post<SettleRunResult>('/settle/run', { threshold_usd_cents });
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
