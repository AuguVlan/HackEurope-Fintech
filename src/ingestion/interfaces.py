"""
Abstract interfaces (ports) for the ingestion layer.

Design notes
────────────
• Interface-first: concrete adapters depend on these ABCs, not the reverse.
• Dependency Inversion: high-level pipeline code only imports this module.
• Each interface has a *single* responsibility (SRP).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import List, Optional, Protocol

from .models import EarningRecord, IncomeSmoothing


# ---------------------------------------------------------------------------
# 1. Alternative Data Repository  (core port)
# ---------------------------------------------------------------------------

class IAlternativeDataRepository(ABC):
    """
    Port that every data-source adapter must implement.

    Responsibilities:
        • Connect to / authenticate with the external provider.
        • Fetch raw earning data for a given worker within a time window.
        • Normalize raw payloads into ``EarningRecord`` instances.

    Why an ABC?
        We follow Open/Closed — adding a new provider (Plaid, Gusto, …)
        means writing a new subclass, *never* modifying this interface.
    """

    @abstractmethod
    def fetch_earnings(
        self,
        worker_id: str,
        *,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
    ) -> List[EarningRecord]:
        """
        Retrieve and normalize earnings for *worker_id*.

        Parameters
        ----------
        worker_id : str
            Platform-level worker identifier.
        since : datetime, optional
            Inclusive lower bound (UTC).
        until : datetime, optional
            Exclusive upper bound (UTC).

        Returns
        -------
        List[EarningRecord]
            Chronologically sorted list of normalized earnings.
        """
        ...

    @abstractmethod
    def ping(self) -> bool:
        """
        Health-check / connectivity test for the external provider.

        Returns True if the provider is reachable.
        """
        ...


# ---------------------------------------------------------------------------
# 2. Income Smoothing Service  (strategy port)
# ---------------------------------------------------------------------------

class IIncomeSmoothingService(ABC):
    """
    Computes the baseline B = (1/N) * Σ E_t  and classifies the worker's
    current income state (Feast / Normal / Famine).
    """

    @abstractmethod
    def compute(
        self,
        earnings: List[EarningRecord],
        delta_minor: int,
    ) -> IncomeSmoothing:
        """
        Compute income-smoothing metrics for a single worker.

        Parameters
        ----------
        earnings : List[EarningRecord]
            Must be non-empty, chronologically ordered.
        delta_minor : int
            Volatility tolerance δ in minor currency units.

        Returns
        -------
        IncomeSmoothing
        """
        ...


# ---------------------------------------------------------------------------
# 3. Earning Record Sink  (output port – e.g. DB writer, event bus, …)
# ---------------------------------------------------------------------------

class IEarningRecordSink(Protocol):
    """
    Structural sub-typing (Protocol) so that *any* callable matching
    this signature can act as a sink — keeps the pipeline decoupled
    from persistence choices.
    """

    def save(self, records: List[EarningRecord]) -> int:
        """Persist records and return the count successfully written."""
        ...
