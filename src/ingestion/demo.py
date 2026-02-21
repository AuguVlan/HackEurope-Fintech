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
import logging
from typing import List, Optional

from .adapters.stripe_adapter import StripeIngestionAdapter
from .fake_stripe import FakeStripeClient
from .income_smoothing import IncomeSmoothingService
from .pipeline import IngestionPipeline


class DemoRunner:
    """
    Demonstrates the Stripe → EarningRecord → Income Smoothing pipeline.

    All collaborators are injected via the pipeline — this class only
    handles CLI parsing and formatted output (SRP).
    """

    def __init__(self, pipeline: IngestionPipeline) -> None:
        self._pipeline = pipeline

    def run(self, worker_ids: List[str], delta: int) -> None:
        """Execute the pipeline for each worker and print results."""
        print("=" * 72)
        print("  Component 1 – Data Ingestion & Normalization  (demo)")
        print("=" * 72)
        print(f"  Sources : {list(self._pipeline.health_check().keys())}")
        print(f"  Health  : {self._pipeline.health_check()}")
        print(f"  δ       : {delta} minor units")
        print("=" * 72)

        for wid in worker_ids:
            result = self._pipeline.ingest_worker(wid, delta_override=delta)
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


class DemoPipelineFactory:
    """Builds a demo pipeline backed by FakeStripeClient."""

    @staticmethod
    def create(*, seed: int = 42, delta_minor: int = 2_000) -> IngestionPipeline:
        fake_client = FakeStripeClient(seed=seed)
        stripe_adapter = StripeIngestionAdapter(
            client=fake_client, platform_name="FakeGigApp"
        )
        return IngestionPipeline(
            repositories={"stripe": stripe_adapter},
            smoothing_service=IncomeSmoothingService(),
            delta_minor=delta_minor,
        )


class DemoCLI:
    """Thin CLI wrapper — all logic lives in DemoRunner."""

    @staticmethod
    def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
        parser = argparse.ArgumentParser(
            description="Demo: Stripe → EarningRecord → Income Smoothing pipeline"
        )
        parser.add_argument(
            "--workers", nargs="+",
            default=["worker_alice", "worker_bob", "worker_charlie"],
            help="Worker IDs to ingest",
        )
        parser.add_argument(
            "--delta", type=int, default=2_000,
            help="Volatility tolerance δ in minor units (default: 2000 = $20)",
        )
        parser.add_argument(
            "--seed", type=int, default=42,
            help="RNG seed for the fake Stripe client",
        )
        parser.add_argument("-v", "--verbose", action="store_true")
        return parser.parse_args(argv)

    @staticmethod
    def run(argv: list[str] | None = None) -> None:
        args = DemoCLI.parse_args(argv)
        logging.basicConfig(
            level=logging.DEBUG if args.verbose else logging.INFO,
            format="%(levelname)-8s %(name)s: %(message)s",
        )
        pipeline = DemoPipelineFactory.create(seed=args.seed, delta_minor=args.delta)
        runner = DemoRunner(pipeline)
        runner.run(args.workers, args.delta)


def main(argv: list[str] | None = None) -> None:
    DemoCLI.run(argv)


if __name__ == "__main__":
    main()
