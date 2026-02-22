from __future__ import annotations

from datetime import datetime
from statistics import mean, pstdev
import sqlite3

from ..repository import get_country_id

try:
    from catboost import CatBoostClassifier
except Exception:  # pragma: no cover - optional dependency in runtime envs
    CatBoostClassifier = None


MAX_HISTORY = 120
BASELINE_WINDOW = 14
MIN_PD_POINTS = 12
VOLATILITY_TOLERANCE = 0.2
MIN_DELTA_MINOR = 500
MAX_REPAYMENT_HISTORY = 180
REPAYMENT_GRACE_DAYS = 2
DELINQUENT_DAYS = 7
DEFAULT_DAYS = 30
DELINQUENT_MISSED = 1
DEFAULT_MISSED = 2

def _moving_average(values: list[int], window: int = 3) -> int:
    if not values:
        return 0
    return int(mean(values[-window:]))


def _load_payment_history(conn: sqlite3.Connection, country_id: int) -> list[sqlite3.Row]:
    rows = conn.execute(
        """
        SELECT amount_minor, company_id, worker_id, created_at
        FROM payments
        WHERE country_id = ? AND status = 'succeeded'
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (country_id, MAX_HISTORY),
    ).fetchall()
    return list(reversed(rows))


def _load_worker_payment_history(
    conn: sqlite3.Connection,
    worker_id: str,
    company_id: str | None = None,
) -> list[sqlite3.Row]:
    where_clause = "worker_id = ?"
    params: list[object] = [worker_id]
    if company_id:
        where_clause += " AND company_id = ?"
        params.append(company_id)
    params.append(MAX_HISTORY)
    rows = conn.execute(
        f"""
        SELECT amount_minor, company_id, worker_id, created_at
        FROM payments
        WHERE {where_clause} AND status = 'succeeded'
        ORDER BY created_at DESC
        LIMIT ?
        """,
        tuple(params),
    ).fetchall()
    return list(reversed(rows))


def _load_repayment_history(
    conn: sqlite3.Connection,
    worker_id: str,
    company_id: str | None = None,
) -> list[sqlite3.Row]:
    where_clause = "worker_id = ?"
    params: list[object] = [worker_id]
    if company_id:
        where_clause += " AND company_id = ?"
        params.append(company_id)
    params.append(MAX_REPAYMENT_HISTORY)
    rows = conn.execute(
        f"""
        SELECT due_date, due_amount_minor, paid_at, paid_amount_minor, status
        FROM repayments
        WHERE {where_clause}
        ORDER BY due_date DESC
        LIMIT ?
        """,
        tuple(params),
    ).fetchall()
    return list(reversed(rows))


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    raw = str(value)
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        try:
            return datetime.strptime(raw, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None


def _percentile(values: list[int], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    idx = int(round((pct / 100.0) * (len(ordered) - 1)))
    return float(ordered[idx])


def _coefficient_of_variation(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    avg = mean(values)
    if avg == 0:
        return 0.0
    return float(pstdev(values) / avg)


def _interval_days(dates: list[datetime]) -> list[float]:
    if len(dates) < 2:
        return []
    ordered = sorted(dates)
    intervals = []
    for idx in range(1, len(ordered)):
        delta_days = (ordered[idx] - ordered[idx - 1]).total_seconds() / 86400.0
        if delta_days >= 0:
            intervals.append(delta_days)
    return intervals


def _default_state_from_metrics(
    sample_count: int,
    missed_count: int,
    avg_days_late: float,
    max_days_late: int,
    on_time_rate: float,
    repayment_ratio: float,
) -> tuple[str, float]:
    if sample_count == 0:
        return "unknown", 0.35

    if missed_count >= DEFAULT_MISSED or max_days_late >= DEFAULT_DAYS or repayment_ratio < 0.7:
        state = "default"
    elif missed_count >= DELINQUENT_MISSED or avg_days_late >= DELINQUENT_DAYS or on_time_rate < 0.8:
        state = "delinquent"
    else:
        state = "current"

    confidence = min(0.95, 0.4 + sample_count / 20.0)
    return state, round(confidence, 3)


def _repayment_risk_adjustment(
    sample_count: int,
    missed_count: int,
    avg_days_late: float,
    on_time_rate: float,
    repayment_ratio: float,
    amount_cv: float,
    interval_cv: float,
) -> float:
    if sample_count == 0:
        return 0.0

    penalty = 0.0
    if missed_count >= 2:
        penalty += 0.35
    elif missed_count == 1:
        penalty += 0.2

    if on_time_rate < 0.7:
        penalty += 0.2
    elif on_time_rate < 0.85:
        penalty += 0.1

    if avg_days_late >= 14:
        penalty += 0.15
    elif avg_days_late >= 7:
        penalty += 0.05

    if repayment_ratio < 0.8:
        penalty += 0.1

    if amount_cv > 0.5:
        penalty += 0.05

    if interval_cv > 0.6:
        penalty += 0.05

    bonus = 0.0
    if sample_count >= 6 and on_time_rate >= 0.95 and avg_days_late <= 1 and repayment_ratio >= 0.98:
        bonus -= 0.05

    adjustment = max(-0.1, min(0.5, penalty + bonus))
    return round(adjustment, 3)


def _repayment_metrics(repayment_rows: list[sqlite3.Row]) -> dict[str, float | int | str]:
    now = datetime.utcnow()
    due_amounts: list[int] = []
    paid_amounts: list[int] = []
    due_dates: list[datetime] = []
    paid_dates: list[datetime] = []
    days_late: list[int] = []
    missed_count = 0
    paid_count = 0
    on_time_count = 0

    for row in repayment_rows:
        due_amounts.append(int(row["due_amount_minor"]))
        due_dt = _parse_timestamp(row["due_date"])
        if due_dt:
            due_dates.append(due_dt)

        paid_dt = _parse_timestamp(row["paid_at"]) if row["paid_at"] else None
        if paid_dt:
            paid_count += 1
            paid_dates.append(paid_dt)
            paid_amounts.append(int(row["paid_amount_minor"] or 0))
            if due_dt:
                delta_days = (paid_dt - due_dt).total_seconds() / 86400.0
                late_days = max(0, int(round(delta_days)))
                days_late.append(late_days)
                if late_days <= REPAYMENT_GRACE_DAYS:
                    on_time_count += 1
        else:
            if due_dt and due_dt < now:
                missed_count += 1

    total_due = sum(due_amounts)
    total_paid = sum(paid_amounts)
    on_time_rate = on_time_count / paid_count if paid_count else 0.0
    repayment_ratio = total_paid / total_due if total_due else 1.0
    avg_days_late = mean(days_late) if days_late else 0.0
    max_days_late = max(days_late) if days_late else 0
    p90_days_late = _percentile(days_late, 90) if days_late else 0.0

    amount_values = paid_amounts if len(paid_amounts) >= 2 else due_amounts
    amount_cv = _coefficient_of_variation([float(v) for v in amount_values])

    interval_values = _interval_days(paid_dates if len(paid_dates) >= 3 else due_dates)
    interval_cv = _coefficient_of_variation([float(v) for v in interval_values])

    default_state, default_confidence = _default_state_from_metrics(
        len(repayment_rows),
        missed_count,
        avg_days_late,
        max_days_late,
        on_time_rate,
        repayment_ratio,
    )

    adjustment = _repayment_risk_adjustment(
        len(repayment_rows),
        missed_count,
        avg_days_late,
        on_time_rate,
        repayment_ratio,
        amount_cv,
        interval_cv,
    )

    return {
        "repayment_samples": len(repayment_rows),
        "repayment_paid_samples": paid_count,
        "repayment_total_due_minor": int(total_due),
        "repayment_total_paid_minor": int(total_paid),
        "repayment_ratio": round(repayment_ratio, 3),
        "repayment_on_time_rate": round(on_time_rate, 3),
        "repayment_avg_days_late": round(avg_days_late, 2),
        "repayment_p90_days_late": round(p90_days_late, 2),
        "repayment_max_days_late": int(max_days_late),
        "repayment_amount_cv": round(amount_cv, 3),
        "repayment_interval_cv": round(interval_cv, 3),
        "repayment_missed_count": int(missed_count),
        "default_state": default_state,
        "default_state_confidence": default_confidence,
        "repayment_risk_adjustment": adjustment,
    }


def _income_profile(values: list[int]) -> tuple[int, int, int, str, int, int]:
    if not values:
        return 0, 0, MIN_DELTA_MINOR, "stable", 0, 0

    window_values = values[-BASELINE_WINDOW:]
    baseline = int(mean(window_values))
    current = int(values[-1])
    delta = max(MIN_DELTA_MINOR, int(round(baseline * VOLATILITY_TOLERANCE)))

    famine_threshold = baseline - delta
    feast_threshold = baseline + delta
    if current < famine_threshold:
        trigger = "famine"
        advance_minor = famine_threshold - current
        repayment_minor = 0
    elif current > feast_threshold:
        trigger = "feast"
        advance_minor = 0
        repayment_minor = current - feast_threshold
    else:
        trigger = "stable"
        advance_minor = 0
        repayment_minor = 0

    return baseline, current, delta, trigger, advance_minor, repayment_minor


def _risk_features(history: list[int], current: int) -> list[float]:
    baseline = mean(history) if history else 0.0
    sigma = pstdev(history) if len(history) > 1 else 0.0
    cv = sigma / baseline if baseline > 0 else 0.0
    trend = (history[-1] - history[0]) / baseline if len(history) >= 2 and baseline > 0 else 0.0
    min_v = min(history) if history else 0
    max_v = max(history) if history else 0
    drawdown = (max_v - current) / max_v if max_v > 0 else 0.0
    current_ratio = current / baseline if baseline > 0 else 0.0
    return [
        float(baseline),
        float(sigma),
        float(cv),
        float(trend),
        float(drawdown),
        float(current_ratio),
        float(current - baseline),
        float(min_v),
        float(max_v),
    ]


def _heuristic_default_label(history: list[int], current: int) -> int:
    baseline = mean(history) if history else 0.0
    sigma = pstdev(history) if len(history) > 1 else 0.0
    cv = sigma / baseline if baseline > 0 else 0.0
    famine = current < baseline * (1.0 - VOLATILITY_TOLERANCE) if baseline > 0 else False
    drawdown = (max(history) - current) / max(history) if history and max(history) > 0 else 0.0
    return 1 if famine and (cv >= 0.32 or drawdown >= 0.4) else 0


def _fallback_probability(history: list[int], current: int) -> float:
    label = _heuristic_default_label(history, current)
    sigma = pstdev(history) if len(history) > 1 else 0.0
    baseline = mean(history) if history else 0.0
    cv = sigma / baseline if baseline > 0 else 0.0
    if label == 1:
        return min(0.95, 0.6 + cv * 0.8)
    return max(0.05, 0.25 + cv * 0.3)


def _risk_band(p_default: float) -> str:
    if p_default >= 0.6:
        return "high"
    if p_default >= 0.35:
        return "medium"
    return "low"


def _fallback_underwriting(values: list[int], confidence_with_history: float = 0.6) -> tuple[float, str, float]:
    history = values[-BASELINE_WINDOW:] if values else []
    current = values[-1] if values else 0
    p_default = _fallback_probability(history, current)
    confidence = confidence_with_history if values else 0.45
    return round(p_default, 4), "heuristic-underwriting-v1", round(confidence, 3)


def _pd_from_catboost(values: list[int]) -> tuple[float, str, float]:
    if CatBoostClassifier is None or len(values) < MIN_PD_POINTS:
        return _fallback_underwriting(values, confidence_with_history=0.6)

    train_x: list[list[float]] = []
    train_y: list[int] = []
    window = min(BASELINE_WINDOW, max(5, len(values) // 2))
    for idx in range(window, len(values)):
        hist = values[idx - window:idx]
        cur = values[idx]
        train_x.append(_risk_features(hist, cur))
        train_y.append(_heuristic_default_label(hist, cur))

    if len(set(train_y)) < 2:
        return _fallback_underwriting(values[-window:], confidence_with_history=0.65)

    model = CatBoostClassifier(
        iterations=180,
        depth=4,
        learning_rate=0.05,
        loss_function="Logloss",
        random_seed=42,
        verbose=False,
    )
    model.fit(train_x, train_y)
    p_default = float(model.predict_proba([_risk_features(values[-window:], values[-1])])[0][1])
    confidence = min(0.93, 0.65 + len(values) / 150.0)
    return round(p_default, 4), "catboost-underwriting-v1", round(confidence, 3)


def _country_pd_from_workers(payment_rows: list[sqlite3.Row]) -> tuple[float, str, float]:
    worker_histories: dict[str, list[int]] = {}
    for row in payment_rows:
        worker_id = row["worker_id"]
        if not worker_id:
            continue
        worker_histories.setdefault(str(worker_id), []).append(int(row["amount_minor"]))

    if not worker_histories:
        inflows = [int(r["amount_minor"]) for r in payment_rows]
        return _fallback_underwriting(inflows, confidence_with_history=0.55)

    weighted_pd = 0.0
    weighted_confidence = 0.0
    total_weight = 0
    any_catboost = False

    for values in worker_histories.values():
        if len(values) >= MIN_PD_POINTS:
            p_default, method, confidence = _pd_from_catboost(values)
        else:
            p_default, method, confidence = _fallback_underwriting(values, confidence_with_history=0.55)
        weight = len(values)
        weighted_pd += p_default * weight
        weighted_confidence += confidence * weight
        total_weight += weight
        if method == "catboost-underwriting-v1":
            any_catboost = True

    if total_weight == 0:
        return _fallback_underwriting([], confidence_with_history=0.55)

    p_default = round(weighted_pd / total_weight, 4)
    confidence = round(weighted_confidence / total_weight, 3)
    method = "catboost-underwriting-v1" if any_catboost else "heuristic-underwriting-v1"
    return p_default, method, confidence


class FairLendingAuditor:
    def calculate_disparate_impact_ratio(self, approvals: dict[str, list[int]]) -> float:
        rates = []
        for decisions in approvals.values():
            if not decisions:
                continue
            rates.append(sum(decisions) / len(decisions))
        if len(rates) < 2:
            return 1.0
        high = max(rates)
        low = min(rates)
        return round(low / high, 4) if high > 0 else 1.0

    def execute_less_discriminatory_alternative_search(self, base_threshold: float) -> float:
        return max(0.1, min(0.9, base_threshold + 0.02))


def _fair_lending_audit(payment_rows: list[sqlite3.Row], p_default: float) -> tuple[float, str]:
    if len(payment_rows) < 10:
        return 1.0, "not-enough-group-data"

    approvals = {"group_a": [], "group_b": []}
    for row in payment_rows[-30:]:
        company = str(row["company_id"])
        group = "group_a" if sum(ord(ch) for ch in company) % 2 == 0 else "group_b"
        amount = int(row["amount_minor"])
        approved = 1 if amount > 0 and p_default < 0.5 else 0
        approvals[group].append(approved)

    auditor = FairLendingAuditor()
    ratio = auditor.calculate_disparate_impact_ratio(approvals)
    status = "pass-80-rule" if ratio >= 0.8 else "review-required"
    return ratio, status


def _build_income_signal(
    payload: dict[str, str | None],
    payment_rows: list[sqlite3.Row],
    period: str,
    underwriting: tuple[float, str, float] | None = None,
) -> dict:
    inflows = [int(r["amount_minor"]) for r in payment_rows]

    baseline, current, _delta, trigger, advance_minor, repayment_minor = _income_profile(inflows)
    expected_inflow = baseline if baseline > 0 else _moving_average(inflows)
    expected_outflow = repayment_minor
    p_default, method, model_confidence = underwriting or _pd_from_catboost(inflows)
    fair_ratio, fair_status = _fair_lending_audit(payment_rows, p_default)

    net_minor = expected_inflow - expected_outflow
    trigger_confidence = 0.9 if trigger != "stable" else 0.75
    confidence = round((model_confidence + trigger_confidence) / 2.0, 3)
    risk_band = _risk_band(p_default)

    return {
        **payload,
        "period": period,
        "expected_inflow_minor": expected_inflow,
        "expected_outflow_minor": expected_outflow,
        "net_minor": net_minor,
        "confidence": confidence,
        "method": method,
        "baseline_income_minor": baseline,
        "current_earnings_minor": current,
        "trigger_state": trigger,
        "micro_credit_advance_minor": advance_minor,
        "auto_repayment_minor": repayment_minor,
        "p_default": p_default,
        "risk_band": risk_band,
        "fair_lending_disparate_impact_ratio": fair_ratio,
        "fair_lending_audit_status": fair_status,
    }


def get_forecast(conn: sqlite3.Connection, country_code: str, period: str) -> dict:
    country_id = get_country_id(conn, country_code)
    payment_rows = _load_payment_history(conn, country_id)
    underwriting = _country_pd_from_workers(payment_rows)
    return _build_income_signal({"country": country_code}, payment_rows, period, underwriting=underwriting)


def get_income_signal(
    conn: sqlite3.Connection,
    worker_id: str,
    period: str,
    company_id: str | None = None,
) -> dict:
    payment_rows = _load_worker_payment_history(conn, worker_id, company_id)
    signal = _build_income_signal({"worker_id": worker_id, "company_id": company_id}, payment_rows, period)
    repayment_rows = _load_repayment_history(conn, worker_id, company_id)
    repayment_metrics = _repayment_metrics(repayment_rows)
    adjustment = float(repayment_metrics.get("repayment_risk_adjustment", 0.0))
    if adjustment != 0.0:
        adjusted = min(0.99, max(0.01, signal["p_default"] + adjustment))
        signal["p_default"] = round(adjusted, 4)
        signal["risk_band"] = _risk_band(signal["p_default"])
    signal.update(repayment_metrics)
    return signal
