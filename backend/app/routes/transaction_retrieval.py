from fastapi import APIRouter, Query, HTTPException
import requests # We use standard requests instead of httpx
from ..services.forecast import get_income_signal
import sqlite3
router = APIRouter(tags=["bank"])

# Config
CLIENT_ID = "3a7ea77b47d0441b811e152ae0e0bff5"
CLIENT_SECRET = "3a7ea77b47d0441b811e152ae0e0bff5"
# ENRICHED endpoint to get the "Income" labels
TINK_URL = "https://api.tink.com/data/v2/transactions"

@router.get("/call_fetch_return_all_transactions")
def tink_callback(code: str = Query(...)):
    """
    One single call flow: 
    1. Exchange Code -> 2. Fetch All Pages -> 3. Return Everything
    """
    # --- STEP 1: Exchange Code for Token ---
    token_res = requests.post(
        "https://api.tink.com/api/v1/oauth/token",
        data={
            "code": code,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "authorization_code",
        }
    )
    
    if token_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Token Exchange Failed")
    
    token = token_res.json()["access_token"]

    # --- STEP 2: Fetch Data (Linear Loop) ---
    all_transactions = []
    next_token = None
    
    # We use a simple while loop without any async/await
    while True:
        params = {"pageSize": 100}
        if next_token:
            params["pageToken"] = next_token

        res = requests.get(
            TINK_URL,
            headers={"Authorization": f"Bearer {token}"},
            params=params
        )
        
        data = res.json()
        
        for tx in data.get("transactions", []):
            # Scale 2 math: 800489 -> 8004.89
            val = tx["amount"]["value"]
            amt = int(val["unscaledValue"]) / (10 ** int(val.get("scale", 0)))
            
            # Capture the enrichment (Categorization)
            cat = tx.get("enrichment", {}).get("categorization", {}).get("category", {})
            
            all_transactions.append({
                "amount": amt,
                "category": cat.get("id"), # "income:other"
                "desc": tx["descriptions"]["display"],
                "type": tx.get("transactionType"), # CREDIT (Income)
                "date": tx["dates"]["booked"]
            })

        next_token = data.get("nextPageToken")
        if not next_token:
            break

    # --- STEP 3: Return the result ---
    return {
        "user": "Connected",
        "total_txs": len(all_transactions),
        "data": all_transactions
    }
    
def run_risk_analysis(worker_id: str, raw_tink_transactions: list):
    """
    Bridges the raw Tink JSON to the SQLite-based Risk Engine.
    """
    # 1. Initialize In-Memory DB
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 2. Create Schema expected by risk_engine.py
    cursor.execute("""
        CREATE TABLE payments (
            amount_minor INTEGER, 
            company_id TEXT, 
            worker_id TEXT, 
            country_id INTEGER,
            status TEXT, 
            created_at TEXT
        )
    """)
    # (Optional) Create repayments table if you have that data
    cursor.execute("""
        CREATE TABLE repayments (
            worker_id TEXT, company_id TEXT, due_date TEXT, 
            due_amount_minor INTEGER, paid_at TEXT, 
            paid_amount_minor INTEGER, status TEXT
        )
    """)

    # 3. Map Tink Data to SQLite Rows
    for tx in raw_tink_transactions:
        # Use unscaledValue directly for 'minor' units (e.g., 797212)
        amt_minor = int(tx["amount"]["value"]["unscaledValue"])
        
        # Logic: Since there are no negative values, we identify income by keywords
        # or by the 'CREDIT' type if Tink provides it.
        display_name = tx["descriptions"]["display"]
        is_income = any(word in display_name.lower() for word in ["upwork", "acompt", "salary", "virement"])

        if is_income:
            cursor.execute("""
                INSERT INTO payments (amount_minor, company_id, worker_id, country_id, status, created_at)
                VALUES (?, ?, ?, 1, 'succeeded', ?)
            """, (amt_minor, display_name, worker_id, tx["dates"]["booked"]))

    # 4. Invoke the Risk Engine
    # This calls the logic from your first file
    analysis = get_income_signal(conn, worker_id, period="30d")
    
    conn.close()
    return analysis
