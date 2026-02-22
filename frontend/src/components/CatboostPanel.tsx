import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { Brain, Globe2, RefreshCw, UserRound } from 'lucide-react';
import { Badge, Button, Card, Progress, Skeleton, Stat } from './ui';
import { useCountryForecast, useIngestionData, useSettlements, useWorkerIncomeSignal } from '../hooks/useApi';
import { formatCurrency, formatNumber } from '../lib/utils';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info';

const DEFAULT_WORKER_ID = 'worker-acme';
const DEFAULT_COMPANY_ID = 'acme';

const riskVariant = (riskBand?: string): BadgeVariant => {
  if (riskBand === 'critical') return 'danger';
  if (riskBand === 'high') return 'danger';
  if (riskBand === 'medium') return 'warning';
  if (riskBand === 'low') return 'success';
  return 'info';
};

const methodVariant = (method?: string): BadgeVariant => {
  return method === 'catboost-underwriting-v1' ? 'success' : 'warning';
};

const methodLabel = (method?: string): string => {
  return method === 'catboost-underwriting-v1' ? 'CatBoost Active' : 'Heuristic Fallback';
};

const methodLogLabel = (method?: string): string => {
  if (method === 'catboost-underwriting-v1') return 'catboost';
  if (method === 'heuristic-underwriting-v1') return 'heuristic';
  if (!method) return 'unknown';
  return method;
};

const pdAsPercent = (value?: number): number => {
  if (typeof value !== 'number') return 0;
  return Math.max(0, Math.min(100, value * 100));
};

interface CreditLogEntry {
  key: string;
  capturedAt: string;
  method: string;
  pDefault: number;
  riskBand: string;
  triggerState: string;
  advanceMinor: number;
  autoRepaymentMinor: number;
  confidence: number;
}

interface RepaymentLogEntry {
  key: string;
  capturedAt: string;
  defaultState: string;
  repaymentSamples: number;
  repaymentRatio: number;
  onTimeRate: number;
  avgDaysLate: number;
  missedCount: number;
  riskAdjustment: number;
}

const MAX_LOG_ROWS = 20;

export const CatboostPanel: React.FC = () => {
  const [country, setCountry] = useState<'COUNTRY_A' | 'COUNTRY_B'>('COUNTRY_A');
  const [workerInput, setWorkerInput] = useState(DEFAULT_WORKER_ID);
  const [companyInput, setCompanyInput] = useState(DEFAULT_COMPANY_ID);
  const [workerQuery, setWorkerQuery] = useState(DEFAULT_WORKER_ID);
  const [companyQuery, setCompanyQuery] = useState(DEFAULT_COMPANY_ID);
  const [creditLog, setCreditLog] = useState<CreditLogEntry[]>([]);
  const [repaymentLog, setRepaymentLog] = useState<RepaymentLogEntry[]>([]);

  const countryForecast = useCountryForecast(country);
  const workerSignal = useWorkerIncomeSignal(workerQuery, companyQuery || undefined);
  const settlements = useSettlements();
  const ingestion = useIngestionData();

  const workerNeedsMoreHistory = useMemo(() => {
    if (!workerSignal.data) return false;
    return workerSignal.data.method !== 'catboost-underwriting-v1';
  }, [workerSignal.data]);

  const submitWorker = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const worker = workerInput.trim();
    if (!worker) return;
    setWorkerQuery(worker);
    setCompanyQuery(companyInput.trim());
  };

  useEffect(() => {
    if (!workerSignal.data) return;

    const now = new Date().toISOString();
    const creditKey = [
      workerSignal.data.worker_id,
      workerSignal.data.company_id || '',
      workerSignal.data.period,
      workerSignal.data.method,
      workerSignal.data.p_default.toFixed(4),
      workerSignal.data.risk_band,
      workerSignal.data.trigger_state,
      workerSignal.data.micro_credit_advance_minor,
      workerSignal.data.auto_repayment_minor,
    ].join('|');

    const repaymentKey = [
      workerSignal.data.worker_id,
      workerSignal.data.company_id || '',
      workerSignal.data.period,
      workerSignal.data.default_state,
      workerSignal.data.repayment_samples,
      workerSignal.data.repayment_ratio.toFixed(3),
      workerSignal.data.repayment_on_time_rate.toFixed(3),
      workerSignal.data.repayment_avg_days_late.toFixed(2),
      workerSignal.data.repayment_missed_count,
      workerSignal.data.repayment_risk_adjustment.toFixed(3),
    ].join('|');

    setCreditLog((prev) => {
      if (prev[0]?.key === creditKey) return prev;
      const next: CreditLogEntry = {
        key: creditKey,
        capturedAt: now,
        method: workerSignal.data.method,
        pDefault: workerSignal.data.p_default,
        riskBand: workerSignal.data.risk_band,
        triggerState: workerSignal.data.trigger_state,
        advanceMinor: workerSignal.data.micro_credit_advance_minor,
        autoRepaymentMinor: workerSignal.data.auto_repayment_minor,
        confidence: workerSignal.data.confidence,
      };
      return [next, ...prev].slice(0, MAX_LOG_ROWS);
    });

    setRepaymentLog((prev) => {
      if (prev[0]?.key === repaymentKey) return prev;
      const next: RepaymentLogEntry = {
        key: repaymentKey,
        capturedAt: now,
        defaultState: workerSignal.data.default_state,
        repaymentSamples: workerSignal.data.repayment_samples,
        repaymentRatio: workerSignal.data.repayment_ratio,
        onTimeRate: workerSignal.data.repayment_on_time_rate,
        avgDaysLate: workerSignal.data.repayment_avg_days_late,
        missedCount: workerSignal.data.repayment_missed_count,
        riskAdjustment: workerSignal.data.repayment_risk_adjustment,
      };
      return [next, ...prev].slice(0, MAX_LOG_ROWS);
    });
  }, [workerSignal.data]);

  const creditRowsFromIngestion = useMemo(() => {
    return (ingestion.data?.credit_log || []).slice(0, MAX_LOG_ROWS).map((row) => ({
      key: `${row.advance_id}|${row.worker_id}|${row.captured_at}`,
      capturedAt: row.captured_at,
      method: row.method,
      pDefault: row.p_default,
      riskBand: row.risk_band,
      triggerState: row.trigger_state,
      advanceMinor: row.advance_minor,
      autoRepaymentMinor: row.auto_repayment_minor,
      confidence: row.confidence,
    }));
  }, [ingestion.data?.credit_log]);

  const displayedCreditLog = creditRowsFromIngestion.length > 0 ? creditRowsFromIngestion : creditLog;

  const fxRows = (settlements.data || []).slice(0, MAX_LOG_ROWS);

  return (
    <Card className="col-span-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            CatBoost Underwriting
          </h3>
          <p className="text-muted-foreground text-sm">
            Live default-risk scoring from backend `/income-signal` and `/forecast`.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border/20 p-4 bg-card/40">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Country Risk Model</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="input !py-1.5 !px-2.5 text-xs min-w-[120px]"
                value={country}
                onChange={(event) => setCountry(event.target.value as 'COUNTRY_A' | 'COUNTRY_B')}
              >
                <option value="COUNTRY_A">COUNTRY_A</option>
                <option value="COUNTRY_B">COUNTRY_B</option>
              </select>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => countryForecast.refetch()}
                disabled={countryForecast.isFetching}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {countryForecast.isLoading && <Skeleton className="h-32 w-full" />}
          {countryForecast.error && (
            <p className="text-sm text-destructive">Failed to load forecast model output.</p>
          )}
          {countryForecast.data && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={methodVariant(countryForecast.data.method)}>
                  {methodLabel(countryForecast.data.method)}
                </Badge>
                <Badge variant={riskVariant(countryForecast.data.risk_band)}>
                  {countryForecast.data.risk_band.toUpperCase()} RISK
                </Badge>
                <Badge variant={riskVariant(countryForecast.data.overdraft_risk_band)}>
                  OD {countryForecast.data.overdraft_risk_band.toUpperCase()}
                </Badge>
              </div>

              <Progress
                value={pdAsPercent(countryForecast.data.p_default)}
                label={`PD ${pdAsPercent(countryForecast.data.p_default).toFixed(1)}%`}
              />

              <div className="grid grid-cols-2 gap-3">
                <Stat
                  label="Expected Inflow"
                  value={formatCurrency(countryForecast.data.expected_inflow_minor, 'EUR')}
                />
                <Stat
                  label="Expected Outflow"
                  value={formatCurrency(countryForecast.data.expected_outflow_minor, 'EUR')}
                />
                <Stat
                  label="Confidence"
                  value={`${(countryForecast.data.confidence * 100).toFixed(1)}%`}
                />
                <Stat label="Trigger" value={countryForecast.data.trigger_state} />
                <Stat
                  label="Overdraft Risk"
                  value={`${(countryForecast.data.overdraft_risk_score * 100).toFixed(1)}%`}
                />
                <Stat
                  label="Max Credit Limit"
                  value={formatCurrency(countryForecast.data.max_credit_limit_minor, 'EUR')}
                />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border/20 p-4 bg-card/40">
          <div className="flex items-center gap-2 mb-4">
            <UserRound className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Worker Risk Model</p>
          </div>

          <form onSubmit={submitWorker} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
            <input
              className="input"
              value={workerInput}
              onChange={(event) => setWorkerInput(event.target.value)}
              placeholder="worker_id"
            />
            <input
              className="input"
              value={companyInput}
              onChange={(event) => setCompanyInput(event.target.value)}
              placeholder="company_id (optional)"
            />
            <Button type="submit" variant="secondary" disabled={!workerInput.trim() || workerSignal.isFetching}>
              Load worker score
            </Button>
          </form>

          {workerSignal.isLoading && <Skeleton className="h-40 w-full" />}
          {workerSignal.error && (
            <p className="text-sm text-destructive">
              Failed to load worker score. Verify `worker_id` and backend data.
            </p>
          )}
          {workerSignal.data && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={methodVariant(workerSignal.data.method)}>
                  {methodLabel(workerSignal.data.method)}
                </Badge>
                <Badge variant={riskVariant(workerSignal.data.risk_band)}>
                  {workerSignal.data.risk_band.toUpperCase()} RISK
                </Badge>
                <Badge variant={riskVariant(workerSignal.data.overdraft_risk_band)}>
                  OD {workerSignal.data.overdraft_risk_band.toUpperCase()}
                </Badge>
                <Badge variant="info">{workerSignal.data.default_state.toUpperCase()}</Badge>
              </div>

              {workerNeedsMoreHistory && (
                <p className="text-xs text-muted-foreground">
                  CatBoost activates at 12+ succeeded payments for this worker. Current data falls back to heuristic.
                </p>
              )}

              <Progress
                value={pdAsPercent(workerSignal.data.p_default)}
                label={`PD ${pdAsPercent(workerSignal.data.p_default).toFixed(1)}%`}
              />

              <div className="grid grid-cols-2 gap-3">
                <Stat
                  label="Repayment Samples"
                  value={formatNumber(workerSignal.data.repayment_samples)}
                />
                <Stat
                  label="On-time Rate"
                  value={`${(workerSignal.data.repayment_on_time_rate * 100).toFixed(1)}%`}
                />
                <Stat
                  label="Repayment Ratio"
                  value={`${(workerSignal.data.repayment_ratio * 100).toFixed(1)}%`}
                />
                <Stat
                  label="Risk Adjustment"
                  value={workerSignal.data.repayment_risk_adjustment.toFixed(3)}
                />
                <Stat
                  label="Overdraft Risk"
                  value={`${(workerSignal.data.overdraft_risk_score * 100).toFixed(1)}%`}
                />
                <Stat
                  label="Max Credit Limit"
                  value={formatCurrency(workerSignal.data.max_credit_limit_minor, 'EUR')}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
        <div className="rounded-xl border border-border/20 p-4 bg-card/40">
          <p className="text-sm font-semibold mb-3">FX Log (Desired vs Executed)</p>
          {settlements.isLoading && <Skeleton className="h-28 w-full" />}
          {settlements.error && (
            <p className="text-xs text-destructive">Failed to load FX settlement log.</p>
          )}
          {!settlements.isLoading && !settlements.error && (
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
                      <td className="py-2 pr-2 whitespace-nowrap">{row.created_at}</td>
                      <td className="py-2 pr-2">{row.from_country}{'->'}{row.to_country}</td>
                      <td className="py-2 pr-2 text-right">{formatCurrency(row.recommended_minor, 'EUR')}</td>
                      <td className="py-2 pr-2 text-right">
                        {row.executed_minor === null ? '-' : formatCurrency(row.executed_minor, 'EUR')}
                      </td>
                      <td className="py-2">
                        <Badge variant={row.status === 'executed' ? 'success' : 'warning'}>
                          {row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {fxRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-3 text-muted-foreground">
                        No FX logs yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
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
                    <td className="py-2 pr-2 whitespace-nowrap">{row.capturedAt}</td>
                    <td className="py-2 pr-2">{methodLogLabel(row.method)}</td>
                    <td className="py-2 pr-2 text-right">{(row.pDefault * 100).toFixed(1)}%</td>
                    <td className="py-2 pr-2 text-right">{formatCurrency(row.advanceMinor, 'EUR')}</td>
                    <td className="py-2 pr-2 text-right">{formatCurrency(row.autoRepaymentMinor, 'EUR')}</td>
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
                    <td className="py-2 pr-2 whitespace-nowrap">{row.capturedAt}</td>
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
