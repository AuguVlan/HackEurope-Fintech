from fastapi.testclient import TestClient

from app.config import settings
from app.database import reset_demo_data
from app.main import app


client = TestClient(app)


def setup_function() -> None:
    reset_demo_data()


def test_health() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_payment_requires_idempotency_key() -> None:
    res = client.post(
        "/payments",
        json={
            "country": "COUNTRY_A",
            "company_id": "acme",
            "worker_id": "worker-acme",
            "amount_minor": 1000,
            "currency": "EUR",
            "service_type": "routing",
        },
    )
    assert res.status_code == 400


def test_end_to_end_payment_pool_and_settlement() -> None:
    payment = client.post(
        "/payments",
        headers={"Idempotency-Key": "idem-1"},
        json={
            "country": "COUNTRY_A",
            "company_id": "acme",
            "worker_id": "worker-acme",
            "amount_minor": 10000,
            "currency": "EUR",
            "service_type": "routing",
        },
    )
    assert payment.status_code == 200
    payment_intent = payment.json()["stripe_payment_intent_id"]

    webhook = client.post(
        "/stripe/webhook",
        json={
            "type": "payment_intent.succeeded",
            "data": {"object": {"id": payment_intent}},
        },
    )
    assert webhook.status_code == 200

    pools = client.get("/pools")
    assert pools.status_code == 200
    pool_map = {row["country"]: row["balance_minor"] for row in pools.json()}
    assert pool_map["COUNTRY_A"] == 10000

    run = client.post(
        "/settlements/run",
        headers={"X-Operator-Token": settings.operator_token},
    )
    assert run.status_code == 200
    settlement_id = run.json()["id"]

    execute = client.post(
        f"/settlements/{settlement_id}/execute",
        headers={"X-Operator-Token": settings.operator_token},
    )
    if run.json()["recommended_minor"] > 0:
        assert execute.status_code == 200


def _create_succeeded_payment(idem_key: str, amount_minor: int) -> None:
    payment = client.post(
        "/payments",
        headers={"Idempotency-Key": idem_key},
        json={
            "country": "COUNTRY_A",
            "company_id": "acme",
            "worker_id": "worker-acme",
            "amount_minor": amount_minor,
            "currency": "EUR",
            "service_type": "routing",
        },
    )
    assert payment.status_code == 200
    payment_intent = payment.json()["stripe_payment_intent_id"]

    webhook = client.post(
        "/stripe/webhook",
        json={
            "type": "payment_intent.succeeded",
            "data": {"object": {"id": payment_intent}},
        },
    )
    assert webhook.status_code == 200


def test_forecast_method_switches_with_more_history() -> None:
    for i in range(10):
        _create_succeeded_payment(f"idem-history-{i}", 10000 + i * 250)

    res = client.get("/forecast", params={"country": "COUNTRY_A", "period": "2026-02-P2"})
    assert res.status_code == 200
    body = res.json()

    assert body["method"] in {"catboost-underwriting-v1", "heuristic-underwriting-v1"}
    assert body["trigger_state"] in {"famine", "feast", "stable"}
    assert 0.0 <= body["p_default"] <= 1.0
    assert body["risk_band"] in {"low", "medium", "high"}
    assert 0.0 <= body["fair_lending_disparate_impact_ratio"] <= 1.0


def test_income_signal_company_endpoint() -> None:
    for i in range(12):
        _create_succeeded_payment(f"idem-company-{i}", 9500 + i * 180)

    res = client.get("/income-signal", params={"worker_id": "worker-acme", "company_id": "acme", "period": "2026-02-P2"})
    assert res.status_code == 200
    body = res.json()

    assert body["worker_id"] == "worker-acme"
    assert body["company_id"] == "acme"
    assert body["method"] in {"catboost-underwriting-v1", "heuristic-underwriting-v1"}
    assert body["trigger_state"] in {"famine", "feast", "stable"}
    assert 0.0 <= body["p_default"] <= 1.0
    assert body["default_state"] in {"current", "delinquent", "default", "unknown"}
    assert "repayment_on_time_rate" in body


def test_ingestion_data_snapshot_contains_frontend_payload() -> None:
    for i in range(3):
        _create_succeeded_payment(f"idem-ingestion-{i}", 10_000 + i * 500)

    res = client.get("/ingestion/data")
    assert res.status_code == 200
    body = res.json()

    assert "generated_at" in body
    assert "repositories" in body
    assert "state" in body
    assert "metrics" in body
    assert "workers" in body
    assert "recent_payments" in body
    assert "credit_log" in body
    assert "settlements" in body
    assert isinstance(body["state"]["accounts"], list)
    assert isinstance(body["state"]["open_obligations"], list)
    assert isinstance(body["state"]["queued_payouts"], list)
    assert body["metrics"]["gross_usd_cents_open"] >= 0
    assert body["metrics"]["queued_count"] >= 0
    assert isinstance(body["credit_log"], list)


def test_state_and_metrics_routes_are_available() -> None:
    state_res = client.get("/state")
    metrics_res = client.get("/metrics")

    assert state_res.status_code == 200
    assert metrics_res.status_code == 200

    state = state_res.json()
    metrics = metrics_res.json()

    assert "accounts" in state
    assert "open_obligations" in state
    assert "queued_payouts" in state
    assert "gross_usd_cents_open" in metrics
    assert "net_usd_cents_if_settle_now" in metrics
    assert "queued_count" in metrics
