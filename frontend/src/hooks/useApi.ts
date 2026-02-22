import { useQuery } from '@tanstack/react-query';
import { api } from './api';

const REFETCH_INTERVAL = 5000; // 5 seconds

export const useLedgerState = () => {
  return useQuery({
    queryKey: ['ledgerState'],
    queryFn: async () => {
      const response = await api.getState();
      return response.data;
    },
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 2000,
  });
};

export const useMetrics = () => {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: async () => {
      const response = await api.getMetrics();
      return response.data;
    },
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 2000,
  });
};

export const useCountryForecast = (country: 'COUNTRY_A' | 'COUNTRY_B', period?: string) => {
  return useQuery({
    queryKey: ['countryForecast', country, period || null],
    queryFn: async () => {
      const response = await api.getForecastSignal(country, period);
      return response.data;
    },
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 2000,
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
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 2000,
  });
};

export const useSettlements = () => {
  return useQuery({
    queryKey: ['settlements'],
    queryFn: async () => {
      const response = await api.getSettlements();
      return response.data;
    },
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 2000,
  });
};

export const useIngestionData = () => {
  return useQuery({
    queryKey: ['ingestionData'],
    queryFn: async () => {
      const response = await api.getIngestionData();
      return response.data;
    },
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 2000,
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
