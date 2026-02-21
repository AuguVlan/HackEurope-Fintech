#!/usr/bin/env python3
"""
payments_pipeline.py
====================
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
from pathlib import Path

from .adapters.open_banking_adapter import FileOpenBankingClient, OpenBankingAdapter
from .income_smoothing import IncomeSmoothingService
from .pipeline import IngestionPipeline

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
JSON_PATH = DATA_DIR / "payments.json"
CSV_PATH = DATA_DIR / "payments.csv"


# ── Step 1: JSON → CSV ────────────────────────────────────────────────────

def json_to_csv(json_path: Path, csv_path: Path) -> int:
    """
    Convert Open Banking payments.json → flat CSV.
    Returns number of rows written.
    """
    with open(json_path) as f:
        data = json.load(f)

    rows = []
    for txn in data["transactions"]:
        uv = int(txn["amount"]["value"]["unscaledValue"])
        scale = int(txn["amount"]["value"]["scale"])
        real_value = uv / (10 ** scale)
        amount_cents = int(uv * (10 ** (2 - scale))) if scale <= 2 else round(uv / (10 ** (scale - 2)))

        rows.append({
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
        })

    fieldnames = [
        "transaction_id", "account_id", "amount_real", "amount_cents",
        "currency", "description", "booked_date", "provider_txn_id",
        "status", "type",
    ]
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return len(rows)


# ── Step 2 & 3: Pipeline ─────────────────────────────────────────────────

def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="Open Banking payments → CSV → Income Smoothing pipeline"
    )
    parser.add_argument(
        "--delta", type=int, default=5_000,
        help="Volatility tolerance δ in cents (default: 5000 = €50)",
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)-8s %(name)s: %(message)s",
    )

    # ── 1. Convert JSON → CSV ─────────────────────────────────────────
    print("=" * 72)
    print("  Step 1: Convert payments.json → payments.csv")
    print("=" * 72)
    row_count = json_to_csv(JSON_PATH, CSV_PATH)
    print(f"  Wrote {row_count} rows to {CSV_PATH.name}\n")

    # Show first few lines of CSV
    with open(CSV_PATH) as f:
        for i, line in enumerate(f):
            if i < 6:
                print(f"  {line.rstrip()}")
            else:
                print(f"  ... ({row_count - 5} more rows)")
                break

    # ── 2. Build pipeline with Open Banking adapter ───────────────────
    print("\n" + "=" * 72)
    print("  Step 2: Run Ingestion Pipeline per account (worker)")
    print("=" * 72)

    ob_client = FileOpenBankingClient(JSON_PATH)
    ob_adapter = OpenBankingAdapter(client=ob_client, platform_name="OpenBanking")

    pipeline = IngestionPipeline(
        repositories={"open_banking": ob_adapter},
        smoothing_service=IncomeSmoothingService(),
        delta_minor=args.delta,
    )

    # Discover all unique account IDs
    account_ids = ob_client.list_all_account_ids()

    # Map account → human label from first transaction description
    with open(JSON_PATH) as f:
        raw_data = json.load(f)
    account_labels: dict[str, str] = {}
    for txn in raw_data["transactions"]:
        aid = txn["accountId"]
        if aid not in account_labels:
            account_labels[aid] = txn["descriptions"]["display"]

    print(f"  Found {len(account_ids)} distinct accounts\n")

    # ── 3. Compute per-worker ─────────────────────────────────────────
    print("=" * 72)
    print("  Step 3: Income Smoothing Results  (B = 1/N × Σ E_t)")
    print(f"  δ = {args.delta} cents (€{args.delta / 100:.2f})")
    print("=" * 72)

    for aid in sorted(account_ids):
        result = pipeline.ingest_worker(aid)
        earnings = result["earnings"]
        smoothing = result["smoothing"]
        label = account_labels.get(aid, "Unknown")

        print(f"\n▸ Account: {aid[:12]}…  ({label})")
        print(f"  Transactions : {len(earnings)}")

        if earnings:
            amounts = [e.amount_minor for e in earnings]
            total = sum(amounts)
            avg = total // len(amounts)
            print(f"  Total earned : €{total / 100:,.2f}")
            print(f"  Average wage : €{avg / 100:,.2f}  (per payment)")

        if smoothing:
            print(f"  Baseline (B) : €{smoothing.baseline_minor / 100:,.2f}")
            print(f"  Latest E_t   : €{smoothing.latest_earning_minor / 100:,.2f}")
            print(f"  State        : {smoothing.state.value.upper()}")
            print(f"  Window (N)   : {smoothing.window_size}")

    print("\n" + "=" * 72)
    print("  Pipeline complete.")
    print(f"  CSV output   : {CSV_PATH}")
    print(f"  JSON source  : {JSON_PATH}")
    print("=" * 72)


if __name__ == "__main__":
    main()
