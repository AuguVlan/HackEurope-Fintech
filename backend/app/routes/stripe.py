#to_delete
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..database import get_db

router = APIRouter(prefix="/stripe", tags=["stripe"])


def _mark_payment_succeeded(conn, intent_id: str) -> bool:
    row = conn.execute(
        "SELECT id, country_id, amount_minor, status FROM payments WHERE stripe_payment_intent_id = ?",
        (intent_id,),
    ).fetchone()
    if not row:
        return False
    if row["status"] != "succeeded":
        conn.execute(
            "UPDATE payments SET status = 'succeeded' WHERE id = ?",
            (int(row["id"]),),
        )
        conn.execute(
            "UPDATE pools SET balance_minor = balance_minor + ? WHERE country_id = ?",
            (int(row["amount_minor"]), int(row["country_id"])),
        )
    return True


@router.post("/webhook")
def stripe_webhook(payload: dict) -> dict:
    event_type = payload.get("type", "")
    obj = payload.get("data", {}).get("object", {})
    intent_id = obj.get("id")
    if not intent_id:
        raise HTTPException(status_code=400, detail="Missing payment intent id")

    handled = False
    with get_db() as conn:
        if event_type == "payment_intent.succeeded":
            handled = _mark_payment_succeeded(conn, intent_id)
        elif event_type == "payment_intent.payment_failed":
            conn.execute(
                "UPDATE payments SET status = 'failed' WHERE stripe_payment_intent_id = ?",
                (intent_id,),
            )
            handled = True

    return {"received": True, "handled": handled}


class ReconcilePayload(BaseModel):
    stripe_payment_intent_id: str
    status: str


@router.post("/reconcile")
def stripe_reconcile(payload: ReconcilePayload) -> dict:
    with get_db() as conn:
        if payload.status == "succeeded":
            ok = _mark_payment_succeeded(conn, payload.stripe_payment_intent_id)
            return {"updated": ok}
        conn.execute(
            "UPDATE payments SET status = ? WHERE stripe_payment_intent_id = ?",
            (payload.status, payload.stripe_payment_intent_id),
        )
    return {"updated": True}
