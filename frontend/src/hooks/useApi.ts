import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from './api';
import type { LedgerState, Metrics, IngestionData } from './api';

// Only refetch when backend is healthy; otherwise stale-but-visible data wins.
const REFETCH_INTERVAL = 15_000; // 15 s (was 5 s — too aggressive when backend is flaky)

/** Empty but structurally correct fallbacks so the UI never goes blank. */
const EMPTY_STATE: LedgerState = { accounts: [], open_obligations: [], queued_payouts: [] };
const EMPTY_METRICS: Metrics = { gross_usd_cents_open: 0, net_usd_cents_if_settle_now: 0, queued_count: 0, transactions_today: 0 };
const EMPTY_INGESTION: IngestionData = {
  state: EMPTY_STATE,
  metrics: EMPTY_METRICS,
  recent_payments: [],
  settlements: [],
  credit_log: [],
} as IngestionData;

export const useLedgerState = () => {
  return useQuery({
    queryKey: ['ledgerState'],
    queryFn: async () => {
      const response = await api.getState();
      return response.data;
    },
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
    enabled: !!workerId,
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
    placeholderData: EMPTY_INGESTION,
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
    enabled: !!accountId,
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
