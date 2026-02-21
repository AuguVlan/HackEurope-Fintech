"""
Open Banking Adapter
====================
Concrete ``IAlternativeDataRepository`` for Open Banking transaction data
(Tink / PSD2 format with scaled amounts).

Follows the same Adapter Pattern as StripeIngestionAdapter:
  - Constructor Injection of data source
  - Normalises provider-specific schema → canonical ``EarningRecord``
  - SRP: one class, one job
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Protocol

from ..interfaces import IAlternativeDataRepository
from ..models import EarningRecord, EarningSourceType

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Thin protocol for the data provider (file, API, etc.)
# ---------------------------------------------------------------------------

class IOpenBankingClient(Protocol):
    """
    Structural interface for anything that can supply Open Banking
    transaction lists.
    """

    def list_transactions(
        self,
        account_id: str,
        *,
        since: Optional[str] = None,
        until: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Return raw transaction dicts for *account_id*."""
        ...

    def ping(self) -> bool:
        ...


# ---------------------------------------------------------------------------
# File-based client (reads the JSON you provided)
# ---------------------------------------------------------------------------

class FileOpenBankingClient:
    """
    Reads Open Banking transactions from a local JSON file.
    Implements ``IOpenBankingClient``.
    """

    def __init__(self, json_path: str | Path) -> None:
        self._path = Path(json_path)
        self._data: Optional[Dict] = None

    def _load(self) -> Dict:
        if self._data is None:
            with open(self._path) as f:
                self._data = json.load(f)
        return self._data

    def list_transactions(
        self,
        account_id: str,
        *,
        since: Optional[str] = None,
        until: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        data = self._load()
        txns = [
            t for t in data.get("transactions", [])
            if t["accountId"] == account_id
        ]
        if since:
            txns = [t for t in txns if t["dates"]["booked"] >= since]
        if until:
            txns = [t for t in txns if t["dates"]["booked"] < until]
        return txns

    def list_all_account_ids(self) -> List[str]:
        """Return distinct account IDs found in the file."""
        data = self._load()
        return list({t["accountId"] for t in data.get("transactions", [])})

    def ping(self) -> bool:
        return self._path.exists()


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

class OpenBankingAdapter(IAlternativeDataRepository):
    """
    Normalises Open Banking / Tink-format transactions → ``EarningRecord``.

    Amount conversion: ``real_amount = unscaledValue / 10^scale``
    We store in minor units (cents), so ``amount_minor = unscaledValue / 10^(scale-2)``
    when scale >= 2, or multiply when scale < 2.
    """

    def __init__(
        self,
        client: IOpenBankingClient,
        *,
        platform_name: str = "open_banking",
    ) -> None:
        self._client = client
        self._platform_name = platform_name

    # -- IAlternativeDataRepository -----------------------------------------

    def fetch_earnings(
        self,
        worker_id: str,
        *,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
    ) -> List[EarningRecord]:
        since_str = since.strftime("%Y-%m-%d") if since else None
        until_str = until.strftime("%Y-%m-%d") if until else None

        raw = self._client.list_transactions(
            account_id=worker_id,
            since=since_str,
            until=until_str,
        )

        records: List[EarningRecord] = []
        for txn in raw:
            try:
                records.append(self._normalize(worker_id, txn))
            except Exception:
                logger.warning(
                    "Skipping malformed OB txn %s", txn.get("id", "?"), exc_info=True
                )

        records.sort(key=lambda r: r.earned_at)
        logger.info(
            "Fetched %d earnings from Open Banking for account %s",
            len(records), worker_id,
        )
        return records

    def ping(self) -> bool:
        try:
            return self._client.ping()
        except Exception:
            return False

    # -- internal -----------------------------------------------------------

    @staticmethod
    def _to_minor_units(unscaled: str, scale: str) -> int:
        """
        Convert the Tink scaled-amount representation to cents.

        Examples:
            unscaledValue=797212, scale=2 → 797212 cents (€7972.12)
            unscaledValue=12781,  scale=1 → 127810 cents (€1278.10)
            unscaledValue=80882,  scale=1 → 808820 cents ... wait no.

        Actually: real_value = unscaledValue / 10^scale
        minor_units (cents) = real_value * 100 = unscaledValue * 100 / 10^scale
                            = unscaledValue * 10^(2-scale)
        """
        uv = int(unscaled)
        s = int(scale)
        if s <= 2:
            return uv * (10 ** (2 - s))
        else:
            # scale > 2: divide, rounding to nearest cent
            return round(uv / (10 ** (s - 2)))

    def _normalize(self, worker_id: str, txn: Dict[str, Any]) -> EarningRecord:
        amount_val = txn["amount"]["value"]
        amount_minor = self._to_minor_units(
            amount_val["unscaledValue"], amount_val["scale"]
        )
        booked = txn["dates"]["booked"]  # "2026-02-21"

        return EarningRecord(
            worker_id=worker_id,
            source=EarningSourceType.OPEN_BANKING,
            source_transaction_id=txn["id"],
            amount_minor=amount_minor,
            currency=txn["amount"]["currencyCode"].upper()[:3],
            earned_at=datetime.strptime(booked, "%Y-%m-%d").replace(
                tzinfo=timezone.utc
            ),
            platform_name=txn["descriptions"].get("display", self._platform_name),
            metadata={
                "original_description": txn["descriptions"].get("original"),
                "provider_txn_id": txn["identifiers"].get("providerTransactionId"),
                "status": txn.get("status"),
                "type": txn["types"].get("type"),
            },
        )
