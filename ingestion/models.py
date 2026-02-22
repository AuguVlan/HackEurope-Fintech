"""
Canonical data models for the ingestion layer.

All adapters normalise raw platform data into these models before
passing them through the pipeline.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict


# ── Enums ─────────────────────────────────────────────────────────────

class IncomeState(Enum):
    """Classification of a worker's current income relative to baseline."""
    FEAST  = "FEAST"
    NORMAL = "NORMAL"
    FAMINE = "FAMINE"


class EarningSourceType(Enum):
    """Supported alternative data sources."""
    STRIPE_CONNECT = "stripe_connect"
    OPEN_BANKING   = "open_banking"
    PAYROLL_API    = "payroll_api"


# ── Core Record ───────────────────────────────────────────────────────

@dataclass(frozen=True)
class EarningRecord:
    """
    A single normalised earning event.

    Amounts are stored in **cents** (integer) to avoid floating-point drift.
    Use `amount_eur` for the human-readable value.
    """
    worker_id:     str
    source:        EarningSourceType
    amount_cents:  int
    currency:      str
    earned_at:     datetime
    platform_name: str
    raw_id:        str
    metadata:      Dict[str, str] = field(default_factory=dict)

    @property
    def amount_eur(self) -> float:
        """Amount in major currency units (e.g. EUR)."""
        return self.amount_cents / 100.0

    def __repr__(self) -> str:
        return (
            f"EarningRecord(worker={self.worker_id[:8]}…, "
            f"{self.currency} {self.amount_eur:,.2f}, "
            f"{self.platform_name}, {self.earned_at:%Y-%m-%d})"
        )


# ── Income Smoothing Result ──────────────────────────────────────────

@dataclass
class IncomeSmoothing:
    """
    Result of the smoothing calculation for one worker / account.

    baseline  = (1/N) × Σ Eₜ   (average earning per period)
    current   = most recent earning amount
    state     = FEAST | NORMAL | FAMINE  (relative to baseline ± δ)
    """
    worker_id:     str
    baseline:      float
    current:       float
    delta:         float
    state:         IncomeState
    records_count: int
    total_earned:  float

    @property
    def avg_wage(self) -> float:
        """Alias for baseline — average wage per period."""
        return self.baseline
