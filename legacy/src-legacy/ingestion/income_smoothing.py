"""
Income Smoothing Service
========================
Concrete implementation of ``IIncomeSmoothingService``.

Formula:  B = (1 / N) × Σ E_t   (simple moving-average baseline)

Classification:
    FEAST  → latest E_t > B + δ
    FAMINE → latest E_t < B − δ
    NORMAL → otherwise
"""

from __future__ import annotations

from typing import List

from .interfaces import IIncomeSmoothingService
from .models import EarningRecord, IncomeSmoothing, IncomeState


class IncomeSmoothingService(IIncomeSmoothingService):
    """
    Stateless service — takes an earnings window and a tolerance δ,
    returns a classification.  No side-effects (SRP).
    """

    def compute(
        self,
        earnings: List[EarningRecord],
        delta_minor: int,
    ) -> IncomeSmoothing:
        if not earnings:
            raise ValueError("earnings must be non-empty")

        n = len(earnings)
        total = sum(e.amount_minor for e in earnings)
        baseline = total // n  # integer division keeps us in minor units

        latest = earnings[-1].amount_minor  # chronologically last

        if latest > baseline + delta_minor:
            state = IncomeState.FEAST
        elif latest < baseline - delta_minor:
            state = IncomeState.FAMINE
        else:
            state = IncomeState.NORMAL

        return IncomeSmoothing(
            worker_id=earnings[0].worker_id,
            baseline_minor=baseline,
            latest_earning_minor=latest,
            delta_minor=delta_minor,
            state=state,
            window_size=n,
        )
