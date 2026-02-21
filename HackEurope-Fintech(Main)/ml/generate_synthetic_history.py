from __future__ import annotations

import argparse
from datetime import datetime, timedelta
from pathlib import Path
import random
import sqlite3


def _connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _country_id(conn: sqlite3.Connection, code: str) -> int:
    row = conn.execute("SELECT id FROM countries WHERE code = ?", (code,)).fetchone()
    if not row:
        raise ValueError(f"Country {code} not found. Run backend/scripts/reset_demo.py first.")
    return int(row["id"])


def _seed_platform_earnings(
    conn: sqlite3.Connection,
    *,
    platform_id: str,
    country_code: str,
    records_count: int,
    start_at: datetime,
    amount_base: int,
    amount_step: int,
    noise: int,
    seed_prefix: str,
) -> None:
    rng = random.Random(sum(ord(ch) for ch in platform_id))
    country_id = _country_id(conn, country_code)
    for i in range(records_count):
        ts = (start_at + timedelta(hours=6 * i)).strftime("%Y-%m-%d %H:%M:%S")
        amount = max(1000, amount_base + amount_step * i + rng.randint(-noise, noise) + (i % 3) * 60)
        conn.execute(
            """
            INSERT INTO payments(
                company_id, country_id, amount_minor, currency, service_type,
                idempotency_key, stripe_payment_intent_id, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'succeeded', ?)
            """,
            (
                platform_id,
                country_id,
                amount,
                "EUR",
                "gig-payout",
                f"{seed_prefix}-idem-{platform_id}-{i}",
                f"{seed_prefix}-pi-{platform_id}-{i}",
                ts,
            ),
        )
        conn.execute(
            "UPDATE pools SET balance_minor = balance_minor + ? WHERE country_id = ?",
            (amount, country_id),
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed synthetic platform earnings history for income smoothing and underwriting."
    )
    parser.add_argument(
        "--db-path",
        default=str(Path(__file__).resolve().parents[1] / "backend" / "baas_demo.db"),
        help="Path to backend SQLite DB (default: backend/baas_demo.db)",
    )
    parser.add_argument(
        "--platform-count",
        type=int,
        default=3,
        help="Number of synthetic gig platforms (company_id) to seed.",
    )
    parser.add_argument(
        "--records-per-platform",
        type=int,
        default=14,
        help="Succeeded earnings records seeded per platform.",
    )
    parser.add_argument(
        "--country-code",
        default="COUNTRY_A",
        help="Storage partition country in current schema (default: COUNTRY_A).",
    )
    parser.add_argument("--seed-prefix", default="synthetic", help="Prefix for synthetic external IDs.")
    args = parser.parse_args()

    db_path = Path(args.db_path)
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")

    with _connect(db_path) as conn:
        base = datetime(2026, 2, 1, 9, 0, 0)
        for idx in range(args.platform_count):
            platform_id = f"platform_{idx + 1}"
            _seed_platform_earnings(
                conn,
                platform_id=platform_id,
                country_code=args.country_code,
                records_count=args.records_per_platform,
                start_at=base + timedelta(hours=idx * 2),
                amount_base=8200 + idx * 1200,
                amount_step=170 + idx * 30,
                noise=260,
                seed_prefix=args.seed_prefix,
            )
        conn.commit()

    print(f"Synthetic history seeded in {db_path}")
    print(f"Inserted {args.platform_count * args.records_per_platform} succeeded earnings records.")
    print("Use GET /income-signal?company_id=platform_1 to inspect the underwriting signal.")


if __name__ == "__main__":
    main()
