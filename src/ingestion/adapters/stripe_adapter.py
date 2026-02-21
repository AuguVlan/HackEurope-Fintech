"""
StripeIngestionAdapter
======================
Concrete implementation of ``IAlternativeDataRepository`` that pulls
payout / transfer data from the **Stripe Connect** API and normalizes
it into ``EarningRecord`` objects.

Design notes
────────────
• Constructor Injection: the Stripe HTTP client is injected so tests can
  supply a mock without touching the network.
• SRP: this class does *one* thing — fetch + normalize Stripe data.
• Adapter Pattern: translates the Stripe-specific schema into our
  canonical ``EarningRecord``.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Protocol

from ..interfaces import IAlternativeDataRepository
from ..models import EarningRecord, EarningSourceType

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Thin protocol describing what we need from a Stripe-like client
# ---------------------------------------------------------------------------

class IStripeClient(Protocol):
    """
    Structural interface for the subset of the Stripe SDK we consume.

    Any object that exposes these two methods can be injected — the real
    ``stripe`` module, a test double, or our ``FakeStripeClient``.
    """

    def list_payouts(
        self,
        account_id: str,
        *,
        created_gte: Optional[int] = None,
        created_lt: Optional[int] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Return a list of Stripe payout dicts for *account_id*."""
        ...

    def ping(self) -> bool:
        """Return True if the Stripe API is reachable."""
        ...


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

class StripeIngestionAdapter(IAlternativeDataRepository):
    """
    Fetches Stripe Connect payouts and maps them to ``EarningRecord``.

    Parameters
    ----------
    client : IStripeClient
        Injected Stripe client (real SDK wrapper **or** fake/mock).
    platform_name : str
        Human-readable label attached to every record (e.g. ``"Uber"``).
    default_currency : str
        Fallback ISO 4217 code when the payout object omits currency.
    """

    def __init__(
        self,
        client: IStripeClient,
        *,
        platform_name: str = "stripe",
        default_currency: str = "USD",
    ) -> None:
        self._client = client
        self._platform_name = platform_name
        self._default_currency = default_currency.upper()

    # -- IAlternativeDataRepository -----------------------------------------

    def fetch_earnings(
        self,
        worker_id: str,
        *,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
    ) -> List[EarningRecord]:
        """Fetch payouts for *worker_id* and normalise into EarningRecords."""

        created_gte: Optional[int] = (
            int(since.timestamp()) if since else None
        )
        created_lt: Optional[int] = (
            int(until.timestamp()) if until else None
        )

        raw_payouts = self._client.list_payouts(
            account_id=worker_id,
            created_gte=created_gte,
            created_lt=created_lt,
        )

        records: List[EarningRecord] = []
        for payout in raw_payouts:
            try:
                record = self._normalize(worker_id, payout)
                records.append(record)
            except Exception:
                logger.warning(
                    "Skipping malformed Stripe payout %s for worker %s",
                    payout.get("id", "?"),
                    worker_id,
                    exc_info=True,
                )

        # Chronological sort
        records.sort(key=lambda r: r.earned_at)
        logger.info(
            "Fetched %d earnings from Stripe for worker %s",
            len(records),
            worker_id,
        )
        return records

    def ping(self) -> bool:
        """Delegate health-check to injected client."""
        try:
            return self._client.ping()
        except Exception:
            return False

    # -- internal -----------------------------------------------------------

    def _normalize(
        self, worker_id: str, payout: Dict[str, Any]
    ) -> EarningRecord:
        """
        Map a single Stripe payout dict → ``EarningRecord``.

        Expected Stripe payout shape (subset we use)::

            {
                "id": "po_xxx",
                "amount": 12500,          # in smallest currency unit
                "currency": "usd",
                "created": 1700000000,    # unix epoch
                "metadata": { ... }
            }
        """
        currency_raw: str = payout.get("currency", self._default_currency)

        return EarningRecord(
            worker_id=worker_id,
            source=EarningSourceType.STRIPE_CONNECT,
            source_transaction_id=payout["id"],
            amount_minor=int(payout["amount"]),
            currency=currency_raw.upper()[:3],
            earned_at=datetime.fromtimestamp(
                payout["created"], tz=timezone.utc
            ),
            platform_name=self._platform_name,
            metadata={
                k: v
                for k, v in payout.items()
                if k not in ("id", "amount", "currency", "created")
            },
        )
