"""
Income Smoothing Service
========================

Implements the core BaaS formula:

    B = (1/N) × Σ Eₜ       (baseline = average earning per period)

Classification with volatility tolerance δ (default €50):

    current > baseline + δ   →  FEAST
    current < baseline − δ   →  FAMINE
    otherwise                →  NORMAL
"""
from __future__ import annotations

from typing import List

from .interfaces import IIncomeSmoothingService
from .models import EarningRecord, IncomeSmoothing, IncomeState


class IncomeSmoothingService(IIncomeSmoothingService):
    """Concrete implementation of income smoothing."""

    def compute(
        self,
        records: List[EarningRecord],
        delta: float = 50.0,
    ) -> IncomeSmoothing:
        # ── Edge case: no records ─────────────────────────────────────
        if not records:
            return IncomeSmoothing(
                worker_id="unknown",
                baseline=0.0,
                current=0.0,
                delta=delta,
                state=IncomeState.FAMINE,
                records_count=0,
                total_earned=0.0,
            )

        # ── Core calculation ──────────────────────────────────────────
        worker_id = records[0].worker_id
        amounts   = [r.amount_eur for r in records]
        total     = sum(amounts)
        n         = len(amounts)
        baseline  = total / n          # B = (1/N) × Σ Eₜ
        current   = amounts[-1]        # most recent earning

        # ── Classification ────────────────────────────────────────────
        if current > baseline + delta:
            state = IncomeState.FEAST
        elif current < baseline - delta:
            state = IncomeState.FAMINE
        else:
            state = IncomeState.NORMAL

        return IncomeSmoothing(
            worker_id=worker_id,
            baseline=round(baseline, 2),
            current=round(current, 2),
            delta=delta,
            state=state,
            records_count=n,
            total_earned=round(total, 2),
        )
