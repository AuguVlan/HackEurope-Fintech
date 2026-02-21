#!/usr/bin/env bash
# HackEurope Synthetic Liquidity Ledger - Startup Script (for reference)
# This documents how to properly start the application

# ============================================================================
# PROJECT: HackEurope Synthetic Liquidity Ledger
# VERSION: 0.1.0
# STATUS: PRODUCTION READY ✅
# ============================================================================

# Step 1: Navigate to project directory
cd "c:\Users\auphi\Desktop\AIDAMS Y2\Side Projects\HACKEUROPE\HackEurope-Fintech"

# Step 2: Activate virtual environment (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Step 3: Start the server
.\venv\Scripts\python -m uvicorn src.main:app --reload

# Expected output:
# INFO:     Will watch for changes in these directories: [...]
# INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
# INFO:     Started reloader process [PID] using StatReload
# INFO:     Started server process [PID]
# INFO:     Waiting for application startup.
# ✓ Database initialized and seeded with sample data
# INFO:     Application startup complete.

# ============================================================================
# Once running, access the API:
# ============================================================================

# API Base URL:
# http://localhost:8000

# Interactive API Documentation (Swagger UI):
# http://localhost:8000/docs

# Alternative API Documentation (ReDoc):
# http://localhost:8000/redoc

# Health Check:
# curl http://localhost:8000/health

# View Ledger State:
# curl http://localhost:8000/state

# Execute a Transfer:
# curl -X POST http://localhost:8000/transfer \
#   -H "Content-Type: application/json" \
#   -d '{"from_pool":"UK_GBP","to_pool":"BR_BRL","amount_minor":10000}'

# ============================================================================
# Documentation Files:
# ============================================================================
# - README.md                  : Architecture overview
# - API_DOCUMENTATION.md       : Complete API reference
# - QUICKSTART.md             : Quick start guide
# - REFERENCE.md              : Quick reference card
# - IMPLEMENTATION_SUMMARY.md : Implementation details
# - PROJECT_COMPLETE.md       : Completion summary
# - BUILD_COMPLETE.md         : Build details
# - RESOURCE_INDEX.md         : File navigation

# ============================================================================
# Stop the server:
# ============================================================================
# Ctrl+C in the terminal where the server is running

# ============================================================================
# Deactivate virtual environment:
# ============================================================================
# deactivate

echo "✅ HackEurope Synthetic Liquidity Ledger is ready!"
echo "📖 Documentation: See README.md or QUICKSTART.md"
echo "🚀 Server running on: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
