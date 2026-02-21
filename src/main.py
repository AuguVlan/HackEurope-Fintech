"""
HackEurope Fintech - Synthetic Liquidity Ledger API (PDF spec)
FastAPI application for cross-border liquidity, journal/postings, and settlement.
"""

from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
import csv
import io
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .config import PROJECT_ROOT
from .db import init_db, seed_sample_data, fetch_all_accounts
from .models import (
    PayoutRequest,
    SettleRunRequest,
    AdminTopupRequest,
    LedgerStateResponse,
    MetricsResponse,
    PayoutResponse,
    SettleRunResponse,
    AdminTopupResponse,
    HealthResponse,
    AccountResponse,
    ObligationResponse,
    PayoutQueueItemResponse,
)
from .engine import (
    payout,
    settle_run,
    admin_topup,
    get_state,
    get_metrics,
    get_worker_balance,
    get_worker_transactions,
    get_worker_summary,
    get_admin_transactions,
    get_net_positions,
)

__version__ = "0.1.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    init_db()
    seed_sample_data()
    print("✓ Database initialized and seeded with sample data")
    yield
    print("✓ Application shutdown")


app = FastAPI(
    title="HackEurope Synthetic Liquidity Ledger",
    description="Fintech API for cross-border liquidity management (PDF spec): payout, settle/run, admin/topup, state, metrics",
    version=__version__,
    lifespan=lifespan,
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (PDF: /static with index.html)
STATIC_DIR = PROJECT_ROOT / "static"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# ============================================================================
# Health & Info
# ============================================================================

@app.get("/", tags=["info"])
async def root():
    """API root."""
    return {
        "service": "HackEurope Synthetic Liquidity Ledger",
        "version": __version__,
        "docs": "/docs",
        "endpoints": {
            "health": "/health",
            "state": "/state",
            "metrics": "/metrics",
            "payout": "POST /payout",
            "settle": "POST /settle/run",
            "admin_topup": "POST /admin/topup",
            "init": "POST /init",
        },
    }


@app.get("/health", tags=["info"], response_model=HealthResponse)
async def health():
    """Health check."""
    return {"status": "healthy", "version": __version__}


# ============================================================================
# PDF API: Ledger state & metrics
# ============================================================================

@app.get("/state", tags=["ledger"], response_model=LedgerStateResponse)
async def state():
    """Get full ledger state: accounts, open obligations, queued payouts."""
    try:
        s = get_state()
        return LedgerStateResponse(
            accounts=[AccountResponse(**a) for a in s["accounts"]],
            open_obligations=[ObligationResponse(**o) for o in s["open_obligations"]],
            queued_payouts=[PayoutQueueItemResponse(**q) for q in s["queued_payouts"]],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/metrics", tags=["ledger"], response_model=MetricsResponse)
async def metrics():
    """Get metrics: gross_usd_cents_open, net_usd_cents_if_settle_now, queued_count."""
    try:
        return MetricsResponse(**get_metrics())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PDF API: Payout (with Idempotency-Key)
# ============================================================================

@app.post("/payout", tags=["payout"], response_model=PayoutResponse)
async def post_payout(
    request: PayoutRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    """
    Execute or queue a payout. Header Idempotency-Key (UUID) makes the call idempotent.
    """
    try:
        result = payout(
            request.from_pool,
            request.to_pool,
            request.amount_minor,
            external_id=idempotency_key,
        )
        return PayoutResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PDF API: Settle / Admin
# ============================================================================

@app.post("/settle/run", tags=["settlements"], response_model=SettleRunResponse)
async def post_settle_run(request: SettleRunRequest):
    """Settle open obligations; only pairs with abs(net) > threshold_usd_cents."""
    try:
        result = settle_run(request.threshold_usd_cents)
        return SettleRunResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/topup", tags=["admin"], response_model=AdminTopupResponse)
async def post_admin_topup(request: AdminTopupRequest):
    """Top up an account (recorded via journal + posting)."""
    try:
        result = admin_topup(request.account_id, request.amount_minor)
        return AdminTopupResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/init", tags=["admin"])
async def init_ledger():
    """Seed accounts and FX rates (clears existing data)."""
    try:
        seed_sample_data()
        s = get_state()
        return {
            "ok": True,
            "message": "Ledger reinitialized with sample data",
            "accounts_count": len(s["accounts"]),
            "open_obligations_count": len(s["open_obligations"]),
            "queued_payouts_count": len(s["queued_payouts"]),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Worker portal (gig workers)
# ============================================================================

@app.get("/worker/{worker_id}/balance", tags=["worker"])
async def worker_balance(worker_id: str):
    """Get worker balance (balance_minor, currency)."""
    try:
        return get_worker_balance(worker_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/worker/{worker_id}/transactions", tags=["worker"])
async def worker_transactions(
    worker_id: str,
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    from_ts: Optional[int] = Query(None),
    to_ts: Optional[int] = Query(None),
    transaction_type: Optional[str] = Query(None, alias="type"),
):
    """Get transaction history for worker. Filters: from_ts, to_ts, type."""
    try:
        return get_worker_transactions(
            worker_id,
            limit=limit,
            offset=offset,
            from_ts=from_ts,
            to_ts=to_ts,
            type_filter=transaction_type,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/worker/{worker_id}/summary", tags=["worker"])
async def worker_summary(worker_id: str):
    """Get worker summary: balance + transaction count."""
    try:
        return get_worker_summary(worker_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/workers", tags=["worker"])
async def list_workers():
    """List worker account ids (for dropdown)."""
    try:
        accounts = fetch_all_accounts()
        workers = [a for a in accounts if (a.get("kind") or "").strip().upper() == "WORKER"]
        return {"workers": [{"id": str(w["id"]), "country": w.get("country"), "currency": w.get("currency")} for w in workers]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list workers: {e}")


# ============================================================================
# Admin dashboard
# ============================================================================

@app.get("/admin/transactions", tags=["admin"])
async def admin_transactions(
    limit: int = Query(200, le=500),
    offset: int = Query(0, ge=0),
    from_ts: Optional[int] = Query(None),
    to_ts: Optional[int] = Query(None),
    transaction_type: Optional[str] = Query(None, alias="type"),
    currency: Optional[str] = Query(None),
):
    """All transactions (journal entries + postings) with optional filters."""
    try:
        return get_admin_transactions(
            limit=limit,
            offset=offset,
            from_ts=from_ts,
            to_ts=to_ts,
            type_filter=transaction_type,
            account_currency=currency,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/obligations/open", tags=["admin"])
async def admin_obligations_open():
    """Open obligations (for admin view)."""
    try:
        s = get_state()
        return {"obligations": s["open_obligations"], "count": len(s["open_obligations"])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/net_positions", tags=["admin"])
async def admin_net_positions():
    """Net positions per pool pair from open obligations."""
    try:
        return {"net_positions": get_net_positions()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/export/transactions", tags=["admin"])
async def admin_export_transactions(
    from_ts: Optional[int] = Query(None),
    to_ts: Optional[int] = Query(None),
    transaction_type: Optional[str] = Query(None, alias="type"),
    currency: Optional[str] = Query(None),
):
    """Export transactions as CSV."""
    try:
        rows = get_admin_transactions(
            limit=5000,
            offset=0,
            from_ts=from_ts,
            to_ts=to_ts,
            type_filter=transaction_type,
            account_currency=currency,
        )
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["id", "posting_id", "type", "account_id", "direction", "amount_minor", "created_at", "metadata_json", "external_id"])
        for r in rows:
            w.writerow([
                r.get("id"),
                r.get("posting_id"),
                r.get("type"),
                r.get("account_id"),
                r.get("direction"),
                r.get("amount_minor"),
                r.get("created_at"),
                r.get("metadata_json"),
                r.get("external_id"),
            ])
        return Response(content=buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=transactions.csv"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Error handler
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
