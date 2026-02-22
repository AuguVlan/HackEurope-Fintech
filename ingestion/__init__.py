"""
Component 1 — Data Ingestion & Normalization
=============================================

BaaS Ledger for gig-economy platforms.

Ingests earnings from multiple alternative data sources (Stripe Connect,
Open Banking, Payroll APIs), normalises them into a canonical
`EarningRecord`, and computes income-smoothing baselines to classify
each worker's income state as FEAST / NORMAL / FAMINE.

Quick start:
    python3 -m ingestion            # run the full pipeline on sample data
    python3 -m ingestion --help     # see CLI options

Architecture:
    adapters/       Concrete data-source adapters (Open Banking, Stripe …)
    models.py       Canonical data models (EarningRecord, IncomeSmoothing)
    interfaces.py   Abstract contracts every adapter & service must satisfy
    smoothing.py    Income smoothing  B = (1/N) × Σ Eₜ  with δ tolerance
    pipeline.py     Orchestrator: adapters → merge → smooth → output
    run.py          CLI entry-point with CSV export + per-account report
    data/           Sample transaction files
"""

from .models import EarningRecord, EarningSourceType, IncomeSmoothing, IncomeState
from .interfaces import IDataSourceAdapter, IIncomeSmoothingService, IRecordSink
from .smoothing import IncomeSmoothingService
from .pipeline import IngestionPipeline
from .adapters.open_banking import OpenBankingAdapter
from .adapters.stripe import StripeAdapter

__all__ = [
    # Models
    "EarningRecord",
    "EarningSourceType",
    "IncomeSmoothing",
    "IncomeState",
    # Interfaces
    "IDataSourceAdapter",
    "IIncomeSmoothingService",
    "IRecordSink",
    # Services
    "IncomeSmoothingService",
    "IngestionPipeline",
    # Adapters
    "OpenBankingAdapter",
    "StripeAdapter",
]
