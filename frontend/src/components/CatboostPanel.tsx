import React, { useMemo } from 'react';
import { Brain } from 'lucide-react';
import { Badge, Card } from './ui';
import { mockCreditLog, mockSettlements, mockRepayments } from '../lib/mockData';
import { formatCurrency, formatNumber } from '../lib/utils';

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
  // ── Use mock data (no backend calls) ──
  const creditLogData = useMemo(() => mockCreditLog(), []);
  const fxRows = useMemo(() => mockSettlements(), []);
  const repaymentData = useMemo(() => mockRepayments(), []);

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
      currency: row.currency || (row.worker_id?.includes('-tr-') ? 'TRY' : 'EUR'),
    }));
  }, [creditLogData]);

  const repaymentLog = useMemo(() => {
    return repaymentData.slice(0, MAX_LOG_ROWS).map((row) => ({
      key: `${row.id}|${row.worker_id}|${row.due_date}`,
      capturedAt: row.created_at,
      defaultState: row.status === 'on_time' ? 'current' : row.status === 'late' ? 'delinquent' : 'pending',
      repaymentSamples: 1,
      repaymentRatio: row.paid_amount_minor ? row.paid_amount_minor / row.due_amount_minor : 0,
      onTimeRate: row.status === 'on_time' ? 1 : row.status === 'late' ? 0.7 : 0,
      avgDaysLate: row.status === 'late' ? 8.5 : 0,
      missedCount: row.status === 'pending' ? 1 : 0,
      riskAdjustment: row.status === 'on_time' ? 0 : row.status === 'late' ? 0.15 : 0.35,
    }));
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
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/20">
                    <th className="text-left py-2">When</th>
                    <th className="text-left py-2">Route</th>
                    <th className="text-right py-2">Desired FX</th>
                    <th className="text-right py-2">Executed</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fxRows.map((row) => (
                    <tr key={row.id} className="border-b border-border/10">
                      <td className="py-2 pr-2 whitespace-nowrap">{fmtDate(row.created_at)}</td>
                      <td className="py-2 pr-2">{row.from_country}{'->'}{row.to_country}</td>
                      <td className="py-2 pr-2 text-right">{formatCurrency(row.recommended_minor, row.from_currency)}</td>
                      <td className="py-2 pr-2 text-right">
                        {row.executed_minor === null ? '-' : formatCurrency(row.executed_minor, row.from_currency)}
                      </td>
                      <td className="py-2">
                        <Badge variant={row.status === 'executed' ? 'success' : 'warning'}>
                          {row.status}
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
                  </tr>
                ))}
                {displayedCreditLog.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-muted-foreground">
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
                  </tr>
                ))}
                {repaymentLog.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-muted-foreground">
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
