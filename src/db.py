"""
Database module for Synthetic Liquidity Ledger (PDF spec).
Handles all SQLite operations for accounts, FX rates, journal entries,
postings, obligations, settlement_batches, and payout_queue.
"""

import sqlite3
from typing import List, Dict, Any, Optional
import json

from .config import get_settings

DB_PATH = get_settings().DATABASE_PATH


def _ensure_data_dir():
    from .config import DATA_DIR
    DATA_DIR.mkdir(exist_ok=True)


def execute_query(
    sql: str,
    params: tuple = (),
    one: bool = False,
    fetch: bool = True
) -> Optional[Any]:
    """Execute a SQL query safely. Uses a new connection per call."""
    _ensure_data_dir()
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    try:
        cur.execute(sql, params)
        con.commit()
        if fetch:
            rows = cur.fetchall()
            return (rows[0] if rows else None) if one else rows
    finally:
        con.close()
    return None


def init_db() -> None:
    """Initialize database with PDF schema (all 7 tables)."""
    _ensure_data_dir()
    execute_query("""
        CREATE TABLE IF NOT EXISTS accounts(
            id TEXT PRIMARY KEY,
            kind TEXT,
            country TEXT,
            currency TEXT,
            balance_minor INTEGER,
            min_buffer_minor INTEGER
        )
    """)
    execute_query("""
        CREATE TABLE IF NOT EXISTS fx_rates(
            currency TEXT PRIMARY KEY,
            usd_per_unit REAL
        )
    """)
    execute_query("""
        CREATE TABLE IF NOT EXISTS journal_entries(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at INTEGER,
            type TEXT,
            external_id TEXT UNIQUE,
            metadata_json TEXT
        )
    """)
    execute_query("""
        CREATE TABLE IF NOT EXISTS postings(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id INTEGER,
            account_id TEXT,
            direction TEXT,
            amount_minor INTEGER
        )
    """)
    execute_query("""
        CREATE TABLE IF NOT EXISTS obligations(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at INTEGER,
            from_pool TEXT,
            to_pool TEXT,
            amount_usd_cents INTEGER,
            status TEXT,
            settlement_batch_id INTEGER
        )
    """)
    execute_query("""
        CREATE TABLE IF NOT EXISTS settlement_batches(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at INTEGER,
            notes TEXT
        )
    """)
    execute_query("""
        CREATE TABLE IF NOT EXISTS payout_queue(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at INTEGER,
            from_pool TEXT,
            to_pool TEXT,
            amount_minor INTEGER,
            status TEXT
        )
    """)
    _migrate_obligations_add_settlement_batch_id()


def _migrate_obligations_add_settlement_batch_id() -> None:
    """Add settlement_batch_id to obligations if the table was created with an older schema."""
    _ensure_data_dir()
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    try:
        cur.execute("PRAGMA table_info(obligations)")
        columns = [row[1] for row in cur.fetchall()]
        if "settlement_batch_id" not in columns:
            cur.execute("ALTER TABLE obligations ADD COLUMN settlement_batch_id INTEGER")
            con.commit()
    finally:
        con.close()


# ----- Accounts -----

def fetch_account(account_id: str) -> Optional[Dict[str, Any]]:
    """Fetch an account by ID."""
    result = execute_query("SELECT * FROM accounts WHERE id=?", (account_id,), one=True)
    return dict(result) if result else None


def fetch_all_accounts() -> List[Dict[str, Any]]:
    """Fetch all accounts."""
    results = execute_query("SELECT * FROM accounts")
    return [dict(r) for r in results]


def update_account_balance(account_id: str, amount_delta: int) -> None:
    """Update account balance (call only after journal/postings recorded)."""
    execute_query(
        "UPDATE accounts SET balance_minor = balance_minor + ? WHERE id = ?",
        (amount_delta, account_id),
        fetch=False
    )


# ----- FX rates -----

def fetch_fx_rate(currency: str) -> Optional[float]:
    """Fetch FX rate for a currency (usd_per_unit)."""
    result = execute_query(
        "SELECT usd_per_unit FROM fx_rates WHERE currency=?",
        (currency,),
        one=True
    )
    return float(result["usd_per_unit"]) if result else None


# ----- Journal entries & postings (idempotency) -----

def get_journal_entry_by_external_id(external_id: str) -> Optional[Dict[str, Any]]:
    """Get journal entry by external_id (for idempotency)."""
    result = execute_query(
        "SELECT * FROM journal_entries WHERE external_id = ?",
        (external_id,),
        one=True
    )
    return dict(result) if result else None


def insert_journal_entry(
    created_at: int,
    type_: str,
    external_id: Optional[str],
    metadata_json: Optional[str] = None
) -> int:
    """Insert a journal entry. Returns id. external_id must be unique for idempotency."""
    execute_query(
        """INSERT INTO journal_entries(created_at, type, external_id, metadata_json)
           VALUES(?, ?, ?, ?)""",
        (created_at, type_, external_id, metadata_json),
        fetch=False
    )
    r = execute_query("SELECT last_insert_rowid() AS id", one=True)
    return r["id"] if r else 0


def update_journal_entry_metadata(entry_id: int, metadata_json: Optional[str]) -> None:
    """Update metadata_json for a journal entry (e.g. for idempotency response)."""
    execute_query(
        "UPDATE journal_entries SET metadata_json = ? WHERE id = ?",
        (metadata_json, entry_id),
        fetch=False
    )


def insert_posting(entry_id: int, account_id: str, direction: str, amount_minor: int) -> int:
    """Insert a posting. direction is 'CREDIT' or 'DEBIT'. Returns id."""
    execute_query(
        """INSERT INTO postings(entry_id, account_id, direction, amount_minor)
           VALUES(?, ?, ?, ?)""",
        (entry_id, account_id, direction, amount_minor),
        fetch=False
    )
    r = execute_query("SELECT last_insert_rowid() AS id", one=True)
    return r["id"] if r else 0


def fetch_postings_for_entry(entry_id: int) -> List[Dict[str, Any]]:
    """Fetch all postings for a journal entry."""
    results = execute_query("SELECT * FROM postings WHERE entry_id = ? ORDER BY id", (entry_id,))
    return [dict(r) for r in results]


def fetch_journal_entries_for_account(
    account_id: str,
    limit: int = 100,
    offset: int = 0,
    from_ts: Optional[int] = None,
    to_ts: Optional[int] = None,
    type_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Fetch journal entries that have at least one posting for this account. Returns entries with posting details for this account."""
    conditions = ["p.account_id = ?"]
    params: list = [account_id]
    if from_ts is not None:
        conditions.append("je.created_at >= ?")
        params.append(from_ts)
    if to_ts is not None:
        conditions.append("je.created_at <= ?")
        params.append(to_ts)
    if type_filter:
        conditions.append("je.type = ?")
        params.append(type_filter)
    where = " AND ".join(conditions)
    # Get distinct entry ids for this account
    sql = f"""
        SELECT DISTINCT je.id FROM journal_entries je
        INNER JOIN postings p ON p.entry_id = je.id
        WHERE {where}
        ORDER BY je.created_at DESC
        LIMIT ? OFFSET ?
    """
    params.extend([limit, offset])
    rows = execute_query(sql, tuple(params))
    entry_ids = [r["id"] for r in rows] if rows else []
    if not entry_ids:
        return []
    placeholders = ",".join("?" * len(entry_ids))
    entries = execute_query(
        f"SELECT * FROM journal_entries WHERE id IN ({placeholders}) ORDER BY created_at DESC",
        tuple(entry_ids)
    )
    result = []
    for ent in entries:
        e = dict(ent)
        postings_list = fetch_postings_for_entry(e["id"])
        # Include the posting(s) for this account only (for amount/direction)
        my_postings = [p for p in postings_list if p["account_id"] == account_id]
        e["postings"] = my_postings
        result.append(e)
    result.sort(key=lambda x: x["created_at"] or 0, reverse=True)
    return result


def fetch_all_journal_entries(
    limit: int = 200,
    offset: int = 0,
    from_ts: Optional[int] = None,
    to_ts: Optional[int] = None,
    type_filter: Optional[str] = None,
    account_currency: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Fetch journal entries for admin. Optional filter by account currency (via postings->accounts)."""
    conditions = ["1=1"]
    params: list = []
    if from_ts is not None:
        conditions.append("je.created_at >= ?")
        params.append(from_ts)
    if to_ts is not None:
        conditions.append("je.created_at <= ?")
        params.append(to_ts)
    if type_filter:
        conditions.append("je.type = ?")
        params.append(type_filter)
    if account_currency:
        conditions.append("EXISTS (SELECT 1 FROM postings p2 JOIN accounts a ON a.id = p2.account_id WHERE p2.entry_id = je.id AND a.currency = ?)")
        params.append(account_currency)
    where = " AND ".join(conditions)
    sql = f"""
        SELECT je.* FROM journal_entries je
        WHERE {where}
        ORDER BY je.created_at DESC
        LIMIT ? OFFSET ?
    """
    params.extend([limit, offset])
    rows = execute_query(sql, tuple(params))
    result = []
    for r in rows:
        e = dict(r)
        e["postings"] = fetch_postings_for_entry(e["id"])
        result.append(e)
    return result


def count_journal_entries_today() -> int:
    """Count journal entries created today (UTC day)."""
    import time
    now = int(time.time())
    day_sec = 86400
    start_today = (now // day_sec) * day_sec
    r = execute_query(
        "SELECT COUNT(*) AS c FROM journal_entries WHERE created_at >= ?",
        (start_today,),
        one=True
    )
    return int(r["c"]) if r else 0


# ----- Obligations -----

def fetch_open_obligations() -> List[Dict[str, Any]]:
    """Fetch all OPEN obligations."""
    results = execute_query(
        "SELECT * FROM obligations WHERE status = 'OPEN' ORDER BY id"
    )
    return [dict(r) for r in results]


def fetch_all_obligations(limit: int = 200) -> List[Dict[str, Any]]:
    """Fetch all obligations (for state)."""
    results = execute_query(
        "SELECT * FROM obligations ORDER BY id DESC LIMIT ?",
        (limit,)
    )
    return [dict(r) for r in results]


def insert_obligation(
    from_pool: str,
    to_pool: str,
    amount_usd_cents: int,
    created_at: int,
    settlement_batch_id: Optional[int] = None
) -> int:
    """Insert a new obligation. Returns id."""
    execute_query(
        """INSERT INTO obligations(created_at, from_pool, to_pool, amount_usd_cents, status, settlement_batch_id)
           VALUES(?, ?, ?, ?, 'OPEN', ?)""",
        (created_at, from_pool, to_pool, amount_usd_cents, settlement_batch_id),
        fetch=False
    )
    r = execute_query("SELECT last_insert_rowid() AS id", one=True)
    return r["id"] if r else 0


def update_obligations_settled(obligation_ids: List[int], settlement_batch_id: int) -> None:
    """Mark obligations as SETTLED and set settlement_batch_id."""
    if not obligation_ids:
        return
    placeholders = ",".join("?" * len(obligation_ids))
    execute_query(
        f"""UPDATE obligations SET status = 'SETTLED', settlement_batch_id = ?
           WHERE id IN ({placeholders})""",
        (settlement_batch_id,) + tuple(obligation_ids),
        fetch=False
    )


def fetch_obligations_gross_usd_cents_open() -> int:
    """Sum of amount_usd_cents for all OPEN obligations."""
    r = execute_query(
        "SELECT COALESCE(SUM(amount_usd_cents), 0) AS total FROM obligations WHERE status = 'OPEN'",
        one=True
    )
    return int(r["total"]) if r else 0


# ----- Settlement batches -----

def insert_settlement_batch(created_at: int, notes: Optional[str] = None) -> int:
    """Insert a settlement batch. Returns id."""
    execute_query(
        "INSERT INTO settlement_batches(created_at, notes) VALUES(?, ?)",
        (created_at, notes or ""),
        fetch=False
    )
    r = execute_query("SELECT last_insert_rowid() AS id", one=True)
    return r["id"] if r else 0


# ----- Payout queue -----

def insert_payout_queue(
    created_at: int,
    from_pool: str,
    to_pool: str,
    amount_minor: int,
    status: str = "QUEUED"
) -> int:
    """Insert into payout_queue. Returns id."""
    execute_query(
        """INSERT INTO payout_queue(created_at, from_pool, to_pool, amount_minor, status)
           VALUES(?, ?, ?, ?, ?)""",
        (created_at, from_pool, to_pool, amount_minor, status),
        fetch=False
    )
    r = execute_query("SELECT last_insert_rowid() AS id", one=True)
    return r["id"] if r else 0


def fetch_payout_queue_queued_count() -> int:
    """Count of payout_queue rows with status = 'QUEUED'."""
    r = execute_query(
        "SELECT COUNT(*) AS c FROM payout_queue WHERE status = 'QUEUED'",
        one=True
    )
    return int(r["c"]) if r else 0


def fetch_payout_queue_queued(limit: int = 100) -> List[Dict[str, Any]]:
    """Fetch QUEUED payout_queue rows."""
    results = execute_query(
        "SELECT * FROM payout_queue WHERE status = 'QUEUED' ORDER BY id LIMIT ?",
        (limit,)
    )
    return [dict(r) for r in results]


def update_payout_queue_status(queue_id: int, status: str) -> None:
    """Update payout_queue row status."""
    execute_query(
        "UPDATE payout_queue SET status = ? WHERE id = ?",
        (status, queue_id),
        fetch=False
    )


# ----- Seed & reset -----

def clear_all_data() -> None:
    """Clear all data (for init/reset). Order respects FKs conceptually (no FKs in SQLite)."""
    execute_query("DELETE FROM postings", fetch=False)
    execute_query("DELETE FROM journal_entries", fetch=False)
    execute_query("DELETE FROM obligations", fetch=False)
    execute_query("DELETE FROM settlement_batches", fetch=False)
    execute_query("DELETE FROM payout_queue", fetch=False)
    execute_query("DELETE FROM accounts", fetch=False)
    execute_query("DELETE FROM fx_rates", fetch=False)


def seed_sample_data() -> None:
    """Seed accounts, FX rates, and fake journal/obligations for demo history."""
    clear_all_data()
    # Accounts: id, kind, country, currency, balance_minor, min_buffer_minor
    for row in [
        ("POOL_UK_GBP", "POOL", "UK", "GBP", 5_000_00, 10_00),   # £50,000, buffer £100
        ("POOL_BR_BRL", "POOL", "BR", "BRL", 10_000_00, 10_00),  # 100,000 BRL, buffer 100
        ("POOL_EU_EUR", "POOL", "EU", "EUR", 8_000_00, 10_00),   # €80,000, buffer €100
        ("WORKER_1", "WORKER", "UK", "GBP", 1_000_00, 0),        # Gig workers (balance in minor)
        ("WORKER_2", "WORKER", "EU", "EUR", 500_00, 0),
        ("WORKER_3", "WORKER", "BR", "BRL", 2_000_00, 0),
    ]:
        execute_query(
            "INSERT INTO accounts(id, kind, country, currency, balance_minor, min_buffer_minor) VALUES(?, ?, ?, ?, ?, ?)",
            row,
            fetch=False
        )
    for row in [("GBP", 1.25), ("BRL", 0.20), ("EUR", 1.10), ("USD", 1.0)]:
        execute_query("INSERT INTO fx_rates(currency, usd_per_unit) VALUES(?, ?)", row, fetch=False)
    seed_fake_journal_and_obligations()


def seed_fake_journal_and_obligations() -> None:
    """Insert fake journal entries, postings, and obligations so history is visible in the UI."""
    import time
    now = int(time.time())
    day = 86400
    # Timestamps over the last 5 days + recent (need 9 slots: indices 0..8)
    t = [now - day * i for i in range(5, 0, -1)] + [now - 3600, now - 1800, now - 60, now]

    # ---- TOPUPs (credit workers/pools) ----
    e1 = insert_journal_entry(t[0], "TOPUP", None, '{"account_id":"WORKER_1","note":"Initial topup"}')
    insert_posting(e1, "WORKER_1", "CREDIT", 5000)
    update_account_balance("WORKER_1", 5000)

    e2 = insert_journal_entry(t[1], "TOPUP", None, '{"account_id":"WORKER_2"}')
    insert_posting(e2, "WORKER_2", "CREDIT", 3000)
    update_account_balance("WORKER_2", 3000)

    e3 = insert_journal_entry(t[2], "TOPUP", None, '{"account_id":"POOL_UK_GBP"}')
    insert_posting(e3, "POOL_UK_GBP", "CREDIT", 10000)
    update_account_balance("POOL_UK_GBP", 10000)

    # ---- PAYOUTs (from_pool -> to_pool: DEBIT to_pool, obligation from_pool owes to_pool) ----
    e4 = insert_journal_entry(t[3], "PAYOUT", None, '{"obligation_id":1,"amount_usd_cents":25000,"queued":false}')
    insert_posting(e4, "WORKER_1", "DEBIT", 2000)
    update_account_balance("WORKER_1", -2000)
    insert_obligation("POOL_UK_GBP", "WORKER_1", 25000, t[3])

    e5 = insert_journal_entry(t[4], "PAYOUT", None, '{"obligation_id":2,"amount_usd_cents":16500,"queued":false}')
    insert_posting(e5, "WORKER_2", "DEBIT", 1500)
    update_account_balance("WORKER_2", -1500)
    insert_obligation("POOL_EU_EUR", "WORKER_2", 16500, t[4])

    e6 = insert_journal_entry(t[5], "PAYOUT", None, '{"obligation_id":3,"amount_usd_cents":62500,"queued":false}')
    insert_posting(e6, "POOL_BR_BRL", "DEBIT", 5000)
    update_account_balance("POOL_BR_BRL", -5000)
    insert_obligation("POOL_UK_GBP", "POOL_BR_BRL", 62500, t[5])

    e7 = insert_journal_entry(t[6], "PAYOUT", None, '{"obligation_id":4,"amount_usd_cents":44000,"queued":false}')
    insert_posting(e7, "POOL_UK_GBP", "DEBIT", 4000)
    update_account_balance("POOL_UK_GBP", -4000)
    insert_obligation("POOL_EU_EUR", "POOL_UK_GBP", 44000, t[6])

    e8 = insert_journal_entry(t[7], "PAYOUT", None, '{"obligation_id":5,"amount_usd_cents":2000,"queued":false}')
    insert_posting(e8, "WORKER_3", "DEBIT", 1000)
    update_account_balance("WORKER_3", -1000)
    insert_obligation("POOL_BR_BRL", "WORKER_3", 2000, t[7])

    # ---- Queued payout (journal only, no balance change) ----
    insert_payout_queue(t[7], "POOL_BR_BRL", "WORKER_3", 50000, "QUEUED")
    insert_journal_entry(t[7], "QUEUED_PAYOUT", "fake-idem-1", '{"payout_queue_id":1,"queued":true}')

    # ---- More TOPUPs so workers have visible history ----
    e10 = insert_journal_entry(t[8], "TOPUP", None, '{"account_id":"WORKER_3"}')
    insert_posting(e10, "WORKER_3", "CREDIT", 8000)
    update_account_balance("WORKER_3", 8000)

    e11 = insert_journal_entry(t[2], "TOPUP", None, '{"account_id":"WORKER_1"}')
    insert_posting(e11, "WORKER_1", "CREDIT", 3000)
    update_account_balance("WORKER_1", 3000)
