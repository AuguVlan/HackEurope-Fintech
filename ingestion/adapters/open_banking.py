"""
Open Banking Adapter
====================

Converts PSD2/Open Banking transaction JSON (Berlin Group format)
into canonical `EarningRecord` objects.

Supports fields:
    transactionId, bookingDate, bookingDateTime, transactionAmount,
    creditorName, debtorAccount.iban, remittanceInformationUnstructured
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from ..interfaces import IDataSourceAdapter
from ..models import EarningRecord, EarningSourceType


class OpenBankingAdapter(IDataSourceAdapter):
    """
    Ingests a list of Open Banking transaction dicts.

    Only **positive** amounts are kept (credits = income).
    Negative amounts (debits) are ignored.
    """

    def __init__(self, transactions: List[Dict[str, Any]]) -> None:
        self._transactions = transactions

    def source_name(self) -> str:
        return "open_banking"

    def fetch_earnings(self, worker_id: str) -> List[EarningRecord]:
        records: List[EarningRecord] = []

        for tx in self._transactions:
            # ── Amount (skip debits) ──────────────────────────────────
            raw_amount = tx.get("transactionAmount", {}).get("amount", "0")
            amount = float(raw_amount)
            if amount <= 0:
                continue

            # ── Currency ──────────────────────────────────────────────
            currency = tx.get("transactionAmount", {}).get("currency", "EUR")

            # ── Date parsing (bookingDateTime > bookingDate) ──────────
            date_str = tx.get("bookingDateTime") or tx.get("bookingDate", "")
            earned_at = self._parse_date(date_str)

            # ── Labels ────────────────────────────────────────────────
            label   = tx.get("remittanceInformationUnstructured", "unknown")
            account = tx.get("debtorAccount", {}).get("iban", worker_id)

            records.append(
                EarningRecord(
                    worker_id=account,
                    source=EarningSourceType.OPEN_BANKING,
                    amount_cents=int(round(amount * 100)),
                    currency=currency,
                    earned_at=earned_at,
                    platform_name=label,
                    raw_id=tx.get("transactionId", ""),
                    metadata={"creditor": tx.get("creditorName", "")},
                )
            )

        return records

    # ── Helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _parse_date(date_str: str) -> datetime:
        """Parse ISO date or datetime, fall back to now()."""
        try:
            if "T" in date_str:
                return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return datetime.strptime(date_str, "%Y-%m-%d")
        except (ValueError, TypeError):
            return datetime.now()
