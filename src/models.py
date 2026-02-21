"""
Pydantic models for API requests and responses
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class TransferRequest(BaseModel):
    """Request model for initiating a transfer"""
    from_pool: str = Field(..., description="Source pool ID")
    to_pool: str = Field(..., description="Destination pool ID")
    amount_minor: int = Field(..., description="Amount in minor units (cents)")


class TopupRequest(BaseModel):
    """Request model for topping up a pool"""
    pool_id: str = Field(..., description="Pool ID to top up")
    amount_minor: int = Field(..., description="Amount in minor units (cents)")


class FXRateRequest(BaseModel):
    """Request model for setting FX rates"""
    currency: str = Field(..., description="Currency code")
    usd_per_unit: float = Field(..., description="Exchange rate to USD")


class PoolResponse(BaseModel):
    """Response model for pool data"""
    id: str
    country: str
    currency: str
    balance: int
    
    class Config:
        from_attributes = True


class ObligationResponse(BaseModel):
    """Response model for obligation data"""
    id: int
    from_pool: str
    to_pool: str
    amount_usd_cents: int
    status: str
    created_at: int
    
    class Config:
        from_attributes = True


class TransferResponse(BaseModel):
    """Response model for transfer data"""
    id: int
    from_pool: str
    to_pool: str
    amount_minor: int
    amount_usd_cents: int
    route: str
    created_at: int
    
    class Config:
        from_attributes = True


class LedgerStateResponse(BaseModel):
    """Response model for current ledger state"""
    pools: List[PoolResponse]
    open_obligations: List[ObligationResponse]
    transfers: List[TransferResponse]


class SettlementDetails(BaseModel):
    """Details for a single settlement"""
    payer: str = Field(..., description="Pool paying")
    payee: str = Field(..., description="Pool receiving")
    amount_usd_cents: int = Field(..., description="Amount in USD cents")


class SettlementResponse(BaseModel):
    """Response model for settlement operation"""
    ok: bool
    settlements: List[SettlementDetails]
    message: Optional[str] = None


class TransferExecutionResponse(BaseModel):
    """Response model for executed transfer"""
    ok: bool
    transfer_id: Optional[int] = None
    amount_usd_cents: int
    route: str
    message: Optional[str] = None


class HealthResponse(BaseModel):
    """Response model for health check"""
    status: str
    version: str


class ErrorResponse(BaseModel):
    """Response model for errors"""
    error: str
    detail: Optional[str] = None
