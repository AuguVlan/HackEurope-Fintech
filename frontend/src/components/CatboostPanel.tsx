import React, { useMemo } from 'react';
import { Brain } from 'lucide-react';
import { Badge, Card, Skeleton } from './ui';
import { useIngestionData, useSettlements } from '../hooks/useApi';
import { formatCurrency, formatNumber } from '../lib/utils';
import { mockCreditLog, mockSettlements, mockRepayments } from '../lib/mockData';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
};

const riskVariant = (riskBand?: string): BadgeVariant => {
  if (riskBand === 'critical') return 'danger';
  if (riskBand === 'high') return 'danger';
  if (riskBand === 'medium') return 'warning';
  if (riskBand === 'low') return 'success';
  return 'info';
};

const methodLogLabel = (method?: string): string => {
  if (method === 'catboost-underwriting-v1') return 'catboost';
  if (method === 'heuristic-underwriting-v1') return 'heuristic';
  if (!method) return 'unknown';
  return method;
};

const MAX_LOG_ROWS = 20;

export const CatboostPanel: React.FC = () => {
  const ingestion = useIngestionData();
  const settlements = useSettlements();

  const hasBackendData = !!(ingestion.data?.credit_log?.length);
  const creditLogData = hasBackendData ? ingestion.data!.credit_log : mockCreditLog();
  const fxRows = hasBackendData ? (settlements.data || ingestion.data?.settlements || []) : mockSettlements();
  const repaymentData = hasBackendData ? (ingestion.data?.recent_repayments || []) : mockRepayments();

  const displayedCreditLog = useMemo(() => {
    return creditLogData.slice(0, MAX_LOG_ROWS).map((row) => ({
      key: `${row.advance_id}|${row.worker_id}|${row.captured_at}`,
      capturedAt: row.captured_at,
      method: row.method,
      pDefault: row.p_default,
      riskBand: row.risk_band,
      triggerState: row.trigger_state,
      advanceMinor: row.advance_minor,
      autoRepaymentMinor: row.auto_repayment_minor,
      confidence: row.confidence,
      currency: row.worker_id?.toLowerCase().includes('tr') ? 'TRY' : 'EUR',
      source: row.source || 'unknown',
    }));
  }, [creditLogData]);

  const repaymentLog = useMemo(() => {
    return repaymentData.slice(0, MAX_LOG_ROWS).map((row) => {
      const due = Math.max(1, row.due_amount_minor || 1);
      const paid = Math.max(0, row.paid_amount_minor || 0);
      const status = String(row.status || '').toLowerCase();
      const defaultState = status === 'paid' ? 'current' : status === 'due' ? 'pending' : status;
      return {
        key: `${row.id}|${row.worker_id}|${row.due_date}`,
        capturedAt: row.created_at,
        defaultState,
        repaymentSamples: 1,
        repaymentRatio: paid / due,
        onTimeRate: status === 'paid' ? 1 : 0,
        avgDaysLate: status === 'paid' ? 0 : 7,
        missedCount: status === 'paid' ? 0 : 1,
        riskAdjustment: status === 'paid' ? 0 : 0.2,
        source: row.source || 'unknown',
      };
    });
  }, [repaymentData]);

  return (
    <Card className="col-span-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            CatBoost Underwriting
          </h3>
          <p className="text-muted-foreground text-sm">
            Default-risk scoring and settlement logs from ingestion pipeline.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="rounded-xl border border-border/20 p-4 bg-card/40">
          <p className="text-sm font-semibold mb-3">FX Log (Desired vs Executed)</p>
          {(ingestion.isLoading || settlements.isLoading) && <Skeleton className="h-24 w-full" />}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/20">
                  <th className="text-left py-2">When</th>
                  <th className="text-left py-2">Route</th>
                  <th className="text-right py-2">Desired FX</th>
                  <th className="text-right py-2">Executed</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {fxRows.slice(0, MAX_LOG_ROWS).map((row) => (
                  <tr key={row.id} className="border-b border-border/10">
                    <td className="py-2 pr-2 whitespace-nowrap">{fmtDate(row.created_at)}</td>
                    <td className="py-2 pr-2">{row.from_country}{'->'}{row.to_country}</td>
                    <td className="py-2 pr-2 text-right">{formatCurrency(row.recommended_minor, row.from_currency || 'EUR')}</td>
                    <td className="py-2 pr-2 text-right">
                      {row.executed_minor === null ? '-' : formatCurrency(row.executed_minor, row.from_currency || 'EUR')}
                    </td>
                    <td className="py-2">
                      <Badge variant={row.status === 'executed' ? 'success' : 'warning'}>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <Badge variant={row.source === 'db' ? 'info' : 'success'}>
                        {String(row.source || 'unknown').toUpperCase()}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-border/20 p-4 bg-card/40">
          <p className="text-sm font-semibold mb-3">Credit Log</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/20">
                  <th className="text-left py-2">When</th>
                  <th className="text-left py-2">Method</th>
                  <th className="text-right py-2">PD</th>
                  <th className="text-right py-2">Advance</th>
                  <th className="text-right py-2">Auto Repay</th>
                  <th className="text-left py-2">Risk</th>
                  <th className="text-left py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {displayedCreditLog.map((row) => (
                  <tr key={row.key} className="border-b border-border/10">
                    <td className="py-2 pr-2 whitespace-nowrap">{fmtDate(row.capturedAt)}</td>
                    <td className="py-2 pr-2">{methodLogLabel(row.method)}</td>
                    <td className="py-2 pr-2 text-right">{(row.pDefault * 100).toFixed(1)}%</td>
                    <td className="py-2 pr-2 text-right">{formatCurrency(row.advanceMinor, row.currency)}</td>
                    <td className="py-2 pr-2 text-right">{formatCurrency(row.autoRepaymentMinor, row.currency)}</td>
                    <td className="py-2">
                      <Badge variant={riskVariant(row.riskBand)}>{row.riskBand}</Badge>
                    </td>
                    <td className="py-2">
                      <Badge variant={row.source === 'db' ? 'info' : 'success'}>
                        {String(row.source).toUpperCase()}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {displayedCreditLog.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-3 text-muted-foreground">
                      No credit logs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-border/20 p-4 bg-card/40">
          <p className="text-sm font-semibold mb-3">Repayment Log</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/20">
                  <th className="text-left py-2">When</th>
                  <th className="text-left py-2">State</th>
                  <th className="text-right py-2">Samples</th>
                  <th className="text-right py-2">On-time</th>
                  <th className="text-right py-2">Missed</th>
                  <th className="text-right py-2">Adj.</th>
                  <th className="text-left py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {repaymentLog.map((row) => (
                  <tr key={row.key} className="border-b border-border/10">
                    <td className="py-2 pr-2 whitespace-nowrap">{fmtDate(row.capturedAt)}</td>
                    <td className="py-2 pr-2">{row.defaultState}</td>
                    <td className="py-2 pr-2 text-right">{formatNumber(row.repaymentSamples)}</td>
                    <td className="py-2 pr-2 text-right">{(row.onTimeRate * 100).toFixed(1)}%</td>
                    <td className="py-2 pr-2 text-right">{formatNumber(row.missedCount)}</td>
                    <td className="py-2 pr-2 text-right">{row.riskAdjustment.toFixed(3)}</td>
                    <td className="py-2">
                      <Badge variant={row.source === 'db' ? 'info' : 'success'}>
                        {String(row.source).toUpperCase()}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {repaymentLog.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-3 text-muted-foreground">
                      No repayment logs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
  );
};
