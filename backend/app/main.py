import stripe
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .config import ROOT_DIR, settings
from fastapi import FastAPI, HTTPException
from .config import settings
from .routes.transaction_retrieval import router as bank_router, run_risk_analysis
import os
from pydantic import BaseModel
from typing import List
from pathlib import Path

import json
stripe.api_key = "sk_test_51T3HZ5CDt5zQWy94vBAuTaaRSBmWx7E90HayLMoiWH2BJyne5aDMqW47HAv7ttGaIwSCuX2pgUXzvnu2HBG1kJmJ0054lHaA9f" # Your Secret Key
DATA_PATH = Path("ingestion/data/payments.json")
# from .database import init_db
from .routes import forecast, health, ingestion, payments, pools, settlements, transaction_retrieval
from fastapi.responses import HTMLResponse
app = FastAPI(title=settings.app_name)
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/user", response_class=HTMLResponse)
async def get_user_portal():
    # Using absolute path prevents "File Not Found" errors during different execution contexts
    current_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(current_dir, "user.html")
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return HTMLResponse(content=content) # 👈 Explicitly wrap the content
    except FileNotFoundError:
        return HTMLResponse(content="<h1>File Not Found</h1><p>Check if user.html is in the same folder as main.py</p>", status_code=404)
    
class RiskRequest(BaseModel):
    worker_id: str
    raw_tink_transactions: List[dict]
class PayoutRequest(BaseModel):
    worker_id: str  # Change user_id to worker_id
    amount_requested: float
@app.post("/risk/analyze")
async def analyze_risk(request: RiskRequest):
    # 1. Run the existing analysis logic
    analysis = run_risk_analysis(request.worker_id, request.raw_tink_transactions)
    
    # 2. Extract values (converting from cents to dollars)
    income_dollars = analysis.get("expected_inflow_minor", 0) / 100
    eligible = income_dollars * 0.4
    risk_band = analysis.get("risk_band", "unknown")

    # 3. Return a full package for the new Dashboard
    return {
        "status": "success",
        "eligible_loan_amount": round(eligible, 2),
        "avg_monthly_income": round(income_dollars, 2),
        "risk_band": risk_band,
        "transactions": request.raw_tink_transactions # Required for the graph
    }

# Mock Stripe Endpoint
class PayoutRequest(BaseModel):
    worker_id: str  # Matches what your JS is sending
    amount_requested: float # Must be a number

@app.post("/create-account-session")
async def create_session():
    try:
        session = stripe.AccountSession.create(
            account="acct_1T3SwQFuc3PY7Adn",
            components={
                "balances": {"enabled": True}, # 👈 This fixes the empty banner
                "payouts": {"enabled": True, "features": {"instant_payouts": True}},
            },
        )
        return {"client_secret": session.client_secret}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/initiate-payout")
async def initiate_payout(request: PayoutRequest):
    # Convert Dollars to Cents
    amount_in_cents = int(round(request.amount_requested * 100))
    
    if amount_in_cents > 50000:
         raise HTTPException(status_code=400, detail="Demo limit exceeded")

    try:
        # 1. Execute the transfer
        transfer = stripe.Transfer.create(
            amount=amount_in_cents,
            currency="eur",
            destination="acct_1T3SwQFuc3PY7Adn",
            description="GigCorp Treasury Payout"
        )

        # 2. Fetch the UPDATED balance for the receipt
        # We look at the destination account's balance
        balance = stripe.Balance.retrieve(stripe_account="acct_1T3SwQFuc3PY7Adn")
        available_amount = balance['available'][0]['amount'] / 100

        return {
            "status": "success", 
            "amount": request.amount_requested, 
            "transfer_id": transfer.id,
            "new_balance": available_amount # Passing the real balance back
        }
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e.user_message))
# @app.on_event("startup")
# def startup_event() -> None:
    # init_db()
frontend_dist_dir = ROOT_DIR / "frontend" / "dist"
frontend_assets_dir = frontend_dist_dir / "assets"
dashboard_file = frontend_dist_dir / "index.html"
if not dashboard_file.exists():
    dashboard_file = frontend_dist_dir / "dashboard.html"

if frontend_assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_assets_dir)), name="assets")

@app.get("/index")
async def serve_dashboard():
    return FileResponse(str(dashboard_file))
app.include_router(health.router)
app.include_router(ingestion.router)
app.include_router(payments.router)
app.include_router(pools.router)
app.include_router(forecast.router)
app.include_router(settlements.router)
app.include_router(transaction_retrieval.router)

