# HackEurope-Fintech

Synthetic Liquidity Ledger – fintech solution for HackEurope (PDF spec). Cross-border liquidity with accounts, journal/postings, obligations, payout queue, and threshold-based settlement.

## Project Structure

```
HackEurope-Fintech/
├── src/                     # Backend (FastAPI)
│   ├── main.py              # API routes + worker/admin endpoints
│   ├── engine.py            # Business logic (payout, settle, topup, metrics)
│   ├── db.py                # SQLite (7 tables: accounts, journal, obligations, etc.)
│   ├── models.py
│   └── config.py
├── frontend/                # React + TypeScript (Worker Portal + Admin Dashboard)
│   ├── src/
│   │   ├── App.tsx          # Tabs: Gig Worker Portal | Company Admin
│   │   ├── WorkerPortal.tsx # Balance, transactions, filters, detail modal
│   │   ├── AdminDashboard.tsx # Cards, obligations, net positions, settle/topup/export
│   │   └── api.ts           # API client
│   └── package.json
├── static/
├── data/                    # ledger.db (git-ignored)
└── README.md
```

## Setup

### 1. Virtual environment
```bash
python -m venv venv
.\venv\Scripts\activate   # Windows
# source venv/bin/activate  # macOS/Linux
```

### 2. Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run
```bash
python -m uvicorn src.main:app --reload
```

API: `http://localhost:8000`  
Docs: `http://localhost:8000/docs`  
Static: `http://localhost:8000/static/`

### 4. Run frontend (Worker Portal + Admin Dashboard)
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`. Backend must be running on port 8000 (CORS enabled).  
- **Gig Worker Portal**: select worker (mocked auth), view balance and transaction history; filters (date, type, search by id); transaction detail modal.  
- **Company Admin**: overview cards (gross open, net if settle, queued count, transactions today); open obligations and net positions tables; all transactions with filters; run settlement (threshold), top up pools, export CSV.

## API (PDF spec)

- **POST /init** – Seed accounts and FX rates
- **POST /payout** – Execute or queue payout (header: `Idempotency-Key: <UUID>`)
- **POST /settle/run** – Settle with threshold (body: `{ "threshold_usd_cents": 0 }`)
- **POST /admin/topup** – Top up account (body: `{ "account_id": "...", "amount_minor": N }`)
- **GET /state** – Accounts, open obligations, queued payouts
- **GET /metrics** – gross_usd_cents_open, net_usd_cents_if_settle_now, queued_count, transactions_today

**Worker portal:** `GET /workers`, `GET /worker/{id}/balance`, `GET /worker/{id}/transactions`, `GET /worker/{id}/summary`  
**Admin:** `GET /admin/transactions`, `GET /admin/obligations/open`, `GET /admin/net_positions`, `GET /admin/export/transactions`

See `API_DOCUMENTATION.md` for full details.

## Dependencies

- FastAPI, Uvicorn, Pydantic (see `requirements.txt`)
