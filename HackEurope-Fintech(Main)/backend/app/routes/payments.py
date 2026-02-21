import sqlite3

from fastapi import APIRouter, Header, HTTPException, status

from ..database import get_db
from ..repository import get_country_id
from ..schemas import PaymentCreate, PaymentResponse
from ..services.stripe_adapter import create_payment_intent

router = APIRouter(tags=["payments"])


def _apply_success_effects(conn: sqlite3.Connection, payment_id: int) -> None:
    row = conn.execute(
        "SELECT country_id, amount_minor, status FROM payments WHERE id = ?",
        (payment_id,),
    ).fetchone()
    if not row:
        return
    if row["status"] == "succeeded":
        return
    conn.execute(
        "UPDATE payments SET status = 'succeeded' WHERE id = ?",
        (payment_id,),
    )
    conn.execute(
        "UPDATE pools SET balance_minor = balance_minor + ? WHERE country_id = ?",
        (int(row["amount_minor"]), int(row["country_id"])),
    )


@router.post("/payments", response_model=PaymentResponse)
def create_payment(
    payload: PaymentCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> PaymentResponse:
    if not idempotency_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Idempotency-Key header is required",
        )

    with get_db() as conn:
        existing = conn.execute(
            """
            SELECT id, status, stripe_payment_intent_id
            FROM payments
            WHERE idempotency_key = ?
            """,
            (idempotency_key,),
        ).fetchone()
        if existing:
            return PaymentResponse(
                id=int(existing["id"]),
                status=str(existing["status"]),
                stripe_payment_intent_id=str(existing["stripe_payment_intent_id"]),
            )

        country_id = get_country_id(conn, payload.country)
        intent = create_payment_intent(
            amount_minor=payload.amount_minor,
            currency=payload.currency.lower(),
            metadata={
                "country": payload.country,
                "company_id": payload.company_id,
                "worker_id": payload.worker_id or payload.company_id,
                "service_type": payload.service_type,
            },
        )
        cur = conn.execute(
            """
            INSERT INTO payments(
                company_id, worker_id, country_id, amount_minor, currency, service_type,
                idempotency_key, stripe_payment_intent_id, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.company_id,
                payload.worker_id or payload.company_id,
                country_id,
                payload.amount_minor,
                payload.currency.upper(),
                payload.service_type,
                idempotency_key,
                intent.id,
                intent.status,
            ),
        )
        return PaymentResponse(
            id=int(cur.lastrowid),
            status=intent.status,
            stripe_payment_intent_id=intent.id,
        )
