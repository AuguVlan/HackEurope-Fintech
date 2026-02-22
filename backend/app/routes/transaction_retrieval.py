from fastapi import APIRouter, Query, HTTPException
import requests
import sqlite3
import datetime
import json
from pathlib import Path
from ..services.forecast import get_income_signal
# Assuming call_fetch_transactions is defined in main.py to read the file


router = APIRouter(tags=["bank"])

# Config
CLIENT_ID = "9fdf4ab283e6476b8726bd845e534852"
CLIENT_SECRET = "3a7ea77b47d0441b811e152ae0e0bff5"
def call_fetch_transactions():
    # 1. Define the path to your specific file
    file_path = Path("ingestion/data/payments.json")
    
    try:
        # 2. Open and load the local file
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # 3. Return the 'transactions' list from that file
        return data.get("transactions", [])
        
    except FileNotFoundError:
        print(f"Error: The file {file_path} was not found.")
        return []
    except json.JSONDecodeError:
        print(f"Error: Failed to decode JSON from {file_path}.")
        return []
    
@router.get("/get-payments")
def read_payments():
    """
    Directly returns the transactions stored in ingestion/data/payments.json
    """
    transactions = call_fetch_transactions()
    return {"status": "success", "data": transactions}

@router.get("/call_fetch_return_all_transactions")
def tink_callback(code: str = Query(...)):
    """
    Original Tink callback modified to use local file data for the analysis pipeline.
    """
    # --- STEP 1: Exchange Code for Token (Kept for flow, though data is local now) ---
    token_res = requests.post(
        "https://api.tink.com/api/v1/oauth/token",
        data={
            "code": code,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "authorization_code",
            "redirect_uri": "http://localhost:8000/user"
        }
    )
    
    if token_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Token Exchange Failed")
    
    # --- STEP 2: Fetch Data from LOCAL FILE instead of Tink URL ---
    # This uses your existing logic but sources from the JSON file
    local_transactions = call_fetch_transactions()
    
    all_transactions = []

    for tx in local_transactions:
        # Mapping local JSON schema (transactionAmount/creditorName) 
        # to the format expected by run_risk_analysis
        try:
            amt_float = float(tx.get("transactionAmount", {}).get("amount", 0))
            
            all_transactions.append({
                "amount": amt_float,
                "desc": tx.get("creditorName", "No description"),
                "date": tx.get("bookingDate")
            })
        except (ValueError, TypeError):
            continue

    # --- STEP 3: Return result ---
    return {
        "user": "Connected (Local Data Mode)",
        "total_txs": len(all_transactions),
        "data": all_transactions
    }

def run_risk_analysis(worker_id: str, raw_transactions: list):
    """
    Takes standardized transactions and runs the forecast income signal engine.
    """
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Schema setup
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

    cursor.execute("""
        CREATE TABLE repayments (
            worker_id TEXT, company_id TEXT, due_date TEXT, 
            due_amount_minor INTEGER, paid_at TEXT, 
            paid_amount_minor INTEGER, status TEXT
        )
    """)

    # 2. Insert data using values from the JSON
    for i, tx in enumerate(raw_transactions):
        # Convert float amount to minor units (cents) for the risk engine
        amt_float = tx.get("amount", 0)
        amt_minor = int(amt_float * 100)
        
        display_name = tx.get("desc", "Unknown")
        
        # Use the date from the JSON if available, otherwise fallback to generated timeline
        if tx.get("date"):
            # Ensure format is YYYY-MM-DD HH:MM:SS
            clean_date = f"{tx.get('date')} 00:00:00"
        else:
            past_date = datetime.datetime.now() - datetime.timedelta(days=i*7)
            clean_date = past_date.strftime('%Y-%m-%d %H:%M:%S')

        # Only insert credits (Income) into the payments table for analysis
        if amt_minor > 0:
            cursor.execute("""
                INSERT INTO payments (amount_minor, company_id, worker_id, country_id, status, created_at)
                VALUES (?, ?, ?, 1, 'succeeded', ?)
            """, (amt_minor, display_name, worker_id, clean_date))

    # 3. Execution
    analysis = get_income_signal(conn, worker_id, period="365d")
    conn.close()
    return analysis