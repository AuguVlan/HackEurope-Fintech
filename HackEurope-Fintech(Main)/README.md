# BaaS Hackathon Demo (Python + JS + SQLite)

Demo-ready B2B Banking-as-a-Service ledger for gig platforms, with embedded income smoothing and CatBoost-powered default-risk underwriting.

## Project Structure

- `backend/` FastAPI API, SQLite data layer, business logic, tests.
- `frontend/` static operator dashboard (HTML/CSS/JS).
- `ml/` income smoothing + underwriting notes and synthetic history generator.
- `docs/` architecture, decisions, API contract, demo script.
- `infra/` environment template.

## Quickstart (Local)

1. Create a Python environment and install deps:
   - `cd backend`
   - `python -m venv .venv`
   - `.\.venv\Scripts\activate`
   - `pip install -r requirements.txt`
2. Configure env:
   - copy `infra/.env.example` to `backend/.env`
3. Run API:
   - `uvicorn app.main:app --reload --port 8000`
4. Open frontend:
   - open `frontend/index.html`
   - set API base URL to `http://localhost:8000`
5. (Optional) Reset seeded demo state:
   - `python scripts/reset_demo.py`

## Default Demo Credentials

- Operator token header: `X-Operator-Token: demo-operator-token`
- Currency: `EUR`

## Core Endpoints

- `GET /health`
- `POST /payments` (requires `Idempotency-Key`)
- `POST /stripe/webhook`
- `POST /stripe/reconcile`
- `GET /income-signal?company_id=acme&period=2026-02-P2`
- `GET /forecast?country=COUNTRY_A&period=2026-02-P2` (legacy compatibility path)

Full details: `docs/API_CONTRACT.md`.
