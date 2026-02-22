"""
Abstract interfaces — depend on these, not concrete implementations.

Every data-source adapter and service in the ingestion layer must
satisfy one of these contracts.  This enables easy testing (mock
adapters) and adding new data sources without touching the pipeline.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List, Protocol

from .models import EarningRecord, IncomeSmoothing


class IDataSourceAdapter(ABC):
    """
    Contract every alternative data-source adapter must satisfy.

    Implementors: OpenBankingAdapter, StripeAdapter, …
    """

    @abstractmethod
    def source_name(self) -> str:
        """Return a human-readable source identifier (e.g. 'open_banking')."""
        ...

    @abstractmethod
    def fetch_earnings(self, worker_id: str) -> List[EarningRecord]:
        """
        Fetch and normalise earnings for *worker_id*.

        Returns a list of `EarningRecord` sorted chronologically.
        """
        ...


class IIncomeSmoothingService(ABC):
    """
    Income smoothing service.

    B = (1/N) × Σ Eₜ   with volatility tolerance δ.
    Classifies the worker as FEAST / NORMAL / FAMINE.
    """

    @abstractmethod
    def compute(
        self,
        records: List[EarningRecord],
        delta: float = 50.0,
    ) -> IncomeSmoothing:
        ...


class IRecordSink(Protocol):
    """
    Anything that can receive normalised records (database, queue, CSV …).

    This is a *structural* (Protocol) interface — no need to subclass,
    just implement `write(records)`.
    """

    def write(self, records: List[EarningRecord]) -> None:
        ...
