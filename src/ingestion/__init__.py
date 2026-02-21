"""
Component 1 – Data Ingestion & Normalization
=============================================
Provides adapter-based ingestion from alternative data sources
(Stripe Connect, Open Banking, Payroll APIs) and normalizes them
into a canonical EarningRecord format.

Public API
----------
Models:     EarningRecord, IncomeSmoothing, IncomeState, EarningSourceType
Interfaces: IAlternativeDataRepository, IIncomeSmoothingService, IEarningRecordSink
Services:   IncomeSmoothingService, IngestionPipeline
Adapters:   StripeIngestionAdapter, OpenBankingAdapter
Fakes:      FakeStripeClient, FileOpenBankingClient
Router:     IngestionRouterFactory, DefaultPipelineFactory, router
Runner:     PaymentsPipelineRunner, OpenBankingCSVConverter, AccountResult

All classes are importable from ``src.ingestion`` directly::

    from src.ingestion import EarningRecord, IngestionPipeline
"""

# Core models  (no side-effects, safe to import eagerly)
from .models import EarningRecord, EarningSourceType, IncomeSmoothing, IncomeState
from .interfaces import IAlternativeDataRepository, IIncomeSmoothingService, IEarningRecordSink
from .income_smoothing import IncomeSmoothingService
from .pipeline import IngestionPipeline

# Adapters
from .adapters.stripe_adapter import StripeIngestionAdapter
from .adapters.open_banking_adapter import OpenBankingAdapter, FileOpenBankingClient
from .fake_stripe import FakeStripeClient

# Router factory
from .router import IngestionRouterFactory, DefaultPipelineFactory

# Runner classes  (lazy-safe: imported by name, not executed)
from .payments_pipeline import PaymentsPipelineRunner, OpenBankingCSVConverter, AccountResult

__all__ = [
    # Models
    "EarningRecord",
    "EarningSourceType",
    "IncomeSmoothing",
    "IncomeState",
    # Interfaces
    "IAlternativeDataRepository",
    "IIncomeSmoothingService",
    "IEarningRecordSink",
    # Services
    "IncomeSmoothingService",
    "IngestionPipeline",
    # Adapters
    "StripeIngestionAdapter",
    "OpenBankingAdapter",
    "FileOpenBankingClient",
    "FakeStripeClient",
    # Router
    "IngestionRouterFactory",
    "DefaultPipelineFactory",
    # Runner
    "PaymentsPipelineRunner",
    "OpenBankingCSVConverter",
    "AccountResult",
]
