from __future__ import annotations

from datetime import datetime, timedelta
from statistics import mean
import sqlite3

from ..repository import get_country_id

try:
    from catboost import CatBoostRegressor
except Exception:  # pragma: no cover - optional dependency in runtime envs
    CatBoostRegressor = None


WINDOW = 3
MAX_HISTORY = 120
MIN_CATBOOST_POINTS = 8


def _parse_timestamp(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value.replace(" ", "T"))
    except ValueError:
        return datetime.utcnow()


def _moving_average(values: list[int], window: int = WINDOW) -> int:
    if not values:
        return 0
    return int(mean(values[-window:]))


def _load_amount_history(
    conn: sqlite3.Connection, *, table: str, amount_col: str, country_col: str, country_id: int
) -> tuple[list[int], list[datetime]]:
    rows = conn.execute(
        f"""
        SELECT {amount_col} AS amount, created_at
        FROM {table}
        WHERE {country_col} = ? AND status = 'executed' AND {amount_col} IS NOT NULL
        ORDER BY created_at DESC
        LIMIT ?
        """
        if table == "settlements"
        else f"""
        SELECT {amount_col} AS amount, created_at
        FROM {table}
        WHERE {country_col} = ? AND status = 'succeeded'
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (country_id, MAX_HISTORY),
    ).fetchall()
    rows = list(reversed(rows))
    values = [int(r["amount"]) for r in rows]
    timestamps = [_parse_timestamp(str(r["created_at"])) for r in rows]
    return values, timestamps


def _build_training_frame(values: list[int], timestamps: list[datetime]) -> tuple[list[list[float]], list[float]]:
    features: list[list[float]] = []
    targets: list[float] = []
    for idx in range(WINDOW, len(values)):
        lag1 = float(values[idx - 1])
        lag2 = float(values[idx - 2])
        lag3 = float(values[idx - 3])
        ts = timestamps[idx]
        features.append(
            [
                lag1,
                lag2,
                lag3,
                (lag1 + lag2 + lag3) / 3.0,
                lag1 - lag3,
                float(ts.weekday()),
                float(ts.day),
                float(ts.hour),
            ]
        )
        targets.append(float(values[idx]))
    return features, targets


def _next_feature_row(values: list[int], timestamps: list[datetime]) -> list[float]:
    lag1 = float(values[-1])
    lag2 = float(values[-2])
    lag3 = float(values[-3])
    if len(timestamps) >= 2:
        deltas = [
            max(60.0, (timestamps[i] - timestamps[i - 1]).total_seconds())
            for i in range(1, len(timestamps))
        ]
        next_ts = timestamps[-1] + timedelta(seconds=sum(deltas) / len(deltas))
    else:
        next_ts = datetime.utcnow()
    return [
        lag1,
        lag2,
        lag3,
        (lag1 + lag2 + lag3) / 3.0,
        lag1 - lag3,
        float(next_ts.weekday()),
        float(next_ts.day),
        float(next_ts.hour),
    ]


def _catboost_forecast(values: list[int], timestamps: list[datetime]) -> tuple[int, float] | None:
    if CatBoostRegressor is None or len(values) < MIN_CATBOOST_POINTS:
        return None

    train_x, train_y = _build_training_frame(values, timestamps)
    if len(train_x) < 4:
        return None

    eval_size = max(1, len(train_x) // 5)
    has_eval = len(train_x) - eval_size >= 2
    fit_x = train_x[:-eval_size] if has_eval else train_x
    fit_y = train_y[:-eval_size] if has_eval else train_y
    eval_x = train_x[-eval_size:] if has_eval else []
    eval_y = train_y[-eval_size:] if has_eval else []

    model = CatBoostRegressor(
        iterations=200,
        depth=4,
        learning_rate=0.05,
        loss_function="MAE",
        random_seed=42,
        verbose=False,
    )
    model.fit(fit_x, fit_y)
    prediction = max(0, int(round(float(model.predict([_next_feature_row(values, timestamps)])[0]))))

    if not eval_x:
        confidence = min(0.9, 0.58 + len(values) * 0.01)
        return prediction, round(confidence, 3)

    errors = [
        abs(float(pred) - float(actual))
        for pred, actual in zip(model.predict(eval_x), eval_y)
    ]
    scale = max(1.0, mean(eval_y))
    normalized_mae = min(1.0, mean(errors) / scale)
    data_factor = min(1.0, len(values) / 30.0)
    confidence = max(0.5, min(0.95, 0.66 + 0.22 * data_factor - 0.25 * normalized_mae))
    return prediction, round(confidence, 3)


def _forecast_amount(values: list[int], timestamps: list[datetime]) -> tuple[int, float, str]:
    if not values:
        return 0, 0.45, "moving-average-v1"

    catboost_result = _catboost_forecast(values, timestamps)
    if catboost_result is not None:
        prediction, confidence = catboost_result
        return prediction, confidence, "catboost-v1"

    confidence = 0.8 if len(values) >= WINDOW else 0.62
    return _moving_average(values), confidence, "moving-average-v1"


def get_forecast(conn: sqlite3.Connection, country_code: str, period: str) -> dict:
    country_id = get_country_id(conn, country_code)

    inflows, inflow_timestamps = _load_amount_history(
        conn,
        table="payments",
        amount_col="amount_minor",
        country_col="country_id",
        country_id=country_id,
    )
    outflows, outflow_timestamps = _load_amount_history(
        conn,
        table="settlements",
        amount_col="executed_minor",
        country_col="from_country_id",
        country_id=country_id,
    )

    expected_inflow, inflow_confidence, inflow_method = _forecast_amount(inflows, inflow_timestamps)
    expected_outflow, outflow_confidence, outflow_method = _forecast_amount(outflows, outflow_timestamps)

    net_minor = expected_inflow - expected_outflow
    if inflows and outflows:
        confidence = round((inflow_confidence + outflow_confidence) / 2.0, 3)
    elif inflows:
        confidence = inflow_confidence
    elif outflows:
        confidence = outflow_confidence
    else:
        confidence = 0.45

    if inflow_method == outflow_method:
        method = inflow_method
    elif "catboost-v1" in (inflow_method, outflow_method):
        method = "hybrid-catboost-v1"
    else:
        method = "moving-average-v1"

    return {
        "country": country_code,
        "period": period,
        "expected_inflow_minor": expected_inflow,
        "expected_outflow_minor": expected_outflow,
        "net_minor": net_minor,
        "confidence": confidence,
        "method": method,
    }
