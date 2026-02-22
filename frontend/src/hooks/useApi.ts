import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from './api';
import type { LedgerState, Metrics, IngestionData } from './api';
import {
  mockLedgerState,
  mockMetrics,
  mockPayments,
  mockRepayments,
  mockRemittances,
  mockWorkers,
  mockSettlements,
  mockCreditLog,
  mockActivities,
} from '../lib/mockData';

// ── Backend connectivity flag ──────────────────────────────────────
// Enabled by default. Set VITE_BACKEND_ENABLED=false to disable API calls.
const BACKEND_ENABLED =
  String((import.meta as any).env?.VITE_BACKEND_ENABLED ?? 'true').toLowerCase() !== 'false';

const REFETCH_INTERVAL = 15_000;

/** Rich mock fallbacks so the UI is never blank — populated from mockData.ts */
const MOCK_INGESTION: IngestionData = {
  state: mockLedgerState(),
  metrics: mockMetrics(),
  recent_payments: mockPayments(),
  recent_repayments: mockRepayments(),
  recent_remittances: mockRemittances(),
  workers: mockWorkers(),
  settlements: mockSettlements(),
  credit_log: mockCreditLog(),
  repositories: [],
  generated_at: new Date().toISOString(),
  net_positions: [],
} as IngestionData;

export const useLedgerState = () => {
  return useQuery({
    queryKey: ['ledgerState'],
    queryFn: async () => {
      const response = await api.getState();
      return response.data;
    },
    enabled: BACKEND_ENABLED,
    placeholderData: keepPreviousData,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 10_000,
    retry: 1,
    retryDelay: 3000,
  });
};

export const useMetrics = () => {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: async () => {
      const response = await api.getMetrics();
      return response.data;
    },
    enabled: BACKEND_ENABLED,
    placeholderData: keepPreviousData,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 10_000,
    retry: 1,
    retryDelay: 3000,
  });
};

export const useCountryForecast = (country: 'COUNTRY_A' | 'COUNTRY_B', period?: string) => {
  return useQuery({
    queryKey: ['countryForecast', country, period || null],
    queryFn: async () => {
      const response = await api.getForecastSignal(country, period);
      return response.data;
    },
    enabled: BACKEND_ENABLED,
    placeholderData: keepPreviousData,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 10_000,
    retry: 1,
  });
};

export const useWorkerIncomeSignal = (workerId?: string, companyId?: string, period?: string) => {
  return useQuery({
    queryKey: ['workerIncomeSignal', workerId || null, companyId || null, period || null],
    queryFn: async () => {
      if (!workerId) return null;
      const response = await api.getIncomeSignal(workerId, companyId, period);
      return response.data;
    },
    enabled: BACKEND_ENABLED && !!workerId,
    placeholderData: keepPreviousData,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 10_000,
    retry: 1,
  });
};

export const useSettlements = () => {
  return useQuery({
    queryKey: ['settlements'],
    queryFn: async () => {
      const response = await api.getSettlements();
      return response.data;
    },
    enabled: BACKEND_ENABLED,
    placeholderData: keepPreviousData,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 10_000,
    retry: 1,
  });
};

export const useIngestionData = () => {
  return useQuery({
    queryKey: ['ingestionData'],
    queryFn: async () => {
      const response = await api.getIngestionData();
      return response.data;
    },
    enabled: BACKEND_ENABLED,
    placeholderData: MOCK_INGESTION,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 10_000,
    retry: 1,
    retryDelay: 3000,
  });
};

export const useAccountBalance = (accountId?: string) => {
  return useQuery({
    queryKey: ['accountBalance', accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const response = await api.getState();
      const account = response.data.accounts.find(a => a.id === accountId);
      return account;
    },
    enabled: BACKEND_ENABLED && !!accountId,
    placeholderData: keepPreviousData,
    refetchInterval: REFETCH_INTERVAL,
  });
};

export const useObligations = () => {
  const state = useLedgerState();
  return {
    ...state,
    data: state.data?.open_obligations || [],
  };
};

export const usePayoutQueue = () => {
  const state = useLedgerState();
  return {
    ...state,
    data: state.data?.queued_payouts || [],
  };
};
