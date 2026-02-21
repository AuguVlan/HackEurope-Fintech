import sqlite3

from ..repository import get_country_id


def get_forecast(conn: sqlite3.Connection, country_code: str, period: str) -> dict:
    country_id = get_country_id(conn, country_code)

    inflow_rows = conn.execute(
        """
        SELECT amount_minor
        FROM payments
        WHERE country_id = ? AND status = 'succeeded'
        ORDER BY created_at DESC
        LIMIT 6
        """,
        (country_id,),
    ).fetchall()
    inflows = [int(r["amount_minor"]) for r in inflow_rows]
    expected_inflow = int(sum(inflows) / len(inflows)) if inflows else 0

    outflow_rows = conn.execute(
        """
        SELECT executed_minor
        FROM settlements
        WHERE from_country_id = ? AND status = 'executed' AND executed_minor IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 6
        """,
        (country_id,),
    ).fetchall()
    outflows = [int(r["executed_minor"]) for r in outflow_rows]
    expected_outflow = int(sum(outflows) / len(outflows)) if outflows else 0

    net_minor = expected_inflow - expected_outflow
    confidence = 0.85 if inflows else 0.45

    return {
        "country": country_code,
        "period": period,
        "expected_inflow_minor": expected_inflow,
        "expected_outflow_minor": expected_outflow,
        "net_minor": net_minor,
        "confidence": confidence,
        "method": "moving-average-v1",
    }
