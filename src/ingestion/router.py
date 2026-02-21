"""
FastAPI router for the Ingestion Pipeline
==========================================
Class-based factory so that:
  - No module-level mutable singletons (merge-safe)
  - Pipeline wiring is explicit and injectable
  - Multiple router instances can coexist (e.g. test vs prod)
"""

from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from .adapters.stripe_adapter import StripeIngestionAdapter
from .fake_stripe import FakeStripeClient
from .income_smoothing import IncomeSmoothingService
from .models import EarningSourceType, IncomeState
from .pipeline import IngestionPipeline


# ---------------------------------------------------------------------------
# Response schemas (SRP — separate from domain models)
# ---------------------------------------------------------------------------


class EarningOut(BaseModel):
    """Serialisable earning record for API responses."""
    worker_id: str
    source: EarningSourceType
    source_transaction_id: str
    amount_minor: int
    currency: str
    earned_at: str
    platform_name: Optional[str] = None


class SmoothingOut(BaseModel):
    """Serialisable income-smoothing result for API responses."""
    worker_id: str
    baseline_minor: int
    latest_earning_minor: int
    delta_minor: int
    state: IncomeState
    window_size: int


class IngestResponse(BaseModel):
    """Full pipeline response for a single worker."""
    worker_id: str
    total_earnings: int
    source_counts: Dict[str, int]
    smoothing: Optional[SmoothingOut] = None
    earnings: List[EarningOut]


class HealthOut(BaseModel):
    """Health-check response for all registered sources."""
    sources: Dict[str, bool]


# ---------------------------------------------------------------------------
# Router Factory  (class-based, no module-level mutable state)
# ---------------------------------------------------------------------------


class IngestionRouterFactory:
    """
    Builds a FastAPI ``APIRouter`` wired to an ``IngestionPipeline``.

    Parameters
    ----------
    pipeline : IngestionPipeline
        Fully-configured pipeline instance (injected).
    prefix : str
        URL prefix for the router (default ``"/ingestion"``).
    """

    def __init__(
        self,
        pipeline: IngestionPipeline,
        *,
        prefix: str = "/ingestion",
    ) -> None:
        self._pipeline = pipeline
        self._prefix = prefix

    def build(self) -> APIRouter:
        """Create and return the configured ``APIRouter``."""
        rtr = APIRouter(prefix=self._prefix, tags=["ingestion"])
        self._register_routes(rtr)
        return rtr

    def _register_routes(self, rtr: APIRouter) -> None:
        pipeline = self._pipeline

        @rtr.get("/health", response_model=HealthOut)
        async def ingestion_health():
            """Health-check all registered data sources."""
            return HealthOut(sources=pipeline.health_check())

        @rtr.get("/worker/{worker_id}", response_model=IngestResponse)
        async def ingest_worker(
            worker_id: str,
            source: Optional[str] = Query(None, description="Restrict to a named source"),
            delta: int = Query(2_000, description="Volatility tolerance δ in minor units"),
        ):
            """Run the ingestion + income-smoothing pipeline for a worker."""
            result = pipeline.ingest_worker(worker_id, source=source, delta_override=delta)
            return IngestionRouterFactory._to_response(worker_id, result)

    @staticmethod
    def _to_response(worker_id: str, result: dict) -> IngestResponse:
        """Convert pipeline dict → API response model."""
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


# ---------------------------------------------------------------------------
# Default Pipeline Factory  (convenience class)
# ---------------------------------------------------------------------------


class DefaultPipelineFactory:
    """Builds a default IngestionPipeline backed by FakeStripeClient."""

    @staticmethod
    def create(*, delta_minor: int = 2_000, seed: int = 42) -> IngestionPipeline:
        fake_client = FakeStripeClient(seed=seed)
        stripe_adapter = StripeIngestionAdapter(
            client=fake_client,
            platform_name="FakeGigApp",
        )
        return IngestionPipeline(
            repositories={"stripe": stripe_adapter},
            smoothing_service=IncomeSmoothingService(),
            delta_minor=delta_minor,
        )


# ---------------------------------------------------------------------------
# Module-level convenience  (for `from .router import router`)
# ---------------------------------------------------------------------------

_default_pipeline = DefaultPipelineFactory.create()
_factory = IngestionRouterFactory(_default_pipeline)
router = _factory.build()
