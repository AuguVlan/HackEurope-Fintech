"""
Pydantic models (schemas) for API requests and responses (PDF spec).
"""

from pydantic import BaseModel, Field
from typing import List, Optional


# ----- PDF request models -----

class PayoutRequest(BaseModel):
    """Request for POST /payout"""
    from_pool: str = Field(..., description="Source pool/account ID (e.g. POOL_UK_GBP)")
    to_pool: str = Field(..., description="Destination pool/account ID")
    amount_minor: int = Field(..., description="Amount in minor units (cents)")


class SettleRunRequest(BaseModel):
    """Request for POST /settle/run"""
    threshold_usd_cents: int = Field(0, description="Only settle pairs where abs(net) > this threshold")


class AdminTopupRequest(BaseModel):
    """Request for POST /admin/topup"""
    account_id: str = Field(..., description="Account ID to top up")
    amount_minor: int = Field(..., description="Amount in minor units to add")


# ----- Response models -----

class AccountResponse(BaseModel):
    """Account (pool) data for GET /state"""
    id: str
    kind: str
    country: str
    currency: str
    balance_minor: int
    min_buffer_minor: int

    class Config:
        from_attributes = True


class ObligationResponse(BaseModel):
    """Obligation data"""
    id: int
    from_pool: str
    to_pool: str
    amount_usd_cents: int
    status: str
    created_at: Optional[int] = None
    settlement_batch_id: Optional[int] = None

    class Config:
        from_attributes = True


class PayoutQueueItemResponse(BaseModel):
    """Single queued payout"""
    id: int
    from_pool: str
    to_pool: str
    amount_minor: int
    status: str
    created_at: Optional[int] = None


class LedgerStateResponse(BaseModel):
    """Response for GET /state"""
    accounts: List[AccountResponse]
    open_obligations: List[ObligationResponse]
    queued_payouts: List[PayoutQueueItemResponse]


class MetricsResponse(BaseModel):
    """Response for GET /metrics"""
    gross_usd_cents_open: int = Field(..., description="Sum of OPEN obligation amounts in USD cents")
    net_usd_cents_if_settle_now: int = Field(..., description="Sum of abs(net) per pair if settled now")
    queued_count: int = Field(..., description="Count of QUEUED items in payout_queue")
    transactions_today: int = Field(0, description="Journal entries created today")


class SettlementDetails(BaseModel):
    """Single settlement (payer -> payee)"""
    payer: str
    payee: str
    amount_usd_cents: int


class PayoutResponse(BaseModel):
    """Response for POST /payout (executed or queued)"""
    ok: bool
    queued: bool = False
    journal_entry_id: Optional[int] = None
    obligation_id: Optional[int] = None
    amount_usd_cents: Optional[int] = None
    payout_queue_id: Optional[int] = None
    message: Optional[str] = None


class SettleRunResponse(BaseModel):
    """Response for POST /settle/run"""
    ok: bool
    settlement_batch_id: Optional[int] = None
    settlement_count: int = 0
    settlements: List[SettlementDetails] = []
    message: Optional[str] = None


class AdminTopupResponse(BaseModel):
    """Response for POST /admin/topup"""
    ok: bool
    account_id: str
    journal_entry_id: Optional[int] = None
    message: Optional[str] = None


class HealthResponse(BaseModel):
    """Response for GET /health"""
    status: str
    version: str


class ErrorResponse(BaseModel):
    """Error response"""
    error: str
    detail: Optional[str] = None
