#!/usr/bin/env python3
"""
CLI demo – run the ingestion pipeline against fake Stripe data.

Usage:
    python -m src.ingestion.demo                       # default 3 workers
    python -m src.ingestion.demo --workers w1 w2 w3    # specific IDs
    python -m src.ingestion.demo --delta 3000           # custom δ
"""

from __future__ import annotations

import argparse
import json
import logging
import sys

from .adapters.stripe_adapter import StripeIngestionAdapter
from .fake_stripe import FakeStripeClient
from .income_smoothing import IncomeSmoothingService
from .pipeline import IngestionPipeline


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="Demo: Stripe → EarningRecord → Income Smoothing pipeline"
    )
    parser.add_argument(
        "--workers",
        nargs="+",
        default=["worker_alice", "worker_bob", "worker_charlie"],
        help="Worker IDs to ingest",
    )
    parser.add_argument(
        "--delta",
        type=int,
        default=2_000,
        help="Volatility tolerance δ in minor units (default: 2000 = $20)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="RNG seed for the fake Stripe client",
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)-8s %(name)s: %(message)s",
    )

    # --- Build pipeline (all deps injected) ---
    fake_client = FakeStripeClient(seed=args.seed)
    stripe_adapter = StripeIngestionAdapter(
        client=fake_client, platform_name="FakeGigApp"
    )
    pipeline = IngestionPipeline(
        repositories={"stripe": stripe_adapter},
        smoothing_service=IncomeSmoothingService(),
        delta_minor=args.delta,
    )

    print("=" * 72)
    print("  Component 1 – Data Ingestion & Normalization  (demo)")
    print("=" * 72)
    print(f"  Sources : {list(pipeline.health_check().keys())}")
    print(f"  Health  : {pipeline.health_check()}")
    print(f"  δ       : {args.delta} minor units")
    print("=" * 72)

    for wid in args.workers:
        result = pipeline.ingest_worker(wid)
        earnings = result["earnings"]
        smoothing = result["smoothing"]

        print(f"\n▸ Worker: {wid}")
        print(f"  Earnings fetched : {len(earnings)}")
        if earnings:
            amounts = [e.amount_minor for e in earnings]
            print(f"  Amount range     : {min(amounts)} – {max(amounts)} minor")
            print(f"  Total            : {sum(amounts)} minor")
        if smoothing:
            print(f"  Baseline (B)     : {smoothing.baseline_minor} minor")
            print(f"  Latest E_t       : {smoothing.latest_earning_minor} minor")
            print(f"  State            : {smoothing.state.value.upper()}")
            print(f"  Window (N)       : {smoothing.window_size}")
        print()

    print("=" * 72)
    print("  Pipeline complete. Swap FakeStripeClient → real Stripe SDK")
    print("  via constructor injection to go live.")
    print("=" * 72)


if __name__ == "__main__":
    main()
