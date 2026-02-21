from fastapi import APIRouter, Query, HTTPException
import requests # We use standard requests instead of httpx

router = APIRouter(tags=["bank"])

# Config
CLIENT_ID = "3a7ea77b47d0441b811e152ae0e0bff5"
CLIENT_SECRET = "3a7ea77b47d0441b811e152ae0e0bff5"
# ENRICHED endpoint to get the "Income" labels
TINK_URL = "https://api.tink.com/data/v2/transactions"

@router.get("/callback")
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
    
    
