from datetime import datetime, timedelta

from app.database import get_db, reset_demo_data
from app.repository import get_country_id
from app.services import forecast as forecast_service
from app.services.forecast import get_forecast, get_income_signal


def setup_function() -> None:
    reset_demo_data()


def _seed_payment_history(country: str, amounts: list[int]) -> None:
    with get_db() as conn:
        country_id = get_country_id(conn, country)
        base_ts = datetime(2026, 2, 1, 10, 0, 0)
        for idx, amount in enumerate(amounts):
            created_at = (base_ts + timedelta(hours=idx * 6)).strftime("%Y-%m-%d %H:%M:%S")
            conn.execute(
                """
                INSERT INTO payments(
                    company_id, worker_id, country_id, amount_minor, currency, service_type,
                    idempotency_key, stripe_payment_intent_id, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'succeeded', ?)
                """,
                (
                    f"company-{idx % 3}",
                    f"worker-{idx % 4}",
                    country_id,
                    amount,
                    "EUR",
                    "routing",
                    f"idem-forecast-{idx}",
                    f"pi_forecast_{idx}",
                    created_at,
                ),
            )


def _seed_worker_payment_history(
    country: str,
    company_id: str,
    worker_id: str,
    amounts: list[int],
) -> None:
    with get_db() as conn:
        country_id = get_country_id(conn, country)
        base_ts = datetime(2026, 2, 1, 10, 0, 0)
        for idx, amount in enumerate(amounts):
            created_at = (base_ts + timedelta(hours=idx * 6)).strftime("%Y-%m-%d %H:%M:%S")
            conn.execute(
                """
                INSERT INTO payments(
                    company_id, worker_id, country_id, amount_minor, currency, service_type,
                    idempotency_key, stripe_payment_intent_id, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'succeeded', ?)
                """,
                (
                    company_id,
                    worker_id,
                    country_id,
                    amount,
                    "EUR",
                    "routing",
                    f"idem-{company_id}-{worker_id}-{idx}",
                    f"pi_{company_id}_{worker_id}_{idx}",
                    created_at,
                ),
            )


def _seed_repayments(
    company_id: str,
    worker_id: str,
    rows: list[tuple[str, int, str | None, int | None]],
) -> None:
    with get_db() as conn:
        for idx, (due_date, due_amount, paid_at, paid_amount) in enumerate(rows):
            status = "paid" if paid_at else "due"
            conn.execute(
                """
                INSERT INTO repayments(
                    company_id, worker_id, loan_id, due_date, due_amount_minor, paid_at, paid_amount_minor, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    company_id,
                    worker_id,
                    f"loan-{company_id}-{idx // 3}",
                    due_date,
                    due_amount,
                    paid_at,
                    paid_amount,
                    status,
                ),
            )


def test_famine_trigger_and_micro_credit_advance() -> None:
    _seed_payment_history("COUNTRY_A", [10000, 10200, 9800, 10100, 9900, 4000])
    with get_db() as conn:
        result = get_forecast(conn, "COUNTRY_A", "2026-02-P2")

    assert result["trigger_state"] == "famine"
    assert result["micro_credit_advance_minor"] > 0
    assert result["auto_repayment_minor"] == 0


def test_feast_trigger_and_auto_repayment() -> None:
    _seed_payment_history("COUNTRY_A", [9000, 9200, 9100, 9150, 9300, 15000])
    with get_db() as conn:
        result = get_forecast(conn, "COUNTRY_A", "2026-02-P2")

    assert result["trigger_state"] == "feast"
    assert result["auto_repayment_minor"] > 0
    assert result["micro_credit_advance_minor"] == 0


def test_underwriting_outputs_are_bounded() -> None:
    _seed_payment_history("COUNTRY_A", [10000, 10500, 9400, 11200, 9800, 12100, 9300, 10800, 9500, 11700, 9100, 11500])
    with get_db() as conn:
        result = get_forecast(conn, "COUNTRY_A", "2026-02-P2")

    assert result["method"] in {"catboost-underwriting-v1", "heuristic-underwriting-v1"}
    assert 0.0 <= result["p_default"] <= 1.0
    assert result["risk_band"] in {"low", "medium", "high"}
    assert 0.0 <= result["fair_lending_disparate_impact_ratio"] <= 1.0
    assert 0.0 <= result["overdraft_risk_score"] <= 1.0
    assert result["overdraft_risk_band"] in {"low", "medium", "high", "critical"}
    assert result["max_credit_limit_minor"] >= 0
    assert 0.0 <= result["overdraft_limit_utilization"] <= 1.0
    assert result["overdraft_analysis_method"] == "overdraft-risk-v1"


def test_country_underwriting_is_worker_level_with_min_12(monkeypatch) -> None:
    _seed_payment_history(
        "COUNTRY_A",
        [10000, 9800, 10200, 9600, 10400, 9400, 10600, 9200, 10800, 9000, 11000, 8800],
    )

    calls: list[int] = []
    real_pd_from_catboost = forecast_service._pd_from_catboost

    def spy_pd(values: list[int]) -> tuple[float, str, float]:
        calls.append(len(values))
        return real_pd_from_catboost(values)

    monkeypatch.setattr(forecast_service, "_pd_from_catboost", spy_pd)

    with get_db() as conn:
        result = get_forecast(conn, "COUNTRY_A", "2026-02-P2")

    assert all(size < forecast_service.MIN_PD_POINTS for size in calls)
    assert result["method"] == "heuristic-underwriting-v1"


def test_company_income_signal_endpoint_logic() -> None:
    _seed_payment_history("COUNTRY_A", [8000, 8300, 8600, 8900, 9200, 9500, 9800, 10100, 10400, 10700, 11000, 11300])
    with get_db() as conn:
        result = get_income_signal(conn, "worker-1", "2026-02-P2", company_id="company-1")

    assert result["worker_id"] == "worker-1"
    assert result["company_id"] == "company-1"
    assert result["method"] in {"catboost-underwriting-v1", "heuristic-underwriting-v1"}
    assert 0.0 <= result["p_default"] <= 1.0
    assert 0.0 <= result["overdraft_risk_score"] <= 1.0
    assert result["max_credit_limit_minor"] >= 0


def test_overdraft_limit_reduces_for_defaulted_worker() -> None:
    history = [9600, 9800, 10000, 10200, 10100, 10300, 10400, 10600, 10800, 10700, 10900, 11000]
    _seed_worker_payment_history("COUNTRY_A", "company-good", "worker-good", history)
    _seed_worker_payment_history("COUNTRY_A", "company-bad", "worker-bad", history)

    _seed_repayments(
        "company-good",
        "worker-good",
        [
            ("2026-02-01 10:00:00", 4000, "2026-02-01 18:00:00", 4000),
            ("2026-02-08 10:00:00", 4000, "2026-02-08 18:00:00", 4000),
            ("2026-02-15 10:00:00", 4000, "2026-02-16 09:00:00", 4000),
        ],
    )
    _seed_repayments(
        "company-bad",
        "worker-bad",
        [
            ("2026-02-01 10:00:00", 4000, None, None),
            ("2026-02-08 10:00:00", 4000, None, None),
            ("2026-02-15 10:00:00", 4000, "2026-03-30 10:00:00", 1200),
        ],
    )

    with get_db() as conn:
        good = get_income_signal(conn, "worker-good", "2026-02-P2", company_id="company-good")
        bad = get_income_signal(conn, "worker-bad", "2026-02-P2", company_id="company-bad")

    assert good["default_state"] in {"current", "delinquent"}
    assert bad["default_state"] == "default"
    assert bad["overdraft_risk_score"] >= good["overdraft_risk_score"]
    assert bad["max_credit_limit_minor"] < good["max_credit_limit_minor"]


def test_default_state_uses_repayment_history() -> None:
    _seed_payment_history("COUNTRY_A", [9000, 9200, 9100, 9300, 9400, 9500])
    _seed_repayments(
        "company-1",
        "worker-1",
        [
            ("2026-02-01 10:00:00", 5000, "2026-02-03 10:00:00", 5000),
            ("2026-02-08 10:00:00", 5000, None, None),
            ("2026-02-15 10:00:00", 5000, "2026-02-16 10:00:00", 5000),
        ],
    )
    with get_db() as conn:
        result = get_income_signal(conn, "worker-1", "2026-02-P2", company_id="company-1")

    assert result["default_state"] == "default"
    assert result["repayment_missed_count"] == 1
    assert result["repayment_samples"] == 3
