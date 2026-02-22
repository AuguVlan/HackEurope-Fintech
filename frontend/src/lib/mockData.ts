/**
 * SINGLE SOURCE OF TRUTH — Realistic Taxi/Gig Economy Data
 * 
 * Germany (EUR): €15–€55 per ride, €300–€800/day, €4.5k–€12k/month net
 * Turkey (TRY): ₺100–₺400 per ride, ₺40k–₺120k/month gross, ₺30k–₺90k net
 * FX Rate: 1 EUR = 36.5 TRY (Feb 2026)
 * 
 * All metrics, pools, and activities derive from credit_log.
 */

import type {
  Account,
  Metrics,
  IngestionPayment,
  IngestionCreditLog,
  SettlementLog,
  ActivityItem,
  LedgerState,
  IngestionWorker,
  IngestionRepayment,
} from '../hooks/api';
import type { Transaction } from '../components/WorkerTransactionTable';

export const FX_RATE = 36.5;

/* ─── Helpers ────────────────────────────────────────────────────────── */

const rng = (() => {
  let s = 42;
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
})();

const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const between = (lo: number, hi: number) => Math.round(lo + rng() * (hi - lo));
const ts = (daysAgo: number) => Math.floor(Date.now() / 1000) - daysAgo * 86400 + between(0, 86400);
const isoDate = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
const uuid = () => `${between(1e6, 9e6)}-${between(1e3, 9e3)}-${between(1e3, 9e3)}`;

const DE_NAMES = [
  'Leon Neumann', 'Markus Klein', 'Finn Neumann', 'Julian Meier', 'Moritz Schwarz',
  'Noah Lehmann', 'Markus Schmitt', 'Christian Klein', 'Daniel Fuchs', 'Amelie Fischer',
  'Niklas Wagner', 'Stefan Hartmann', 'Felix Neumann', 'Theresa Hartmann', 'Tim Becker',
  'Lena Schmidt', 'David Schulz', 'Anna Weber', 'Maximilian Braun', 'Sophie Krüger',
];
const TR_NAMES = [
  'Hasan Ünal', 'Emre Bulut', 'Gül Şahin', 'Zeynep Tunç', 'Selin Doğan',
  'Fatih Güneş', 'Hüseyin Yıldız', 'Pınar Ünal', 'Selim Kara', 'Nur Kaplan',
  'Tuğba Güler', 'Selin Güneş', 'Leyla Polat', 'Serkan Arslan', 'Kemal Tekin',
  'Ayşe Demir', 'Mehmet Çelik', 'Derya Erdoğan', 'Volkan Polat', 'Elif Yılmaz',
];

const ARCHETYPES = ['rock_solid', 'good_volatile', 'stretched_thin', 'red_flags'] as const;
const RISK_BANDS = { rock_solid: 'low', good_volatile: 'medium', stretched_thin: 'medium', red_flags: 'high' } as const;
const STATUSES = ['succeeded', 'succeeded', 'succeeded', 'succeeded', 'processing', 'failed'] as const;
const CREDIT_STATUSES = ['active', 'active', 'active', 'repaid', 'repaid', 'overdue'] as const;

/* ─── CACHED DATA (ensures consistency across all components) ──────── */

let _cachedCreditLog: IngestionCreditLog[] | null = null;
let _cachedAccounts: Account[] | null = null;
let _cachedMetrics: Metrics | null = null;
let _cachedWorkers: IngestionWorker[] | null = null;
let _cachedPayments: IngestionPayment[] | null = null;
let _cachedRepayments: IngestionRepayment[] | null = null;
let _cachedRemittances: any[] | null = null;
let _cachedSettlements: SettlementLog[] | null = null;
let _cachedActivities: ActivityItem[] | null = null;
let _cachedTransactions: Transaction[] | null = null;
let _cachedLedgerState: LedgerState | null = null;

function getCachedCreditLog(): IngestionCreditLog[] {
  if (!_cachedCreditLog) {
    _cachedCreditLog = generateCreditLog();
  }
  return _cachedCreditLog;
}

/* ─── Accounts for the ledger state ────────────────────────────────── */

export function mockAccounts(): Account[] {
  if (_cachedAccounts) return _cachedAccounts;
  const log = mockCreditLog();
  
  // Extract currency-specific exposures
  let eurExposure = 0;
  let tryExposure = 0;
  
  for (const entry of log) {
    if (entry.currency === 'EUR') {
      eurExposure += entry.advance_minor;
    } else {
      tryExposure += entry.advance_minor;
    }
  }
  
  // Pool balances: exposure × buffer multiplier (1.8x for EUR safety, 1.6x for TRY volatility)
  const eurPoolBalance = Math.round(eurExposure * 1.8);
  const tryPoolBalance = Math.round(tryExposure * 1.6);
  
  // Company reserves: 20% of pool balance
  const eurCompanyBalance = Math.round(eurExposure * 0.2);
  const tryCompanyBalance = Math.round(tryExposure * 0.2);
  
  _cachedAccounts = [
    { id: 'POOL_DE_EUR', kind: 'pool', country: 'DE', currency: 'EUR', balance_minor: eurPoolBalance, min_buffer_minor: 50_000 },
    { id: 'POOL_TR_TRY', kind: 'pool', country: 'TR', currency: 'TRY', balance_minor: tryPoolBalance, min_buffer_minor: 100_000 },
    { id: 'COMPANY_GigExpress_EUR', kind: 'company', country: 'DE', currency: 'EUR', balance_minor: eurCompanyBalance, min_buffer_minor: 20_000 },
    { id: 'COMPANY_GigExpress_TRY', kind: 'company', country: 'TR', currency: 'TRY', balance_minor: tryCompanyBalance, min_buffer_minor: 50_000 },
    { id: 'FX_SETTLEMENT', kind: 'settlement', country: 'DE', currency: 'EUR', balance_minor: Math.round(eurPoolBalance * 0.15), min_buffer_minor: 10_000 },
  ];
  return _cachedAccounts;
}

/* ─── Metrics (computed from credit log) ─────────────────────────────── */

export function mockMetrics(): Metrics {
  if (_cachedMetrics) return _cachedMetrics;
  const log = mockCreditLog();
  
  // Compute gross exposure in EUR equivalent
  let grossExposureEur = 0;
  for (const entry of log) {
    const amountEur = entry.currency === 'EUR' 
      ? entry.advance_minor / 100 
      : (entry.advance_minor / 100) / FX_RATE;
    grossExposureEur += amountEur;
  }
  
  // Apply compression ratio (default: 74%)
  const compressionRatio = 0.74;
  const netExposureEur = grossExposureEur * (1 - compressionRatio);
  
  // Convert to EUR cents for display
  const grossEurCents = Math.round(grossExposureEur * 100);
  const netEurCents = Math.round(netExposureEur * 100);
  
  // Calculate lending capacity from pool balances
  const accounts = mockAccounts();
  const eurPool = accounts.find(a => a.id === 'POOL_DE_EUR');
  const tryPool = accounts.find(a => a.id === 'POOL_TR_TRY');
  
  const eurAvailable = (eurPool?.balance_minor || 0) - (eurPool?.min_buffer_minor || 0);
  const tryAvailableInEur = ((tryPool?.balance_minor || 0) - (tryPool?.min_buffer_minor || 0)) / FX_RATE;
  const lendingCapacityEur = Math.max(0, Math.round(eurAvailable + tryAvailableInEur));
  
  // Utilization = how much of capacity is currently deployed
  const utilizationPct = lendingCapacityEur > 0 
    ? Math.min(100, Math.round((grossEurCents / lendingCapacityEur) * 100))
    : 0;
  
  // Active advances count and average
  const activeAdvances = log.filter(l => l.status === 'active').length;
  const avgAdvanceEur = activeAdvances > 0 
    ? Math.round(grossEurCents / activeAdvances)
    : 0;
  
  _cachedMetrics = {
    gross_usd_cents_open: grossEurCents,
    net_usd_cents_if_settle_now: netEurCents,
    queued_count: between(5, 20),
    transactions_today: between(50, 150),
    lending_capacity_eur_cents: lendingCapacityEur,
    utilization_pct: utilizationPct,
    active_advances: activeAdvances,
    avg_advance_eur_cents: avgAdvanceEur,
  };
  return _cachedMetrics;
}

/* ─── Workers ────────────────────────────────────────────────────────── */

export function mockWorkers(): IngestionWorker[] {
  if (_cachedWorkers) return _cachedWorkers;
  const workers: IngestionWorker[] = [];
  // 250 DE + 250 TR
  for (let i = 0; i < 500; i++) {
    const country = i < 250 ? 'DE' : 'TR';
    const names = country === 'DE' ? DE_NAMES : TR_NAMES;
    const name = pick(names);
    const archetype = pick([...ARCHETYPES]);
    const currency = country === 'DE' ? 'EUR' : 'TRY';
    const riskProfile = RISK_BANDS[archetype];
    const avgWage = country === 'DE'
      ? between(2500_00, 8000_00)
      : between(30000_00, 90000_00);
    const repaymentCount = between(archetype === 'red_flags' ? 3 : 12, 48);
    const onTimeRate = archetype === 'rock_solid' ? 0.95 + rng() * 0.05
      : archetype === 'good_volatile' ? 0.80 + rng() * 0.15
      : archetype === 'stretched_thin' ? 0.60 + rng() * 0.25
      : 0.30 + rng() * 0.35;
    const defaultCount = archetype === 'red_flags' ? between(1, 5)
      : archetype === 'stretched_thin' ? between(0, 2)
      : 0;
    const incomeState = archetype === 'rock_solid' ? 'FEAST'
      : archetype === 'good_volatile' ? (rng() > 0.5 ? 'FEAST' : 'NORMAL')
      : archetype === 'stretched_thin' ? 'NORMAL'
      : 'FAMINE';
    workers.push({
      worker_id: `worker-${country.toLowerCase()}-${i + 1}`,
      company_id: 'GigExpress',
      country,
      succeeded_payments: repaymentCount,
      catboost_ready: archetype !== 'red_flags' || rng() > 0.3,
      latest_payment_at: isoDate(between(0, 5)),
      name,
      platform: pick(['GigExpress', 'RideNow', 'CityDrive', 'QuickCab']),
      currency,
      months_active: between(2, 36),
      avg_wage_minor: avgWage,
      income_state: incomeState,
      repayment_count: repaymentCount,
      on_time_rate: parseFloat(onTimeRate.toFixed(3)),
      avg_days_late: archetype === 'red_flags' ? between(5, 30) : archetype === 'stretched_thin' ? between(1, 10) : 0,
      default_count: defaultCount,
      disposable_income_minor: Math.round(avgWage * (0.15 + rng() * 0.25)),
      source: 'csv',
    });
  }
  _cachedWorkers = workers;
  return _cachedWorkers;
}

/* ─── Recent Payments ────────────────────────────────────────────────── */

export function mockPayments(): IngestionPayment[] {
  if (_cachedPayments) return _cachedPayments;
  const payments: IngestionPayment[] = [];
  for (let i = 0; i < 40; i++) {
    const country = rng() < 0.5 ? 'DE' : 'TR';
    const currency = country === 'DE' ? 'EUR' : 'TRY';
    const status = pick([...STATUSES]);
    const wIdx = between(1, 250);
    const amountBase = country === 'DE' ? between(12_00, 65_00) : between(80_00, 450_00);
    payments.push({
      id: i + 1,
      company_id: 'GigExpress',
      worker_id: `worker-${country.toLowerCase()}-${wIdx}`,
      country,
      amount_minor: amountBase,
      currency,
      service_type: pick(['city_ride', 'airport_transfer', 'intercity', 'ride']),
      idempotency_key: `pi_${uuid()}`,
      status,
      created_at: new Date(Date.now() - between(0, 7) * 86400000).toISOString(),
      timestamp: ts(between(0, 7)),
    });
  }
  _cachedPayments = payments.sort((a, b) => b.timestamp - a.timestamp);
  return _cachedPayments;
}

/* ─── Credit Log (advances) — SINGLE SOURCE OF TRUTH ─────────────────── */

function generateCreditLog(): IngestionCreditLog[] {
  const ARCHETYPES_DATA = [
    { label: 'rock_solid', risk: 'low' as const, weight: 0.35 },
    { label: 'good_volatile', risk: 'medium' as const, weight: 0.30 },
    { label: 'stretched_thin', risk: 'medium' as const, weight: 0.20 },
    { label: 'red_flags', risk: 'high' as const, weight: 0.15 },
  ];

  const TOTAL_ADVANCES = 120;
  const log: IngestionCreditLog[] = [];
  let idx = 0;

  for (const arch of ARCHETYPES_DATA) {
    const count = Math.round(TOTAL_ADVANCES * arch.weight);
    for (let i = 0; i < count; i++) {
      const isEur = idx % 3 !== 2;
      const currency = isEur ? 'EUR' : 'TRY';
      const worker = isEur ? pick(DE_NAMES) : pick(TR_NAMES);
      const workerId = isEur ? between(1, 250) : between(251, 500);

      let eurAmount: number;
      switch (arch.risk) {
        case 'low':
          eurAmount = between(800_00, 3000_00) / 100;
          break;
        case 'medium':
          eurAmount = between(400_00, 1500_00) / 100;
          break;
        default:
          eurAmount = between(150_00, 600_00) / 100;
          break;
      }

      const advance = isEur
        ? Math.round(eurAmount * 100)
        : Math.round(eurAmount * FX_RATE * 100);

      let pd: number;
      switch (arch.risk) {
        case 'low':
          pd = 0.005 + rng() * 0.025;
          break;
        case 'medium':
          pd = 0.04 + rng() * 0.08;
          break;
        default:
          pd = 0.15 + rng() * 0.2;
          break;
      }

      log.push({
        advance_id: `adv-${uuid()}`,
        worker_id: `worker-${isEur ? 'de' : 'tr'}-${workerId}`,
        captured_at: new Date(Date.now() - (idx + 1) * 6 * 60 * 60 * 1000).toISOString(),
        method: arch.risk === 'high' ? 'catboost-underwriting-v1' : rng() > 0.5 ? 'catboost-underwriting-v1' : 'heuristic-underwriting-v1',
        p_default: parseFloat(pd.toFixed(4)),
        risk_band: arch.risk,
        trigger_state: pick(['feast', 'stable', 'famine']),
        advance_minor: advance,
        auto_repayment_minor: Math.round(advance * (0.08 + rng() * 0.04)),
        confidence: parseFloat((0.7 + rng() * 0.28).toFixed(2)),
        status: pick(['active', 'active', 'active', 'repaid', 'repaid', 'overdue']),
        days_late: arch.risk === 'high' ? between(0, 45) : arch.risk === 'medium' ? between(0, 14) : 0,
        currency,
      });
      idx++;
    }
  }
  return log.sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime());
}

/** Returns cached credit log (same data across all components) */
export function mockCreditLog(): IngestionCreditLog[] {
  return getCachedCreditLog();
}

/* ─── Settlements ────────────────────────────────────────────────────── */

export function mockSettlements(): SettlementLog[] {
  if (_cachedSettlements) return _cachedSettlements;
  const logs: SettlementLog[] = [];
  for (let i = 0; i < 8; i++) {
    const daysAgo = i * 3 + between(0, 2);
    const baseTransfer = between(5000_00, 25000_00);
    const adjustment = between(-2000_00, 3000_00);
    const recommended = baseTransfer + adjustment;
    logs.push({
      id: i + 1,
      period: isoDate(daysAgo),
      from_country: i % 2 === 0 ? 'DE' : 'TR',
      to_country: i % 2 === 0 ? 'TR' : 'DE',
      from_currency: i % 2 === 0 ? 'EUR' : 'TRY',
      to_currency: i % 2 === 0 ? 'TRY' : 'EUR',
      base_transfer_minor: baseTransfer,
      forecast_adjustment_minor: adjustment,
      recommended_minor: recommended,
      executed_minor: rng() > 0.15 ? recommended : null,
      status: rng() > 0.15 ? 'executed' : 'pending',
      rationale: `Net position rebalance: ${i % 2 === 0 ? 'DE→TR' : 'TR→DE'} corridor`,
      stripe_transfer_id: rng() > 0.15 ? `tr_${uuid()}` : null,
      created_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    });
  }
  _cachedSettlements = logs;
  return _cachedSettlements;
}

/* ─── Repayments ─────────────────────────────────────────────────────── */

export function mockRepayments(): IngestionRepayment[] {
  if (_cachedRepayments) return _cachedRepayments;
  const repayments: IngestionRepayment[] = [];
  for (let i = 0; i < 30; i++) {
    const country = rng() < 0.5 ? 'DE' : 'TR';
    const wIdx = between(1, 250);
    const due = country === 'DE' ? between(80_00, 400_00) : between(1200_00, 6000_00);
    const isLate = rng() < 0.2;
    const isPaid = rng() > 0.1;
    repayments.push({
      id: i + 1,
      company_id: 'GigExpress',
      worker_id: `worker-${country.toLowerCase()}-${wIdx}`,
      due_date: isoDate(between(0, 30)),
      due_amount_minor: due,
      paid_at: isPaid ? new Date(Date.now() - between(0, 25) * 86400000).toISOString() : null,
      paid_amount_minor: isPaid ? due : null,
      status: isPaid ? (isLate ? 'late' : 'on_time') : 'pending',
      created_at: new Date(Date.now() - between(25, 60) * 86400000).toISOString(),
    });
  }
  _cachedRepayments = repayments;
  return _cachedRepayments;
}

/* ─── Activity Feed ──────────────────────────────────────────────────── */

export function mockActivities(): ActivityItem[] {
  if (_cachedActivities) return _cachedActivities;
  const now = Math.floor(Date.now() / 1000);
  const log = mockCreditLog();
  
  // Generate activities from actual credit log entries
  const activities: ActivityItem[] = [];
  
  for (let i = 0; i < Math.min(10, log.length); i++) {
    const entry = log[i];
    const workerKey = entry.worker_id.split('-').pop() || 'unknown';
    const amount = entry.advance_minor;
    const ccy = entry.currency === 'EUR' ? '€' : '₺';
    const pool = entry.currency === 'EUR' ? 'POOL_DE_EUR' : 'POOL_TR_TRY';
    
    activities.push({
      id: `act-${i + 1}`,
      type: 'obligation_created',
      timestamp: now - (i + 1) * 3600,
      data: { worker: entry.worker_id, amount, currency: entry.currency },
      description: `Advance ${ccy}${(amount / 100).toFixed(2)} issued to ${entry.worker_id}`,
      icon: 'FileText',
    });
  }
  
  // Add settlement activities every 3-4 entries
  const settlementIndices = [3, 7];
  for (const idx of settlementIndices) {
    if (idx < activities.length) {
      activities.splice(idx, 0, {
        id: `act-settle-${idx}`,
        type: 'settlement_batch',
        timestamp: activities[idx]!.timestamp - 1800,
        data: { from: 'DE', to: 'TR', amount: between(5000_00, 15000_00) },
        description: `Settlement DE → TR: €${((between(5000_00, 15000_00)) / 100).toFixed(2)} executed`,
        icon: 'CheckCircle2',
      });
    }
  }
  
  _cachedActivities = activities.sort((a, b) => b.timestamp - a.timestamp);
  return _cachedActivities;
}

/* ─── Transactions for the table ─────────────────────────────────────── */

export function mockTransactions(): Transaction[] {
  if (_cachedTransactions) return _cachedTransactions;
  const payments = mockPayments();
  _cachedTransactions = payments.map((p) => ({
    id: p.id,
    timestamp: p.timestamp,
    type: p.service_type,
    from_account: `COMPANY_GigExpress_${p.currency}`,
    to_account: `POOL_${p.country}_${p.currency}`,
    amount_minor: p.amount_minor,
    currency: p.currency,
    status: p.status === 'succeeded' ? 'EXECUTED'
      : p.status === 'processing' ? 'PENDING'
      : p.status === 'failed' ? 'FAILED'
      : 'PENDING',
    idempotency_key: p.idempotency_key,
  }));
  return _cachedTransactions;
}

/* ─── Remittances (FX transfers) ─────────────────────────────────────── */

export function mockRemittances(): import('../hooks/api').IngestionRemittance[] {
  if (_cachedRemittances) return _cachedRemittances;
  const remittances: import('../hooks/api').IngestionRemittance[] = [];
  for (let i = 0; i < 25; i++) {
    const isEurToTry = rng() > 0.35;
    const currSent = isEurToTry ? 'EUR' : 'TRY';
    const currRecv = isEurToTry ? 'TRY' : 'EUR';
    const destCountry = isEurToTry ? 'TR' : 'DE';
    const sentMinor = isEurToTry ? between(500_00, 5000_00) : between(15000_00, 180000_00);
    const fxRate = 34.50 + rng() * 1.0;
    const receivedMinor = isEurToTry
      ? Math.round(sentMinor * fxRate)
      : Math.round(sentMinor / fxRate);
    const wCountry = isEurToTry ? 'de' : 'tr';
    const wIdx = between(1, 250);
    const daysAgo = between(0, 30);
    remittances.push({
      id: i + 1,
      tx_id: `fx-${uuid()}`,
      worker_id: `worker-${wCountry}-${wIdx}`,
      stripe_payment_intent: `pi_${uuid()}`,
      date: isoDate(daysAgo),
      amount_sent_minor: sentMinor,
      currency_sent: currSent,
      amount_received_minor: receivedMinor,
      currency_received: currRecv,
      exchange_rate: parseFloat(fxRate.toFixed(4)),
      destination_country: destCountry,
      status: pick(['completed', 'completed', 'completed', 'completed', 'pending']),
      timestamp: ts(daysAgo),
      source: 'csv',
    });
  }
  _cachedRemittances = remittances.sort((a, b) => b.timestamp - a.timestamp);
  return _cachedRemittances;
}

/* ─── Full mock state ────────────────────────────────────────────────── */

export function mockLedgerState(): LedgerState {
  if (_cachedLedgerState) return _cachedLedgerState;
  _cachedLedgerState = {
    accounts: mockAccounts(),
    open_obligations: [
      { id: 1, from_pool: 'POOL_DE_EUR', to_pool: 'POOL_TR_TRY', amount_usd_cents: 25000_00, status: 'open', created_at: ts(1) },
      { id: 2, from_pool: 'POOL_TR_TRY', to_pool: 'POOL_DE_EUR', amount_usd_cents: 8500_00, status: 'open', created_at: ts(2) },
      { id: 3, from_pool: 'POOL_DE_EUR', to_pool: 'POOL_TR_TRY', amount_usd_cents: 12000_00, status: 'open', created_at: ts(0) },
      { id: 4, from_pool: 'POOL_TR_TRY', to_pool: 'POOL_DE_EUR', amount_usd_cents: 6200_00, status: 'open', created_at: ts(1) },
      { id: 5, from_pool: 'POOL_DE_EUR', to_pool: 'POOL_TR_TRY', amount_usd_cents: 18750_00, status: 'open', created_at: ts(0) },
    ],
    queued_payouts: [
      { id: 1, from_pool: 'POOL_DE_EUR', to_pool: 'worker-de-42', amount_minor: 285_00, status: 'queued', created_at: ts(0) },
      { id: 2, from_pool: 'POOL_TR_TRY', to_pool: 'worker-tr-45', amount_minor: 6300_00, status: 'queued', created_at: ts(0) },
    ],
  };
  return _cachedLedgerState;
}
