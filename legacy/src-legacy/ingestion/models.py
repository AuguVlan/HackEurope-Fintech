"""
Domain models for the ingestion layer.

Single Responsibility: each model captures one concept.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class EarningSourceType(str, Enum):
    """Identifies the external provider that produced the earning."""
    STRIPE_CONNECT = "stripe_connect"
    OPEN_BANKING = "open_banking"
    PAYROLL_API = "payroll_api"


class IncomeState(str, Enum):
    """
    Feast / Famine classification derived from the income-smoothing model.

    FEAST  → E_t > B + δ
    NORMAL → B - δ ≤ E_t ≤ B + δ
    FAMINE → E_t < B - δ
    """
    FEAST = "feast"
    NORMAL = "normal"
    FAMINE = "famine"


# ---------------------------------------------------------------------------
# Canonical earning record (internal representation)
# ---------------------------------------------------------------------------

class EarningRecord(BaseModel):
    """
    Normalized earning event from *any* data source.

    This is the single internal contract that every adapter must produce.
    All monetary values are stored in **minor units** (cents / pence / …).
    """

    worker_id: str = Field(
        ..., description="Platform-level unique identifier for the gig worker"
    )
    source: EarningSourceType = Field(
        ..., description="Which provider supplied this record"
    )
    source_transaction_id: str = Field(
        ..., description="Original transaction / payout ID from the provider"
    )
    amount_minor: int = Field(
        ..., ge=0, description="Earned amount in minor units of the currency"
    )
    currency: str = Field(
        ..., min_length=3, max_length=3, description="ISO 4217 currency code"
    )
    earned_at: datetime = Field(
        ..., description="Timestamp when the earning was finalised"
    )
    platform_name: Optional[str] = Field(
        None, description="Human-readable name of the gig platform (e.g. 'Uber')"
    )
    metadata: dict = Field(
        default_factory=dict,
        description="Extra provider-specific data preserved for auditing",
    )
    ingested_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Timestamp when the record entered our system",
    )

    class Config:
        frozen = True  # immutable after creation — safe for pipelines


# ---------------------------------------------------------------------------
# Income Smoothing result (attached per-worker)
# ---------------------------------------------------------------------------

class IncomeSmoothing(BaseModel):
    """
    Result of applying the baseline formula B = (1/N) * Σ E_t
    and classifying the latest earning against volatility tolerance δ.
    """

    worker_id: str
    baseline_minor: int = Field(
        ..., description="Computed baseline B in minor units"
    )
    latest_earning_minor: int = Field(
        ..., description="Most recent E_t used for classification"
    )
    delta_minor: int = Field(
        ..., description="Volatility tolerance δ in minor units"
    )
    state: IncomeState
    window_size: int = Field(
        ..., ge=1, description="Number of periods N used in the baseline"
    )
