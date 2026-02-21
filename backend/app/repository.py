import sqlite3


def get_country_id(conn: sqlite3.Connection, country_code: str) -> int:
    row = conn.execute(
        "SELECT id FROM countries WHERE code = ?",
        (country_code,),
    ).fetchone()
    if not row:
        raise ValueError(f"Unknown country code: {country_code}")
    return int(row["id"])


def get_country_code(conn: sqlite3.Connection, country_id: int) -> str:
    row = conn.execute(
        "SELECT code FROM countries WHERE id = ?",
        (country_id,),
    ).fetchone()
    if not row:
        raise ValueError(f"Unknown country id: {country_id}")
    return str(row["code"])


def list_country_codes(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute("SELECT code FROM countries ORDER BY code").fetchall()
    return [str(r["code"]) for r in rows]
