import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .config import settings


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS countries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pools (
    country_id INTEGER PRIMARY KEY,
    balance_minor INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL,
    FOREIGN KEY(country_id) REFERENCES countries(id)
);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    country_id INTEGER NOT NULL,
    amount_minor INTEGER NOT NULL CHECK(amount_minor > 0),
    currency TEXT NOT NULL,
    service_type TEXT NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    stripe_payment_intent_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(country_id) REFERENCES countries(id)
);

CREATE TABLE IF NOT EXISTS settlements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT NOT NULL,
    from_country_id INTEGER NOT NULL,
    to_country_id INTEGER NOT NULL,
    base_transfer_minor INTEGER NOT NULL,
    forecast_adjustment_minor INTEGER NOT NULL,
    recommended_minor INTEGER NOT NULL,
    executed_minor INTEGER,
    status TEXT NOT NULL,
    rationale TEXT NOT NULL,
    stripe_transfer_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(from_country_id) REFERENCES countries(id),
    FOREIGN KEY(to_country_id) REFERENCES countries(id)
);
"""


def _connect() -> sqlite3.Connection:
    db_path = Path(settings.db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_db():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(SCHEMA_SQL)
        _seed(conn)


def _seed(conn: sqlite3.Connection) -> None:
    countries = [("COUNTRY_A", "Country A"), ("COUNTRY_B", "Country B")]
    for code, name in countries:
        conn.execute(
            "INSERT OR IGNORE INTO countries(code, name) VALUES (?, ?)",
            (code, name),
        )

    rows = conn.execute("SELECT id FROM countries").fetchall()
    for row in rows:
        conn.execute(
            "INSERT OR IGNORE INTO pools(country_id, balance_minor, currency) VALUES (?, 0, ?)",
            (row["id"], settings.default_currency),
        )


def reset_demo_data() -> None:
    with get_db() as conn:
        conn.executescript(
            """
            DROP TABLE IF EXISTS settlements;
            DROP TABLE IF EXISTS payments;
            DROP TABLE IF EXISTS pools;
            DROP TABLE IF EXISTS countries;
            """
        )
    init_db()
