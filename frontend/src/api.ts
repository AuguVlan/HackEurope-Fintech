const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(path, API_BASE);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    });
  }
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function post<T>(path: string, body: object): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// Worker
export async function listWorkers() {
  return get<{ workers: { id: string; country?: string; currency?: string }[] }>('/workers');
}

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
  const url = new URL(`${API_BASE}/admin/export/transactions`);
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
