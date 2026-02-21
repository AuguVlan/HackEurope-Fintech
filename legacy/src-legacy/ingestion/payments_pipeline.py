#!/usr/bin/env python3
"""
payments_pipeline.py
====================
Class-based pipeline runner that:
  1. Reads data/payments.json  (Open Banking format)
  2. Converts it to data/payments.csv
  3. Feeds each worker (accountId) through the ingestion pipeline
  4. Computes average wage per person using the income-smoothing model

Usage:
    python3 -m src.ingestion.payments_pipeline
    python3 -m src.ingestion.payments_pipeline --delta 5000
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

from .adapters.open_banking_adapter import FileOpenBankingClient, OpenBankingAdapter
from .income_smoothing import IncomeSmoothingService
from .models import EarningRecord, IncomeSmoothing
from .pipeline import IngestionPipeline

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


# ---------------------------------------------------------------------------
# CSV Converter  (SRP: only knows how to flatten JSON → CSV)
# ---------------------------------------------------------------------------


class OpenBankingCSVConverter:
    """Converts Open Banking payments JSON → flat CSV."""

    CSV_FIELDS = [
        "transaction_id", "account_id", "amount_real", "amount_cents",
        "currency", "description", "booked_date", "provider_txn_id",
        "status", "type",
    ]

    def __init__(self, json_path: Path, csv_path: Path) -> None:
        self._json_path = json_path
        self._csv_path = csv_path

    def convert(self) -> int:
        """Read JSON, write CSV, return row count."""
        with open(self._json_path) as f:
            data = json.load(f)

        rows = [self._flatten(txn) for txn in data["transactions"]]

        with open(self._csv_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=self.CSV_FIELDS)
            writer.writeheader()
            writer.writerows(rows)

        return len(rows)

    @staticmethod
    def _flatten(txn: dict) -> dict:
        uv = int(txn["amount"]["value"]["unscaledValue"])
        scale = int(txn["amount"]["value"]["scale"])
        real_value = uv / (10 ** scale)
        amount_cents = (
            int(uv * (10 ** (2 - scale))) if scale <= 2
            else round(uv / (10 ** (scale - 2)))
        )
        return {
            "transaction_id": txn["id"],
            "account_id": txn["accountId"],
            "amount_real": f"{real_value:.2f}",
            "amount_cents": amount_cents,
            "currency": txn["amount"]["currencyCode"],
            "description": txn["descriptions"]["display"],
            "booked_date": txn["dates"]["booked"],
            "provider_txn_id": txn["identifiers"]["providerTransactionId"],
            "status": txn["status"],
            "type": txn["types"]["type"],
        }


# ---------------------------------------------------------------------------
# Per-account result  (typed dataclass instead of loose dict)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AccountResult:
    """Immutable result for one account processed by the pipeline."""
    account_id: str
    label: str
    earnings: List[EarningRecord]
    smoothing: Optional[IncomeSmoothing]
    total_minor: int
    avg_minor: int
    transaction_count: int


# ---------------------------------------------------------------------------
# Pipeline Runner  (orchestrates CSV + ingestion + smoothing)
# ---------------------------------------------------------------------------


class PaymentsPipelineRunner:
    """
    End-to-end runner: JSON → CSV → IngestionPipeline → results.

    All collaborators injected via constructor.
    """

    def __init__(
        self,
        json_path: Path,
        csv_path: Path,
        *,
        delta_minor: int = 5_000,
    ) -> None:
        self._json_path = json_path
        self._csv_path = csv_path
        self._delta = delta_minor

        # Build collaborators
        self._converter = OpenBankingCSVConverter(json_path, csv_path)
        self._ob_client = FileOpenBankingClient(json_path)
        self._ob_adapter = OpenBankingAdapter(
            client=self._ob_client, platform_name="OpenBanking"
        )
        self._pipeline = IngestionPipeline(
            repositories={"open_banking": self._ob_adapter},
            smoothing_service=IncomeSmoothingService(),
            delta_minor=delta_minor,
        )

    # -- public API ---------------------------------------------------------

    def convert_csv(self) -> int:
        """Step 1: JSON → CSV.  Returns row count."""
        return self._converter.convert()

    def discover_accounts(self) -> List[str]:
        """Return sorted list of distinct account IDs."""
        return sorted(self._ob_client.list_all_account_ids())

    def account_labels(self) -> Dict[str, str]:
        """Map account_id → first transaction description (human label)."""
        with open(self._json_path) as f:
            raw = json.load(f)
        labels: Dict[str, str] = {}
        for txn in raw["transactions"]:
            aid = txn["accountId"]
            if aid not in labels:
                labels[aid] = txn["descriptions"]["display"]
        return labels

    def run_account(self, account_id: str, label: str = "Unknown") -> AccountResult:
        """Run the pipeline for a single account and return a typed result."""
        result = self._pipeline.ingest_worker(account_id)
        earnings = result["earnings"]
        amounts = [e.amount_minor for e in earnings]
        total = sum(amounts) if amounts else 0
        avg = total // len(amounts) if amounts else 0

        return AccountResult(
            account_id=account_id,
            label=label,
            earnings=earnings,
            smoothing=result["smoothing"],
            total_minor=total,
            avg_minor=avg,
            transaction_count=len(earnings),
        )

    def run_all(self) -> List[AccountResult]:
        """Run the pipeline for every account found in the JSON."""
        labels = self.account_labels()
        return [
            self.run_account(aid, labels.get(aid, "Unknown"))
            for aid in self.discover_accounts()
        ]


# ---------------------------------------------------------------------------
# CLI  (thin wrapper — all logic lives in the class above)
# ---------------------------------------------------------------------------


class PaymentsCLI:
    """Command-line interface for the payments pipeline."""

    @staticmethod
    def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
        parser = argparse.ArgumentParser(
            description="Open Banking payments → CSV → Income Smoothing pipeline"
        )
        parser.add_argument(
            "--delta", type=int, default=5_000,
            help="Volatility tolerance δ in cents (default: 5000 = €50)",
        )
        parser.add_argument("-v", "--verbose", action="store_true")
        return parser.parse_args(argv)

    @staticmethod
    def run(argv: list[str] | None = None) -> None:
        args = PaymentsCLI.parse_args(argv)

        logging.basicConfig(
            level=logging.DEBUG if args.verbose else logging.INFO,
            format="%(levelname)-8s %(name)s: %(message)s",
        )

        json_path = DATA_DIR / "payments.json"
        csv_path = DATA_DIR / "payments.csv"

        runner = PaymentsPipelineRunner(
            json_path, csv_path, delta_minor=args.delta
        )

        # Step 1
        print("=" * 72)
        print("  Step 1: Convert payments.json → payments.csv")
        print("=" * 72)
        row_count = runner.convert_csv()
        print(f"  Wrote {row_count} rows to {csv_path.name}\n")

        with open(csv_path) as f:
            for i, line in enumerate(f):
                if i < 6:
                    print(f"  {line.rstrip()}")
                else:
                    print(f"  ... ({row_count - 5} more rows)")
                    break

        # Step 2 + 3
        accounts = runner.discover_accounts()
        print("\n" + "=" * 72)
        print("  Step 2: Run Ingestion Pipeline per account (worker)")
        print("=" * 72)
        print(f"  Found {len(accounts)} distinct accounts\n")

        print("=" * 72)
        print("  Step 3: Income Smoothing Results  (B = 1/N × Σ E_t)")
        print(f"  δ = {args.delta} cents (€{args.delta / 100:.2f})")
        print("=" * 72)

        results = runner.run_all()
        for r in results:
            print(f"\n▸ Account: {r.account_id[:12]}…  ({r.label})")
            print(f"  Transactions : {r.transaction_count}")
            if r.transaction_count:
                print(f"  Total earned : €{r.total_minor / 100:,.2f}")
                print(f"  Average wage : €{r.avg_minor / 100:,.2f}  (per payment)")
            if r.smoothing:
                print(f"  Baseline (B) : €{r.smoothing.baseline_minor / 100:,.2f}")
                print(f"  Latest E_t   : €{r.smoothing.latest_earning_minor / 100:,.2f}")
                print(f"  State        : {r.smoothing.state.value.upper()}")
                print(f"  Window (N)   : {r.smoothing.window_size}")

        print("\n" + "=" * 72)
        print("  Pipeline complete.")
        print(f"  CSV output   : {csv_path}")
        print(f"  JSON source  : {json_path}")
        print("=" * 72)


# Entry point
def main(argv: list[str] | None = None) -> None:
    PaymentsCLI.run(argv)


if __name__ == "__main__":
    main()
