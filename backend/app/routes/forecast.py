from fastapi import APIRouter, HTTPException, Query, status

from ..database import get_db
from ..schemas import ForecastResponse, IncomeSignalResponse
from ..services.forecast import get_forecast, get_income_signal
from ..services.settlement import current_period

router = APIRouter(tags=["forecast"])


@router.get("/forecast", response_model=ForecastResponse)
def forecast(
    country: str = Query(pattern="^COUNTRY_[AB]$"),
    period: str | None = None,
) -> ForecastResponse:
    target_period = period or current_period()
    with get_db() as conn:
        data = get_forecast(conn, country, target_period)
    return ForecastResponse(**data)


@router.get("/income-signal", response_model=IncomeSignalResponse)
def income_signal(
    worker_id: str | None = Query(default=None, min_length=1, max_length=120),
    company_id: str | None = Query(default=None, min_length=1, max_length=120),
    period: str | None = None,
) -> IncomeSignalResponse:
    target_worker = worker_id or company_id
    if not target_worker:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="worker_id is required (or provide company_id for compatibility)",
        )
    target_period = period or current_period()
    with get_db() as conn:
        data = get_income_signal(conn, target_worker, target_period, company_id=company_id)
    return IncomeSignalResponse(**data)
