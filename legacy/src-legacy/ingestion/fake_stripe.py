"""
Fake Stripe Client
==================
Generates *realistic-looking* synthetic Stripe Connect payout data
so the pipeline can run end-to-end without a live Stripe account.

Implements the ``IStripeClient`` protocol expected by
``StripeIngestionAdapter``.
"""

from __future__ import annotations

import random
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional


class FakeStripeClient:
    """
    Deterministic-ish fake that returns payout-shaped dicts.

    Parameters
    ----------
    seed : int | None
        For reproducibility.
    mean_amount : int
        Average payout in minor units (default 8 000 = $80.00).
    std_amount : int
        Standard deviation around the mean.
    """

    def __init__(
        self,
        *,
        seed: Optional[int] = 42,
        mean_amount: int = 8_000,
        std_amount: int = 3_500,
    ) -> None:
        self._rng = random.Random(seed)
        self._mean = mean_amount
        self._std = std_amount

    # -- IStripeClient protocol ------------------------------------------

    def list_payouts(
        self,
        account_id: str,
        *,
        created_gte: Optional[int] = None,
        created_lt: Optional[int] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Return a list of synthetic Stripe payout dicts.

        The generator produces ~30 payouts spread over the last 90 days
        for the given *account_id*, then filters by the requested window.
        """
        payouts = self._generate_payouts(account_id, count=30, days_back=90)

        # Apply time-window filter
        if created_gte is not None:
            payouts = [p for p in payouts if p["created"] >= created_gte]
        if created_lt is not None:
            payouts = [p for p in payouts if p["created"] < created_lt]

        return payouts[:limit]

    def ping(self) -> bool:
        return True

    # -- internals -------------------------------------------------------

    def _generate_payouts(
        self, account_id: str, count: int, days_back: int
    ) -> List[Dict[str, Any]]:
        now = datetime.now(tz=timezone.utc)
        payouts: List[Dict[str, Any]] = []

        for i in range(count):
            days_offset = self._rng.uniform(0, days_back)
            ts = now - timedelta(days=days_offset)

            amount = max(100, int(self._rng.gauss(self._mean, self._std)))

            # Simulate occasional "feast" spikes (tips, bonuses)
            if self._rng.random() < 0.12:
                amount = int(amount * self._rng.uniform(2.0, 3.5))

            payouts.append(
                {
                    "id": f"po_fake_{uuid.UUID(int=self._rng.getrandbits(128)).hex[:16]}",
                    "object": "payout",
                    "amount": amount,
                    "currency": "usd",
                    "created": int(ts.timestamp()),
                    "arrival_date": int((ts + timedelta(days=2)).timestamp()),
                    "status": "paid",
                    "method": "standard",
                    "type": "bank_account",
                    "description": f"]]Earnings for {account_id}",
                    "metadata": {
                        "platform": "gig_app",
                        "worker_id": account_id,
                        "batch": i,
                    },
                }
            )

        # Sort chronologically
        payouts.sort(key=lambda p: p["created"])
        return payouts
