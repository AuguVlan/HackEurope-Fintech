from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path
import sqlite3

from fastapi import APIRouter, Query

from ..config import ROOT_DIR
from ..database import get_db
from ..services.forecast import MIN_PD_POINTS

router = APIRouter(tags=["ingestion"])
REPAYMENTS_CSV_PATH = Path(ROOT_DIR) / "ingestion" / "data" / "repayments_detail.csv"
PAYMENTS_CSV_PATH = Path(ROOT_DIR) / "ingestion" / "data" / "payments.csv"
WORKERS_CSV_PATH = Path(ROOT_DIR) / "ingestion" / "data" / "workers_500.csv"
REMITTANCES_CSV_PATH = Path(ROOT_DIR) / "ingestion" / "data" / "remittances_detail.csv"
FX_TRANSACTIONS_CSV_PATH = Path(ROOT_DIR) / "ingestion" / "data" / "fx_transactions.csv"


def _parse_timestamp(value: str | None) -> int:
    if not value:
        return int(datetime.now(timezone.utc).timestamp())
    raw = str(value)
    try:
        if "T" in raw:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        else:
            dt = datetime.strptime(raw, "%Y-%m-%d %H:%M:%S")
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp())
    except ValueError:
        return int(datetime.now(timezone.utc).timestamp())


def _safe_int(value: object, default: int = 0) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except Exception:
        return default


def _safe_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except Exception:
        return default


def _csv_pd(status: str, days_late: int) -> float:
    normalized = status.lower().strip()
    if normalized in {"defaulted", "charged_off", "unpaid"}:
        return 0.95
    if normalized.startswith("repaid"):
        if days_late <= 0:
            return 0.06
        if days_late <= 7:
            return 0.25
        if days_late <= 30:
            return 0.55
        return 0.8
    if days_late <= 0:
        return 0.3
    return min(0.9, 0.4 + (days_late * 0.01))


def _csv_risk_band(p_default: float) -> str:
    if p_default >= 0.6:
        return "high"
    if p_default >= 0.35:
        return "medium"
    return "low"


def _csv_confidence(status: str, days_late: int) -> float:
    normalized = status.lower().strip()
    if normalized in {"defaulted", "charged_off", "unpaid"}:
        return 0.92
    if normalized.startswith("repaid") and days_late <= 0:
        return 0.88
    if days_late > 0:
        return 0.82
    return 0.75


def _credit_log_from_csv(limit: int) -> list[dict]:
    if not REPAYMENTS_CSV_PATH.exists():
        return []

    rows: list[dict] = []
    with REPAYMENTS_CSV_PATH.open("r", encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        for row in reader:
            amount = _safe_float(row.get("amount"), 0.0)
            amount_minor = max(0, int(round(amount * 100)))
            days_late = _safe_int(row.get("days_late"), 0)
            status = str(row.get("status") or "unknown")
            p_default = round(_csv_pd(status, days_late), 4)
            risk_band = _csv_risk_band(p_default)
            captured_at = str(row.get("date_issued") or row.get("date_repaid") or row.get("date_due") or "")
            auto_repayment_minor = amount_minor if status.lower().startswith("repaid") else 0
            if days_late > 0:
                trigger_state = "repayment_late"
            elif status.lower().startswith("repaid"):
                trigger_state = "repaid_on_time"
            else:
                trigger_state = "pending"
            rows.append(
                {
                    "advance_id": str(row.get("advance_id") or ""),
                    "worker_id": str(row.get("worker_id") or ""),
                    "captured_at": captured_at,
                    "method": "csv-credit-log-v1",
                    "p_default": p_default,
                    "risk_band": risk_band,
                    "trigger_state": trigger_state,
                    "advance_minor": amount_minor,
                    "auto_repayment_minor": auto_repayment_minor,
                    "confidence": round(_csv_confidence(status, days_late), 3),
                    "status": status,
                    "days_late": days_late,
                    "source": "csv",
                }
            )

    rows.sort(key=lambda item: str(item["captured_at"]), reverse=True)
    return rows[:limit]


def _recent_payments_from_csv(limit: int) -> list[dict]:
    if not PAYMENTS_CSV_PATH.exists():
        return []

    rows: list[dict] = []
    with PAYMENTS_CSV_PATH.open("r", encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        for idx, row in enumerate(reader, start=1):
            booking_date = str(row.get("bookingDate") or "")
            created_at = f"{booking_date} 12:00:00" if booking_date else ""
            amount_minor = _safe_int(row.get("amount_cents"), 0)
            currency = str(row.get("currency") or "EUR")
            country = "COUNTRY_A" if currency == "EUR" else "COUNTRY_B"
            rows.append(
                {
                    "id": idx,
                    "company_id": str(row.get("creditorName") or "csv_company"),
                    "worker_id": str(row.get("debtorAccount_iban") or f"csv_worker_{idx}"),
                    "country": country,
                    "amount_minor": amount_minor,
                    "currency": currency,
                    "service_type": str(row.get("remittanceInformationUnstructured") or "routing"),
                    "idempotency_key": str(row.get("transactionId") or f"csv_tx_{idx}"),
                    "status": "succeeded",
                    "created_at": created_at,
                    "timestamp": _parse_timestamp(created_at or booking_date),
                    "source": "csv",
                }
            )

    rows.sort(key=lambda item: int(item["timestamp"]), reverse=True)
    return rows[:limit]


def _recent_repayments_from_csv(limit: int) -> list[dict]:
    if not REPAYMENTS_CSV_PATH.exists():
        return []

    rows: list[dict] = []
    with REPAYMENTS_CSV_PATH.open("r", encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        for idx, row in enumerate(reader, start=1):
            amount_minor = max(0, int(round(_safe_float(row.get("amount"), 0.0) * 100)))
            issued = str(row.get("date_issued") or "")
            repaid = str(row.get("date_repaid") or "")
            status = str(row.get("status") or "unknown")
            paid_amount_minor = amount_minor if status.lower().startswith("repaid") else None
            rows.append(
                {
                    "id": idx,
                    "company_id": str(row.get("advance_id") or f"adv-{idx}"),
                    "worker_id": str(row.get("worker_id") or f"worker-{idx}"),
                    "due_date": str(row.get("date_due") or ""),
                    "due_amount_minor": amount_minor,
                    "paid_at": repaid if repaid else None,
                    "paid_amount_minor": paid_amount_minor,
                    "status": status,
                    "created_at": issued,
                    "source": "csv",
                }
            )

    rows.sort(key=lambda item: str(item["created_at"]), reverse=True)
    return rows[:limit]


def _workers_from_csv(limit: int) -> list[dict]:
    if not WORKERS_CSV_PATH.exists():
        return []

    rows: list[dict] = []
    with WORKERS_CSV_PATH.open("r", encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        for row in reader:
            worker_id = str(row.get("worker_id") or "")
            platform = str(row.get("platform") or "csv_platform")
            country_code = str(row.get("country") or "")
            repayment_count = _safe_int(row.get("repayment_count"), 0)
            latest_anchor = str(row.get("months_active") or "0")
            rows.append(
                {
                    "worker_id": worker_id,
                    "company_id": platform,
                    "country": country_code,
                    "succeeded_payments": repayment_count,
                    "catboost_ready": repayment_count >= MIN_PD_POINTS,
                    "latest_payment_at": latest_anchor,
                    "name": str(row.get("name") or ""),
                    "platform": platform,
                    "currency": str(row.get("currency") or ""),
                    "months_active": _safe_int(row.get("months_active"), 0),
                    "avg_wage_minor": int(round(_safe_float(row.get("avg_wage"), 0.0) * 100)),
                    "income_state": str(row.get("income_state") or ""),
                    "repayment_count": repayment_count,
                    "on_time_rate": _safe_float(row.get("on_time_rate"), 0.0),
                    "avg_days_late": _safe_float(row.get("avg_days_late"), 0.0),
                    "default_count": _safe_int(row.get("default_count"), 0),
                    "disposable_income_minor": int(round(_safe_float(row.get("disposable_income"), 0.0) * 100)),
                    "source": "csv",
                }
            )

    rows.sort(key=lambda item: int(item["repayment_count"]), reverse=True)
    return rows[:limit]


def _repositories_health(conn: sqlite3.Connection) -> list[dict]:
    checks = [
        ("payments", "SELECT COUNT(*) AS n FROM payments"),
        ("repayments", "SELECT COUNT(*) AS n FROM repayments"),
        ("settlements", "SELECT COUNT(*) AS n FROM settlements"),
        ("pools", "SELECT COUNT(*) AS n FROM pools"),
    ]
    out: list[dict] = []
    for name, sql in checks:
        alive = True
        try:
            conn.execute(sql).fetchone()
        except Exception:
            alive = False
        out.append({"name": name, "alive": alive})
    return out


def _accounts(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        """
        SELECT c.code AS country, p.currency, p.balance_minor
        FROM pools p
        JOIN countries c ON c.id = p.country_id
        ORDER BY c.code
        """
    ).fetchall()
    out: list[dict] = []
    for row in rows:
        balance_minor = int(row["balance_minor"])
        min_buffer_minor = max(5_000, int(max(balance_minor, 1) * 0.2))
        out.append(
            {
                "id": f"POOL_{row['country']}",
                "kind": "pool",
                "country": str(row["country"]),
                "currency": str(row["currency"]),
                "balance_minor": balance_minor,
                "min_buffer_minor": min_buffer_minor,
            }
        )
    return out


def _open_obligations(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        """
        SELECT
            s.id,
            s.recommended_minor,
            s.status,
            s.created_at,
            cf.code AS from_country,
            ct.code AS to_country
        FROM settlements s
        JOIN countries cf ON cf.id = s.from_country_id
        JOIN countries ct ON ct.id = s.to_country_id
        WHERE s.recommended_minor > 0 AND s.status <> 'executed'
        ORDER BY s.created_at DESC
        """
    ).fetchall()
    return [
        {
            "id": int(row["id"]),
            "from_pool": f"POOL_{row['from_country']}",
            "to_pool": f"POOL_{row['to_country']}",
            "amount_usd_cents": int(row["recommended_minor"]),
            "status": str(row["status"]).upper(),
            "created_at": _parse_timestamp(str(row["created_at"])),
        }
        for row in rows
    ]


def _net_positions(open_obligations: list[dict]) -> list[dict]:
    net_by_pair: dict[tuple[str, str], int] = {}
    for row in open_obligations:
        from_pool = str(row["from_pool"])
        to_pool = str(row["to_pool"])
        amount = int(row["amount_usd_cents"])
        pair = tuple(sorted((from_pool, to_pool)))
        signed = amount if from_pool == pair[0] else -amount
        net_by_pair[pair] = net_by_pair.get(pair, 0) + signed

    out = []
    for (pool_a, pool_b), net in sorted(net_by_pair.items()):
        out.append(
            {
                "pool_a": pool_a,
                "pool_b": pool_b,
                "net_usd_cents": net,
                "abs_usd_cents": abs(net),
            }
        )
    return out


def _transactions_today_count(conn: sqlite3.Connection) -> int:
    row = conn.execute(
        """
        SELECT COUNT(*) AS n
        FROM payments
        WHERE DATE(created_at) = DATE('now')
        """
    ).fetchone()
    return int(row["n"]) if row else 0


def _metrics(open_obligations: list[dict], queued_count: int, transactions_today: int) -> dict:
    gross = sum(int(row["amount_usd_cents"]) for row in open_obligations)
    net = sum(int(pos["abs_usd_cents"]) for pos in _net_positions(open_obligations))
    return {
        "gross_usd_cents_open": gross,
        "net_usd_cents_if_settle_now": net,
        "queued_count": queued_count,
        "transactions_today": transactions_today,
    }


def _workers(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        """
        SELECT
            p.worker_id,
            p.company_id,
            c.code AS country,
            COUNT(*) AS succeeded_payments,
            MAX(p.created_at) AS latest_payment_at
        FROM payments p
        JOIN countries c ON c.id = p.country_id
        WHERE p.status = 'succeeded'
        GROUP BY p.worker_id, p.company_id, c.code
        ORDER BY succeeded_payments DESC, latest_payment_at DESC
        """
    ).fetchall()
    return [
        {
            "worker_id": str(row["worker_id"]),
            "company_id": str(row["company_id"]),
            "country": str(row["country"]),
            "succeeded_payments": int(row["succeeded_payments"]),
            "catboost_ready": int(row["succeeded_payments"]) >= MIN_PD_POINTS,
            "latest_payment_at": str(row["latest_payment_at"]),
            "source": "db",
        }
        for row in rows
    ]


def _recent_payments(conn: sqlite3.Connection, limit: int) -> list[dict]:
    rows = conn.execute(
        """
        SELECT
            p.id,
            p.company_id,
            p.worker_id,
            c.code AS country,
            p.amount_minor,
            p.currency,
            p.service_type,
            p.idempotency_key,
            p.status,
            p.created_at
        FROM payments p
        JOIN countries c ON c.id = p.country_id
        ORDER BY p.created_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [
        {
            "id": int(row["id"]),
            "company_id": str(row["company_id"]),
            "worker_id": str(row["worker_id"]),
            "country": str(row["country"]),
            "amount_minor": int(row["amount_minor"]),
            "currency": str(row["currency"]),
            "service_type": str(row["service_type"]),
            "idempotency_key": str(row["idempotency_key"]),
            "status": str(row["status"]),
            "created_at": str(row["created_at"]),
            "timestamp": _parse_timestamp(str(row["created_at"])),
            "source": "db",
        }
        for row in rows
    ]


def _recent_repayments(conn: sqlite3.Connection, limit: int) -> list[dict]:
    rows = conn.execute(
        """
        SELECT
            id,
            company_id,
            worker_id,
            due_date,
            due_amount_minor,
            paid_at,
            paid_amount_minor,
            status,
            created_at
        FROM repayments
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [
        {
            "id": int(row["id"]),
            "company_id": str(row["company_id"]),
            "worker_id": str(row["worker_id"]),
            "due_date": str(row["due_date"]),
            "due_amount_minor": int(row["due_amount_minor"]),
            "paid_at": str(row["paid_at"]) if row["paid_at"] else None,
            "paid_amount_minor": int(row["paid_amount_minor"]) if row["paid_amount_minor"] is not None else None,
            "status": str(row["status"]),
            "created_at": str(row["created_at"]),
            "source": "db",
        }
        for row in rows
    ]


def _recent_remittances_from_csv(limit: int) -> list[dict]:
    csv_path = REMITTANCES_CSV_PATH if REMITTANCES_CSV_PATH.exists() else FX_TRANSACTIONS_CSV_PATH
    if not csv_path.exists():
        return []

    rows: list[dict] = []
    with csv_path.open("r", encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        for idx, row in enumerate(reader, start=1):
            tx_id = str(row.get("tx_id") or row.get("transaction_id") or f"fx-{idx}")
            date_value = str(row.get("date") or row.get("created_at") or "")
            amount_sent_minor = int(round(_safe_float(row.get("amount_sent"), 0.0) * 100))
            amount_received_minor = int(round(_safe_float(row.get("amount_received"), 0.0) * 100))
            status = str(row.get("status") or "unknown")
            rows.append(
                {
                    "id": idx,
                    "tx_id": tx_id,
                    "worker_id": str(row.get("worker_id") or ""),
                    "stripe_payment_intent": str(row.get("stripe_payment_intent") or ""),
                    "date": date_value,
                    "amount_sent_minor": amount_sent_minor,
                    "currency_sent": str(row.get("currency_sent") or ""),
                    "amount_received_minor": amount_received_minor,
                    "currency_received": str(row.get("currency_received") or ""),
                    "exchange_rate": _safe_float(row.get("exchange_rate"), 0.0),
                    "destination_country": str(row.get("destination_country") or ""),
                    "status": status,
                    "timestamp": _parse_timestamp(date_value),
                    "source": "csv",
                }
            )

    rows.sort(key=lambda item: int(item["timestamp"]), reverse=True)
    return rows[:limit]


def _recent_remittances(conn: sqlite3.Connection, limit: int) -> list[dict]:
    try:
        rows = conn.execute(
            """
            SELECT
                id,
                tx_id,
                worker_id,
                stripe_payment_intent,
                date,
                amount_sent_minor,
                currency_sent,
                amount_received_minor,
                currency_received,
                exchange_rate,
                destination_country,
                status
            FROM remittances
            ORDER BY date DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    except Exception:
        return []

    return [
        {
            "id": int(row["id"]),
            "tx_id": str(row["tx_id"]),
            "worker_id": str(row["worker_id"]),
            "stripe_payment_intent": str(row["stripe_payment_intent"]) if row["stripe_payment_intent"] else "",
            "date": str(row["date"]),
            "amount_sent_minor": int(row["amount_sent_minor"]),
            "currency_sent": str(row["currency_sent"]),
            "amount_received_minor": int(row["amount_received_minor"]),
            "currency_received": str(row["currency_received"]),
            "exchange_rate": _safe_float(row["exchange_rate"], 0.0),
            "destination_country": str(row["destination_country"]),
            "status": str(row["status"]),
            "timestamp": _parse_timestamp(str(row["date"])),
            "source": "db",
        }
        for row in rows
    ]


def _settlements(conn: sqlite3.Connection, limit: int) -> list[dict]:
    rows = conn.execute(
        """
        SELECT
            s.id,
            s.period,
            cf.code AS from_country,
            ct.code AS to_country,
            s.base_transfer_minor,
            s.forecast_adjustment_minor,
            s.recommended_minor,
            s.executed_minor,
            s.status,
            s.rationale,
            s.stripe_transfer_id,
            s.created_at
        FROM settlements s
        JOIN countries cf ON cf.id = s.from_country_id
        JOIN countries ct ON ct.id = s.to_country_id
        ORDER BY s.created_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [
        {
            "id": int(row["id"]),
            "period": str(row["period"]),
            "from_country": str(row["from_country"]),
            "to_country": str(row["to_country"]),
            "base_transfer_minor": int(row["base_transfer_minor"]),
            "forecast_adjustment_minor": int(row["forecast_adjustment_minor"]),
            "recommended_minor": int(row["recommended_minor"]),
            "executed_minor": int(row["executed_minor"]) if row["executed_minor"] is not None else None,
            "status": str(row["status"]),
            "rationale": str(row["rationale"]),
            "stripe_transfer_id": str(row["stripe_transfer_id"]) if row["stripe_transfer_id"] else None,
            "created_at": str(row["created_at"]),
            "source": "db",
        }
        for row in rows
    ]


def _snapshot(conn: sqlite3.Connection, limit: int) -> dict:
    repositories = _repositories_health(conn)
    accounts = _accounts(conn)
    open_obligations = _open_obligations(conn)
    queued_payouts: list[dict] = []
    transactions_today = _transactions_today_count(conn)
    metrics = _metrics(open_obligations, len(queued_payouts), transactions_today)
    workers = _workers_from_csv(limit)
    if not workers:
        workers = _workers(conn)
    recent_payments = _recent_payments_from_csv(limit)
    if not recent_payments:
        recent_payments = _recent_payments(conn, limit)

    recent_repayments = _recent_repayments_from_csv(limit)
    if not recent_repayments:
        recent_repayments = _recent_repayments(conn, limit)
    recent_remittances = _recent_remittances_from_csv(limit)
    if not recent_remittances:
        recent_remittances = _recent_remittances(conn, limit)
    settlements = _settlements(conn, limit)
    credit_log = _credit_log_from_csv(limit)
    net_positions = _net_positions(open_obligations)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repositories": repositories,
        "state": {
            "accounts": accounts,
            "open_obligations": open_obligations,
            "queued_payouts": queued_payouts,
        },
        "metrics": metrics,
        "workers": workers,
        "recent_payments": recent_payments,
        "recent_repayments": recent_repayments,
        "recent_remittances": recent_remittances,
        "credit_log": credit_log,
        "settlements": settlements,
        "net_positions": net_positions,
    }


@router.get("/ingestion/health")
def ingestion_health() -> dict:
    with get_db() as conn:
        repositories = _repositories_health(conn)
    status = "ok" if all(r["alive"] for r in repositories) else "degraded"
    return {"status": status, "repositories": repositories}


@router.get("/ingestion/data")
def ingestion_data(limit: int = Query(default=50, ge=1, le=500)) -> dict:
    with get_db() as conn:
        return _snapshot(conn, limit)


@router.get("/state")
def state() -> dict:
    with get_db() as conn:
        return _snapshot(conn, 50)["state"]


@router.get("/metrics")
def metrics() -> dict:
    with get_db() as conn:
        return _snapshot(conn, 50)["metrics"]


@router.get("/admin/obligations/open")
def admin_obligations_open() -> dict:
    with get_db() as conn:
        open_obligations = _snapshot(conn, 50)["state"]["open_obligations"]
    return {"obligations": open_obligations, "count": len(open_obligations)}


@router.get("/admin/net_positions")
def admin_net_positions() -> dict:
    with get_db() as conn:
        net_positions = _snapshot(conn, 50)["net_positions"]
    return {"net_positions": net_positions}
