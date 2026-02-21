"""
HackEurope Fintech - Synthetic Liquidity Ledger API
FastAPI application for managing cross-border liquidity pools and settlements
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from .db import init_db, seed_sample_data
from .models import (
    TransferRequest,
    TopupRequest,
    FXRateRequest,
    HealthResponse,
    LedgerStateResponse,
    SettlementResponse,
    TransferExecutionResponse,
)
from .ledger import (
    execute_transfer,
    topup_pool,
    settle_obligations,
    get_ledger_state,
    get_pool_info,
    validate_transfer,
)
from .ingestion.router import router as ingestion_router

__version__ = "0.1.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events"""
    # Startup
    init_db()
    seed_sample_data()
    print("✓ Database initialized and seeded with sample data")
    yield
    # Shutdown
    print("✓ Application shutdown")


app = FastAPI(
    title="HackEurope Synthetic Liquidity Ledger",
    description="Fintech API for cross-border liquidity management and synthetic settlements",
    version=__version__,
    lifespan=lifespan,
)

# Mount Component 1 – Data Ingestion & Normalization pipeline
app.include_router(ingestion_router)


# ============================================================================
# Health & Info Endpoints
# ============================================================================

@app.get("/", tags=["info"])
async def root():
    """API root endpoint"""
    return {
        "service": "HackEurope Synthetic Liquidity Ledger",
        "version": __version__,
        "docs": "/docs",
        "endpoints": {
            "health": "/health",
            "state": "/state",
            "pools": "/pools",
            "transfer": "/transfer",
            "topup": "/topup",
            "validate": "/validate",
            "settle": "/settle",
            "init": "/init"
        }
    }


@app.get("/health", tags=["info"], response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": __version__
    }


# ============================================================================
# Ledger State Endpoints
# ============================================================================

@app.get("/state", tags=["ledger"], response_model=LedgerStateResponse)
async def get_state():
    """Get complete ledger state including pools, obligations, and transfers"""
    try:
        state = get_ledger_state()
        return LedgerStateResponse(
            pools=state["pools"],
            open_obligations=state["open_obligations"],
            transfers=state["transfers"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching ledger state: {str(e)}")


@app.get("/pools", tags=["pools"])
async def list_pools():
    """List all liquidity pools"""
    try:
        state = get_ledger_state()
        return {
            "count": len(state["pools"]),
            "pools": state["pools"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching pools: {str(e)}")


@app.get("/pools/{pool_id}", tags=["pools"])
async def get_pool_details(pool_id: str):
    """Get detailed information about a specific pool"""
    return get_pool_info(pool_id)


# ============================================================================
# Transfer & Settlement Endpoints
# ============================================================================

@app.post("/transfer", tags=["transfers"], response_model=TransferExecutionResponse)
async def initiate_transfer(request: TransferRequest):
    """
    Execute a transfer between two pools
    
    The destination pool immediately pays out the local amount (if they have liquidity).
    The source pool incurs an obligation to settle in USD cents.
    """
    try:
        result = execute_transfer(
            request.from_pool,
            request.to_pool,
            request.amount_minor
        )
        return TransferExecutionResponse(
            ok=result["ok"],
            transfer_id=result.get("transfer_id"),
            amount_usd_cents=result["amount_usd_cents"],
            route=result["route"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transfer failed: {str(e)}")


@app.post("/validate", tags=["transfers"])
async def validate_transfer_endpoint(request: TransferRequest):
    """
    Validate a transfer without executing it
    
    Returns information about fees, FX rates, and whether the transfer can be executed
    """
    return validate_transfer(
        request.from_pool,
        request.to_pool,
        request.amount_minor
    )


@app.post("/settle", tags=["settlements"], response_model=SettlementResponse)
async def initiate_settlement():
    """
    Settle all open obligations
    
    Computes net positions for each pair of pools and returns settlement instructions.
    All open obligations are marked as SETTLED.
    """
    try:
        result = settle_obligations()
        return SettlementResponse(
            ok=result["ok"],
            settlements=result["settlements"],
            message=f"Settled {result['settlement_count']} net positions"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Settlement failed: {str(e)}")


# ============================================================================
# Pool Management Endpoints
# ============================================================================

@app.post("/topup", tags=["pools"])
async def pool_topup(request: TopupRequest):
    """Add liquidity to a pool"""
    return topup_pool(request.pool_id, request.amount_minor)


# ============================================================================
# Admin Endpoints
# ============================================================================

@app.post("/init", tags=["admin"])
async def init_ledger():
    """
    Initialize ledger with sample data (for testing/demo)
    
    Clears all existing data and seeds with sample pools and FX rates
    """
    try:
        seed_sample_data()
        state = get_ledger_state()
        return {
            "ok": True,
            "message": "Ledger reinitialized with sample data",
            "pools_count": len(state["pools"]),
            "obligations_count": len(state["open_obligations"]),
            "transfers_count": len(state["transfers"])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Initialization failed: {str(e)}")


@app.get("/obligations", tags=["admin"])
async def list_obligations():
    """List all open obligations"""
    try:
        state = get_ledger_state()
        return {
            "count": len(state["open_obligations"]),
            "obligations": state["open_obligations"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching obligations: {str(e)}")


@app.get("/transfers", tags=["admin"])
async def list_transfers():
    """List recent transfers"""
    try:
        state = get_ledger_state()
        return {
            "count": len(state["transfers"]),
            "transfers": state["transfers"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching transfers: {str(e)}")


# ============================================================================
# Error Handlers
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Custom HTTP exception handler"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
