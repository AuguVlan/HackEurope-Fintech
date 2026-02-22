"""
Stripe Connect Adapter
======================

Converts Stripe Connect payout/transfer events into canonical
`EarningRecord` objects.

This is a **stub** — in production, it would call the Stripe API
(or receive webhooks) to fetch payouts for connected accounts.
For now it accepts a list of payout dicts with the same shape as
Stripe's API response.

Expected payout dict shape:
    {
        "id": "po_xxx",
        "amount": 150000,          # cents
        "currency": "eur",
        "arrival_date": 1708560000, # unix timestamp
        "description": "STRIPE PAYOUT",
        "destination": "ba_xxx",
        "metadata": {}
    }
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from ..interfaces import IDataSourceAdapter
from ..models import EarningRecord, EarningSourceType


class StripeAdapter(IDataSourceAdapter):
    """
    Ingests Stripe Connect payout objects.

    In production → call `stripe.Account.list_external_accounts()`
    or listen to `payout.paid` webhooks.
    For the hackathon → accepts a list of payout dicts.
    """

    def __init__(self, payouts: List[Dict[str, Any]]) -> None:
        self._payouts = payouts

    def source_name(self) -> str:
        return "stripe_connect"

    def fetch_earnings(self, worker_id: str) -> List[EarningRecord]:
        records: List[EarningRecord] = []

        for po in self._payouts:
            amount_cents = po.get("amount", 0)
            if amount_cents <= 0:
                continue

            currency = po.get("currency", "eur").upper()

            # Stripe uses unix timestamps
            ts = po.get("arrival_date", 0)
            earned_at = datetime.fromtimestamp(ts, tz=timezone.utc) if ts else datetime.now(timezone.utc)

            records.append(
                EarningRecord(
                    worker_id=worker_id,
                    source=EarningSourceType.STRIPE_CONNECT,
                    amount_cents=amount_cents,
                    currency=currency,
                    earned_at=earned_at,
                    platform_name=po.get("description", "Stripe Payout"),
                    raw_id=po.get("id", ""),
                    metadata=po.get("metadata", {}),
                )
            )

        return records
