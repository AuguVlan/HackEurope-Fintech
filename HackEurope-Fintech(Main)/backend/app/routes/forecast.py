from fastapi import APIRouter, Query

from ..database import get_db
from ..schemas import ForecastResponse
from ..services.forecast import get_forecast
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
