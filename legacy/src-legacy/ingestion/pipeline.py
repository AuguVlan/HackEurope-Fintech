"""
Ingestion Pipeline
==================
Orchestrates the full data-ingestion flow:

    fake Stripe → StripeIngestionAdapter → IncomeSmoothing → sink / API

All collaborators are injected (Dependency Inversion), so the pipeline
is fully testable with mocks.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

from .interfaces import (
    IAlternativeDataRepository,
    IIncomeSmoothingService,
)
from .models import EarningRecord, IncomeSmoothing

logger = logging.getLogger(__name__)


class IngestionPipeline:
    """
    Coordinates one or more ``IAlternativeDataRepository`` adapters,
    feeds their output into the ``IIncomeSmoothingService``, and
    optionally persists results through a sink callback.

    Parameters
    ----------
    repositories : dict[str, IAlternativeDataRepository]
        Named data-source adapters (e.g. ``{"stripe": adapter}``).
    smoothing_service : IIncomeSmoothingService
        Computes baseline & feast/famine classification.
    delta_minor : int
        Default volatility tolerance δ (in minor units).
    """

    def __init__(
        self,
        repositories: Dict[str, IAlternativeDataRepository],
        smoothing_service: IIncomeSmoothingService,
        *,
        delta_minor: int = 2_000,  # $20.00 default
    ) -> None:
        self._repos = repositories
        self._smoothing = smoothing_service
        self._delta = delta_minor

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def ingest_worker(
        self,
        worker_id: str,
        *,
        source: Optional[str] = None,
        delta_override: Optional[int] = None,
    ) -> Dict:
        """
        Run the full pipeline for a single worker.

        Parameters
        ----------
        worker_id : str
            Platform-level worker identifier.
        source : str, optional
            Restrict to a single named repository. If ``None``, all
            registered repos are queried and results merged.
        delta_override : int, optional
            Per-call override for δ. Falls back to instance default.

        Returns
        -------
        dict with keys ``earnings``, ``smoothing``, ``source_counts``.
        """
        delta = delta_override if delta_override is not None else self._delta
        all_earnings: List[EarningRecord] = []
        source_counts: Dict[str, int] = {}

        repos = (
            {source: self._repos[source]}
            if source and source in self._repos
            else self._repos
        )

        for name, repo in repos.items():
            try:
                records = repo.fetch_earnings(worker_id)
                all_earnings.extend(records)
                source_counts[name] = len(records)
                logger.info(
                    "Source '%s' returned %d records for %s",
                    name,
                    len(records),
                    worker_id,
                )
            except Exception:
                logger.exception(
                    "Source '%s' failed for worker %s", name, worker_id
                )
                source_counts[name] = 0

        # Chronological merge across sources
        all_earnings.sort(key=lambda r: r.earned_at)

        smoothing: Optional[IncomeSmoothing] = None
        if all_earnings:
            smoothing = self._smoothing.compute(all_earnings, delta)

        return {
            "worker_id": worker_id,
            "earnings": all_earnings,
            "smoothing": smoothing,
            "source_counts": source_counts,
        }

    def health_check(self) -> Dict[str, bool]:
        """Ping every registered repository and report status."""
        return {name: repo.ping() for name, repo in self._repos.items()}
