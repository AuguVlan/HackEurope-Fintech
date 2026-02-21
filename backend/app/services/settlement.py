from datetime import datetime, timezone
import sqlite3

from ..config import settings
from ..repository import get_country_code, get_country_id
from .forecast import get_forecast
from .stripe_adapter import create_transfer


def current_period(now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    half = "P1" if now.day <= 15 else "P2"
    return f"{now.year}-{now.month:02d}-{half}"


def _pool_balance(conn: sqlite3.Connection, country_code: str) -> int:
    country_id = get_country_id(conn, country_code)
    row = conn.execute(
        "SELECT balance_minor FROM pools WHERE country_id = ?",
        (country_id,),
    ).fetchone()
    return int(row["balance_minor"]) if row else 0


def run_settlement(conn: sqlite3.Connection, period: str | None = None) -> int:
    period = period or current_period()
    a = "COUNTRY_A"
    b = "COUNTRY_B"
    balance_a = _pool_balance(conn, a)
    balance_b = _pool_balance(conn, b)

    base_transfer = abs(balance_a - balance_b) // 2
    richer, poorer = (a, b) if balance_a >= balance_b else (b, a)
    richer_balance = max(balance_a, balance_b)

    f_richer = get_forecast(conn, richer, period)
    f_poorer = get_forecast(conn, poorer, period)
    forecast_adjustment = int((f_richer["net_minor"] - f_poorer["net_minor"]) * 0.2)

    raw_recommended = max(0, base_transfer + forecast_adjustment)
    cap_minor = int(richer_balance * settings.settlement_cap_percent)
    recommended = min(raw_recommended, cap_minor)

    from_country_id = get_country_id(conn, richer)
    to_country_id = get_country_id(conn, poorer)
    rationale = (
        f"base={base_transfer}, forecast_adj={forecast_adjustment}, "
        f"cap={cap_minor}, richer={richer}, poorer={poorer}"
    )

    cur = conn.execute(
        """
        INSERT INTO settlements(
            period, from_country_id, to_country_id, base_transfer_minor,
            forecast_adjustment_minor, recommended_minor, status, rationale
        )
        VALUES (?, ?, ?, ?, ?, ?, 'proposed', ?)
        """,
        (
            period,
            from_country_id,
            to_country_id,
            base_transfer,
            forecast_adjustment,
            recommended,
            rationale,
        ),
    )
    return int(cur.lastrowid)


def execute_settlement(conn: sqlite3.Connection, settlement_id: int) -> None:
    row = conn.execute(
        """
        SELECT id, from_country_id, to_country_id, recommended_minor, status
        FROM settlements
        WHERE id = ?
        """,
        (settlement_id,),
    ).fetchone()
    if not row:
        raise ValueError("Settlement not found")
    if row["status"] == "executed":
        raise ValueError("Settlement already executed")

    recommended_minor = int(row["recommended_minor"])
    if recommended_minor <= 0:
        raise ValueError("Settlement recommended amount is zero")

    from_country = get_country_code(conn, int(row["from_country_id"]))
    to_country = get_country_code(conn, int(row["to_country_id"]))
    transfer = create_transfer(
        amount_minor=recommended_minor,
        currency=settings.default_currency.lower(),
        metadata={"from_country": from_country, "to_country": to_country},
    )

    conn.execute(
        "UPDATE pools SET balance_minor = balance_minor - ? WHERE country_id = ?",
        (recommended_minor, int(row["from_country_id"])),
    )
    conn.execute(
        "UPDATE pools SET balance_minor = balance_minor + ? WHERE country_id = ?",
        (recommended_minor, int(row["to_country_id"])),
    )
    conn.execute(
        """
        UPDATE settlements
        SET executed_minor = ?, status = 'executed', stripe_transfer_id = ?
        WHERE id = ?
        """,
        (recommended_minor, transfer.id, settlement_id),
    )
