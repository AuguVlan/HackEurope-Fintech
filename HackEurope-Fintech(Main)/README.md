# BaaS Hackathon Demo (Python + JS + SQLite)

Demo-ready platform for 2-country pooling and settlement with Stripe test-mode simulation and forecasting-assisted transfer recommendations.

## Project Structure

- `backend/` FastAPI API, SQLite data layer, business logic, tests.
- `frontend/` static operator dashboard (HTML/CSS/JS).
- `ml/` forecasting notes and baseline script.
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
- Countries: `COUNTRY_A`, `COUNTRY_B`
- Currency: `EUR`

## Core Endpoints

- `GET /health`
- `POST /payments` (requires `Idempotency-Key`)
- `POST /stripe/webhook`
- `POST /stripe/reconcile`
- `GET /pools`
- `GET /forecast?country=COUNTRY_A&period=2026-02-P2`
- `POST /settlements/run`
- `POST /settlements/{id}/execute`
- `GET /settlements`

Full details: `docs/API_CONTRACT.md`.
