"""
FastAPI router for the Ingestion Pipeline
==========================================
Exposes the ingestion pipeline as REST endpoints so the existing
Ledger API can mount it as a sub-application.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from .adapters.stripe_adapter import StripeIngestionAdapter
from .fake_stripe import FakeStripeClient
from .income_smoothing import IncomeSmoothingService
from .models import EarningRecord, EarningSourceType, IncomeSmoothing, IncomeState
from .pipeline import IngestionPipeline

# ---------------------------------------------------------------------------
# Response schemas (SRP — separate from domain models)
# ---------------------------------------------------------------------------


class EarningOut(BaseModel):
    worker_id: str
    source: EarningSourceType
    source_transaction_id: str
    amount_minor: int
    currency: str
    earned_at: str
    platform_name: Optional[str] = None


class SmoothingOut(BaseModel):
    worker_id: str
    baseline_minor: int
    latest_earning_minor: int
    delta_minor: int
    state: IncomeState
    window_size: int


class IngestResponse(BaseModel):
    worker_id: str
    total_earnings: int
    source_counts: Dict[str, int]
    smoothing: Optional[SmoothingOut] = None
    earnings: List[EarningOut]


class HealthOut(BaseModel):
    sources: Dict[str, bool]


# ---------------------------------------------------------------------------
# Pipeline factory (wired with FakeStripeClient by default)
# ---------------------------------------------------------------------------

def _build_default_pipeline(delta_minor: int = 2_000) -> IngestionPipeline:
    """Build a pipeline backed by synthetic Stripe data."""
    fake_client = FakeStripeClient(seed=42)
    stripe_adapter = StripeIngestionAdapter(
        client=fake_client,
        platform_name="FakeGigApp",
    )
    return IngestionPipeline(
        repositories={"stripe": stripe_adapter},
        smoothing_service=IncomeSmoothingService(),
        delta_minor=delta_minor,
    )


_pipeline = _build_default_pipeline()

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


@router.get("/health", response_model=HealthOut)
async def ingestion_health():
    """Health-check all registered data sources."""
    return HealthOut(sources=_pipeline.health_check())


@router.get("/worker/{worker_id}", response_model=IngestResponse)
async def ingest_worker(
    worker_id: str,
    source: Optional[str] = Query(None, description="Restrict to a named source"),
    delta: int = Query(2_000, description="Volatility tolerance δ in minor units"),
):
    """
    Run the ingestion + income-smoothing pipeline for a single worker.

    Uses **fake Stripe data** for demonstration — swap the client via DI
    when connecting to the real Stripe Connect API.
    """
    # Allow per-request delta override
    _pipeline._delta = delta
    result = _pipeline.ingest_worker(worker_id, source=source)

    earnings_out = [
        EarningOut(
            worker_id=e.worker_id,
            source=e.source,
            source_transaction_id=e.source_transaction_id,
            amount_minor=e.amount_minor,
            currency=e.currency,
            earned_at=e.earned_at.isoformat(),
            platform_name=e.platform_name,
        )
        for e in result["earnings"]
    ]

    smoothing_out = None
    if result["smoothing"]:
        s = result["smoothing"]
        smoothing_out = SmoothingOut(
            worker_id=s.worker_id,
            baseline_minor=s.baseline_minor,
            latest_earning_minor=s.latest_earning_minor,
            delta_minor=s.delta_minor,
            state=s.state,
            window_size=s.window_size,
        )

    return IngestResponse(
        worker_id=worker_id,
        total_earnings=len(earnings_out),
        source_counts=result["source_counts"],
        smoothing=smoothing_out,
        earnings=earnings_out,
    )
