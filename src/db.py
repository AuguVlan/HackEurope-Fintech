"""
Database module for Synthetic Liquidity Ledger
Handles all SQLite operations for pools, FX rates, obligations, and transfers
"""

import sqlite3
from typing import List, Dict, Any, Optional
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "ledger.db"

def init_db() -> None:
    """Initialize database with required tables"""
    execute_query("""
        CREATE TABLE IF NOT EXISTS pools(
            id TEXT PRIMARY KEY,
            country TEXT,
            currency TEXT,
            balance INTEGER
        )
    """)
    
    execute_query("""
        CREATE TABLE IF NOT EXISTS fx_rates(
            currency TEXT PRIMARY KEY,
            usd_per_unit REAL
        )
    """)
    
    execute_query("""
        CREATE TABLE IF NOT EXISTS obligations(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_pool TEXT,
            to_pool TEXT,
            amount_usd_cents INTEGER,
            status TEXT,
            created_at INTEGER
        )
    """)
    
    execute_query("""
        CREATE TABLE IF NOT EXISTS transfers(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_pool TEXT,
            to_pool TEXT,
            amount_minor INTEGER,
            amount_usd_cents INTEGER,
            route TEXT,
            created_at INTEGER
        )
    """)


def execute_query(
    sql: str, 
    params: tuple = (), 
    one: bool = False,
    fetch: bool = True
) -> Optional[Any]:
    """
    Execute a SQL query safely
    
    Args:
        sql: SQL query string
        params: Query parameters
        one: Return single row if True
        fetch: Fetch results if True
    
    Returns:
        Query results or None
    """
    con = sqlite3.connect(str(DB_PATH))
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


def fetch_pool(pool_id: str) -> Optional[Dict[str, Any]]:
    """Fetch a pool by ID"""
    result = execute_query(
        "SELECT * FROM pools WHERE id=?", 
        (pool_id,), 
        one=True
    )
    return dict(result) if result else None


def fetch_all_pools() -> List[Dict[str, Any]]:
    """Fetch all pools"""
    results = execute_query("SELECT * FROM pools")
    return [dict(r) for r in results]


def fetch_fx_rate(currency: str) -> Optional[float]:
    """Fetch FX rate for a currency"""
    result = execute_query(
        "SELECT usd_per_unit FROM fx_rates WHERE currency=?",
        (currency,),
        one=True
    )
    return float(result["usd_per_unit"]) if result else None


def fetch_open_obligations() -> List[Dict[str, Any]]:
    """Fetch all open obligations"""
    results = execute_query(
        "SELECT * FROM obligations WHERE status='OPEN' ORDER BY id DESC LIMIT 100"
    )
    return [dict(r) for r in results]


def fetch_all_obligations() -> List[Dict[str, Any]]:
    """Fetch all obligations"""
    results = execute_query("SELECT * FROM obligations ORDER BY id DESC LIMIT 200")
    return [dict(r) for r in results]


def fetch_recent_transfers(limit: int = 100) -> List[Dict[str, Any]]:
    """Fetch recent transfers"""
    results = execute_query(
        f"SELECT * FROM transfers ORDER BY id DESC LIMIT {limit}"
    )
    return [dict(r) for r in results]


def update_pool_balance(pool_id: str, amount_delta: int) -> None:
    """Update pool balance"""
    execute_query(
        "UPDATE pools SET balance=balance+? WHERE id=?",
        (amount_delta, pool_id),
        fetch=False
    )


def insert_obligation(
    from_pool: str,
    to_pool: str,
    amount_usd_cents: int,
    created_at: int
) -> int:
    """Insert a new obligation, return ID"""
    execute_query(
        """INSERT INTO obligations(from_pool,to_pool,amount_usd_cents,status,created_at)
           VALUES(?,?,?,?,?)""",
        (from_pool, to_pool, amount_usd_cents, "OPEN", created_at),
        fetch=False
    )
    result = execute_query(
        "SELECT last_insert_rowid() as id",
        one=True
    )
    return result["id"] if result else 0


def insert_transfer(
    from_pool: str,
    to_pool: str,
    amount_minor: int,
    amount_usd_cents: int,
    route: str,
    created_at: int
) -> int:
    """Insert a new transfer, return ID"""
    execute_query(
        """INSERT INTO transfers(from_pool,to_pool,amount_minor,amount_usd_cents,route,created_at)
           VALUES(?,?,?,?,?,?)""",
        (from_pool, to_pool, amount_minor, amount_usd_cents, route, created_at),
        fetch=False
    )
    result = execute_query(
        "SELECT last_insert_rowid() as id",
        one=True
    )
    return result["id"] if result else 0


def update_obligations_status(status: str = "SETTLED") -> None:
    """Update all open obligations to a new status"""
    execute_query(
        "UPDATE obligations SET status=? WHERE status='OPEN'",
        (status,),
        fetch=False
    )


def clear_all_data() -> None:
    """Clear all data from tables (for testing/reset)"""
    execute_query("DELETE FROM pools", fetch=False)
    execute_query("DELETE FROM fx_rates", fetch=False)
    execute_query("DELETE FROM obligations", fetch=False)
    execute_query("DELETE FROM transfers", fetch=False)


def seed_sample_data() -> None:
    """Seed database with sample pools and FX rates"""
    clear_all_data()
    
    # Create pools
    execute_query(
        "INSERT INTO pools(id,country,currency,balance) VALUES(?,?,?,?)",
        ("UK_GBP", "UK", "GBP", 5_000_00),
        fetch=False
    )
    execute_query(
        "INSERT INTO pools(id,country,currency,balance) VALUES(?,?,?,?)",
        ("BR_BRL", "BR", "BRL", 10_000_00),
        fetch=False
    )
    execute_query(
        "INSERT INTO pools(id,country,currency,balance) VALUES(?,?,?,?)",
        ("EU_EUR", "EU", "EUR", 8_000_00),
        fetch=False
    )
    
    # Insert FX rates (1 unit of currency = X USD)
    execute_query(
        "INSERT INTO fx_rates(currency,usd_per_unit) VALUES(?,?)",
        ("GBP", 1.25),
        fetch=False
    )
    execute_query(
        "INSERT INTO fx_rates(currency,usd_per_unit) VALUES(?,?)",
        ("BRL", 0.20),
        fetch=False
    )
    execute_query(
        "INSERT INTO fx_rates(currency,usd_per_unit) VALUES(?,?)",
        ("EUR", 1.10),
        fetch=False
    )
