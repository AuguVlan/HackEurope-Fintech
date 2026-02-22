"""
Ingestion Pipeline — Orchestrator
===================================

Collects earnings from one or more `IDataSourceAdapter` instances,
merges them chronologically, then runs income smoothing.

Usage:
    adapters  = [OpenBankingAdapter(txns), StripeAdapter(payouts)]
    smoother  = IncomeSmoothingService()
    pipeline  = IngestionPipeline(adapters, smoother)
    result    = pipeline.ingest_worker("worker_123")
"""
from __future__ import annotations

from typing import List

from .interfaces import IDataSourceAdapter, IIncomeSmoothingService
from .models import EarningRecord, IncomeSmoothing


class IngestionPipeline:
    """
    Multi-source ingestion orchestrator.

    1. Fetch earnings from every registered adapter
    2. Merge & sort chronologically
    3. Run income smoothing
    4. Return IncomeSmoothing result
    """

    def __init__(
        self,
        adapters: List[IDataSourceAdapter],
        smoothing: IIncomeSmoothingService,
    ) -> None:
        self._adapters  = adapters
        self._smoothing = smoothing

    def ingest_worker(
        self,
        worker_id: str,
        delta: float = 50.0,
    ) -> IncomeSmoothing:
        """Run the full pipeline for a single worker / account."""

        # 1. Collect from all sources
        all_records: List[EarningRecord] = []
        for adapter in self._adapters:
            all_records.extend(adapter.fetch_earnings(worker_id))

        # 2. Sort by date
        all_records.sort(key=lambda r: r.earned_at)

        # 3. Smooth & classify
        return self._smoothing.compute(all_records, delta=delta)
