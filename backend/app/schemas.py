from pydantic import BaseModel, Field


class PaymentCreate(BaseModel):
    country: str = Field(pattern="^COUNTRY_[AB]$")
    company_id: str = Field(min_length=1, max_length=120)
    worker_id: str | None = Field(default=None, min_length=1, max_length=120)
    amount_minor: int = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3)
    service_type: str = Field(min_length=1, max_length=120)


class PaymentResponse(BaseModel):
    id: int
    status: str
    stripe_payment_intent_id: str


class PoolResponse(BaseModel):
    country: str
    balance_minor: int
    currency: str


class ForecastResponse(BaseModel):
    country: str
    period: str
    expected_inflow_minor: int
    expected_outflow_minor: int
    net_minor: int
    confidence: float
    method: str
    baseline_income_minor: int
    current_earnings_minor: int
    trigger_state: str
    micro_credit_advance_minor: int
    auto_repayment_minor: int
    p_default: float
    risk_band: str
    fair_lending_disparate_impact_ratio: float
    fair_lending_audit_status: str
    overdraft_risk_score: float
    overdraft_risk_band: str
    max_credit_limit_minor: int
    overdraft_headroom_minor: int
    overdraft_limit_utilization: float
    overdraft_analysis_confidence: float
    overdraft_analysis_method: str


class IncomeSignalResponse(BaseModel):
    worker_id: str
    company_id: str | None = None
    period: str
    expected_inflow_minor: int
    expected_outflow_minor: int
    net_minor: int
    confidence: float
    method: str
    baseline_income_minor: int
    current_earnings_minor: int
    trigger_state: str
    micro_credit_advance_minor: int
    auto_repayment_minor: int
    p_default: float
    risk_band: str
    fair_lending_disparate_impact_ratio: float
    fair_lending_audit_status: str
    overdraft_risk_score: float
    overdraft_risk_band: str
    max_credit_limit_minor: int
    overdraft_headroom_minor: int
    overdraft_limit_utilization: float
    overdraft_analysis_confidence: float
    overdraft_analysis_method: str
    default_state: str
    default_state_confidence: float
    repayment_samples: int
    repayment_paid_samples: int
    repayment_total_due_minor: int
    repayment_total_paid_minor: int
    repayment_ratio: float
    repayment_on_time_rate: float
    repayment_avg_days_late: float
    repayment_p90_days_late: float
    repayment_max_days_late: int
    repayment_amount_cv: float
    repayment_interval_cv: float
    repayment_missed_count: int
    repayment_risk_adjustment: float




class SettlementResponse(BaseModel):
    id: int
    period: str
    from_country: str
    to_country: str
    from_currency: str | None = None
    to_currency: str | None = None
    base_transfer_minor: int
    forecast_adjustment_minor: int
    recommended_minor: int
    executed_minor: int | None
    status: str
    rationale: str
    stripe_transfer_id: str | None
    created_at: str
