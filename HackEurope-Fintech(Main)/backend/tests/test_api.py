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
