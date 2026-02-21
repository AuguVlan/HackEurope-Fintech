import { useQuery } from '@tanstack/react-query';
import { api, LedgerState, Metrics } from '../api';

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
