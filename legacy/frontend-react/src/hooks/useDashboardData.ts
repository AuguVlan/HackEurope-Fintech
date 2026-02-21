import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMetrics,
  getState,
  runSettlement,
  type LedgerState,
  type Metrics,
  type SettlementResult,
} from "../api";

const REFRESH_INTERVAL_MS = 5_000;

export function useLedgerState() {
  return useQuery({
    queryKey: ["state"],
    queryFn: getState,
    refetchInterval: REFRESH_INTERVAL_MS,
    staleTime: 2_000,
  });
}

export function useMetrics() {
  return useQuery({
    queryKey: ["metrics"],
    queryFn: getMetrics,
    refetchInterval: REFRESH_INTERVAL_MS,
    staleTime: 2_000,
  });
}

export function useRunSettlement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (thresholdUsdCents?: number) =>
      runSettlement(thresholdUsdCents ?? 0),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["state"] });
      await queryClient.cancelQueries({ queryKey: ["metrics"] });

      const previousState = queryClient.getQueryData<LedgerState>(["state"]);
      const previousMetrics = queryClient.getQueryData<Metrics>(["metrics"]);

      if (previousState) {
        queryClient.setQueryData<LedgerState>(["state"], {
          ...previousState,
          open_obligations: [],
        });
      }

      if (previousMetrics) {
        queryClient.setQueryData<Metrics>(["metrics"], {
          ...previousMetrics,
          gross_usd_cents_open: 0,
          net_usd_cents_if_settle_now: 0,
          settlement_compression_ratio: 1,
        });
      }

      return { previousState, previousMetrics };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousState) {
        queryClient.setQueryData(["state"], context.previousState);
      }
      if (context?.previousMetrics) {
        queryClient.setQueryData(["metrics"], context.previousMetrics);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["state"] });
      void queryClient.invalidateQueries({ queryKey: ["metrics"] });
    },
  });
}

export type SettlementMutation = ReturnType<typeof useRunSettlement>;
export type SettlementResponse = SettlementResult;
