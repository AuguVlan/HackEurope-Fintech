from fastapi import APIRouter

from ..database import get_db
from ..schemas import PoolResponse

router = APIRouter(tags=["pools"])


@router.get("/pools", response_model=list[PoolResponse])
def list_pools() -> list[PoolResponse]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT c.code AS country, p.balance_minor, p.currency
            FROM pools p
            JOIN countries c ON c.id = p.country_id
            ORDER BY c.code
            """
        ).fetchall()
    return [
        PoolResponse(
            country=str(r["country"]),
            balance_minor=int(r["balance_minor"]),
            currency=str(r["currency"]),
        )
        for r in rows
    ]
