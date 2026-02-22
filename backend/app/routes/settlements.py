from fastapi import APIRouter, Depends, HTTPException

from ..database import get_db
from ..deps import require_operator
from ..schemas import SettlementResponse
from ..services.settlement import execute_settlement, run_settlement

router = APIRouter(tags=["settlements"])


def _map_settlement_row(row) -> SettlementResponse:
    return SettlementResponse(
        id=int(row["id"]),
        period=str(row["period"]),
        from_country=str(row["from_country"]),
        to_country=str(row["to_country"]),
        from_currency=str(row["from_currency"]) if row.get("from_currency") else None,
        to_currency=str(row["to_currency"]) if row.get("to_currency") else None,
        base_transfer_minor=int(row["base_transfer_minor"]),
        forecast_adjustment_minor=int(row["forecast_adjustment_minor"]),
        recommended_minor=int(row["recommended_minor"]),
        executed_minor=int(row["executed_minor"]) if row["executed_minor"] is not None else None,
        status=str(row["status"]),
        rationale=str(row["rationale"]),
        stripe_transfer_id=str(row["stripe_transfer_id"]) if row["stripe_transfer_id"] else None,
        created_at=str(row["created_at"]),
    )


@router.get("/settlements", response_model=list[SettlementResponse])
def list_settlements() -> list[SettlementResponse]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT s.*, cf.code AS from_country, ct.code AS to_country, 
                   pf.currency AS from_currency, pt.currency AS to_currency
            FROM settlements s
            JOIN countries cf ON cf.id = s.from_country_id
            JOIN countries ct ON ct.id = s.to_country_id
            LEFT JOIN pools pf ON pf.country_id = s.from_country_id
            LEFT JOIN pools pt ON pt.country_id = s.to_country_id
            ORDER BY s.created_at DESC
            """
        ).fetchall()
    return [_map_settlement_row(r) for r in rows]


@router.post("/settlements/run", response_model=SettlementResponse, dependencies=[Depends(require_operator)])
def create_settlement_run() -> SettlementResponse:
    with get_db() as conn:
        settlement_id = run_settlement(conn)
        row = conn.execute(
            """
            SELECT s.*, cf.code AS from_country, ct.code AS to_country,
                   pf.currency AS from_currency, pt.currency AS to_currency
            FROM settlements s
            JOIN countries cf ON cf.id = s.from_country_id
            JOIN countries ct ON ct.id = s.to_country_id
            LEFT JOIN pools pf ON pf.country_id = s.from_country_id
            LEFT JOIN pools pt ON pt.country_id = s.to_country_id
            WHERE s.id = ?
            """,
            (settlement_id,),
        ).fetchone()
    return _map_settlement_row(row)


@router.post("/settlements/{settlement_id}/execute", response_model=SettlementResponse, dependencies=[Depends(require_operator)])
def run_settlement_execution(settlement_id: int) -> SettlementResponse:
    with get_db() as conn:
        try:
            execute_settlement(conn, settlement_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        row = conn.execute(
            """
            SELECT s.*, cf.code AS from_country, ct.code AS to_country,
                   pf.currency AS from_currency, pt.currency AS to_currency
            FROM settlements s
            JOIN countries cf ON cf.id = s.from_country_id
            JOIN countries ct ON ct.id = s.to_country_id
            LEFT JOIN pools pf ON pf.country_id = s.from_country_id
            LEFT JOIN pools pt ON pt.country_id = s.to_country_id
            WHERE s.id = ?
            """,
            (settlement_id,),
        ).fetchone()
    return _map_settlement_row(row)
