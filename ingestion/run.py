"""
CLI Runner — Full Ingestion Pipeline
=====================================

Loads payments.json → exports CSV → prints per-account income report.

Usage:
    python3 -m ingestion                    # from project root
    python3 ingestion/run.py                # direct
    python3 ingestion/run.py --json PATH    # custom input file
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from collections import defaultdict
from typing import Any, Dict, List

from .adapters.open_banking import OpenBankingAdapter
from .smoothing import IncomeSmoothingService
from .pipeline import IngestionPipeline


# ── Paths ─────────────────────────────────────────────────────────────

HERE     = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "data")
DEFAULT_JSON = os.path.join(DATA_DIR, "payments.json")
DEFAULT_CSV  = os.path.join(DATA_DIR, "payments.csv")


# ── CSV Export ────────────────────────────────────────────────────────

CSV_FIELDS = [
    "transactionId",
    "bookingDate",
    "creditorName",
    "debtorAccount_iban",
    "remittanceInformationUnstructured",
    "amount",
    "currency",
    "amount_cents",
]


def export_csv(transactions: List[Dict[str, Any]], path: str) -> str:
    """Write transactions to a flat CSV file."""
    os.makedirs(os.path.dirname(path), exist_ok=True)

    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for tx in transactions:
            raw_amt = tx.get("transactionAmount", {}).get("amount", "0")
            try:
                amount = float(raw_amt)
            except (ValueError, TypeError):
                amount = 0.0

            writer.writerow({
                "transactionId":                    tx.get("transactionId", ""),
                "bookingDate":                      tx.get("bookingDate", ""),
                "creditorName":                     tx.get("creditorName", ""),
                "debtorAccount_iban":               tx.get("debtorAccount", {}).get("iban", ""),
                "remittanceInformationUnstructured": tx.get("remittanceInformationUnstructured", ""),
                "amount":                           raw_amt,
                "currency":                         tx.get("transactionAmount", {}).get("currency", ""),
                "amount_cents":                     int(round(amount * 100)),
            })

    return path


# ── Main ──────────────────────────────────────────────────────────────

def run(json_path: str = DEFAULT_JSON, csv_path: str = DEFAULT_CSV) -> None:
    """Execute the full Component 1 pipeline."""

    print("=" * 64)
    print("  Component 1 — Data Ingestion & Normalization Pipeline")
    print("=" * 64)

    # 1. Load JSON ─────────────────────────────────────────────────────
    with open(json_path, "r") as f:
        data = json.load(f)
    transactions = data.get("transactions", [])
    print(f"\n  ✅  Loaded {len(transactions)} transactions from {json_path}")

    # 2. Export CSV ────────────────────────────────────────────────────
    out = export_csv(transactions, csv_path)
    print(f"  ✅  CSV exported to {out}")

    # 3. Group by debtor account ───────────────────────────────────────
    grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for tx in transactions:
        amt = float(tx.get("transactionAmount", {}).get("amount", "0"))
        if amt <= 0:
            continue
        acct = tx.get("debtorAccount", {}).get("iban", "unknown")
        grouped[acct].append(tx)

    # 4. Per-account income smoothing ──────────────────────────────────
    smoother = IncomeSmoothingService()

    header = f"  {'Account':<14} {'Label':<14} {'Txns':>5} {'Total (€)':>12} {'Avg Wage (€)':>14} {'State':<8}"
    print(f"\n{header}")
    print("  " + "─" * 70)

    for acct, txs in grouped.items():
        adapter  = OpenBankingAdapter(txs)
        pipeline = IngestionPipeline(adapters=[adapter], smoothing=smoother)
        result   = pipeline.ingest_worker(worker_id=acct)

        label = txs[0].get("remittanceInformationUnstructured", "?")[:12]

        print(
            f"  {acct[:12]:<14} {label:<14} {result.records_count:>5}"
            f" {result.total_earned:>12,.2f}"
            f" {result.avg_wage:>14,.2f}"
            f"  {result.state.value:<8}"
        )

    print(f"\n  ✅  Pipeline complete — {len(grouped)} accounts processed.\n")


# ── CLI ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Component 1 — Ingestion Pipeline")
    parser.add_argument("--json", default=DEFAULT_JSON, help="Input JSON file path")
    parser.add_argument("--csv",  default=DEFAULT_CSV,  help="Output CSV file path")
    args = parser.parse_args()
    run(json_path=args.json, csv_path=args.csv)


if __name__ == "__main__":
    main()
