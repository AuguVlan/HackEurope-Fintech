from pydantic import BaseModel, Field


class PaymentCreate(BaseModel):
    country: str = Field(pattern="^COUNTRY_[AB]$")
    company_id: str = Field(min_length=1, max_length=120)
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


class SettlementResponse(BaseModel):
    id: int
    period: str
    from_country: str
    to_country: str
    base_transfer_minor: int
    forecast_adjustment_minor: int
    recommended_minor: int
    executed_minor: int | None
    status: str
    rationale: str
    stripe_transfer_id: str | None
    created_at: str
