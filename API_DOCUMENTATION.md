# HackEurope Synthetic Liquidity Ledger – API (PDF spec)

Cross-border liquidity engine: accounts, journal entries + postings, obligations, payout queue, threshold-based settlement, idempotent payout.

## Overview

- **Accounts** (with `min_buffer_minor`) replace pools; all balance changes go through **journal_entries** and **postings**.
- **Payout**: If destination has liquidity above buffer, execute (journal + posting + obligation); else **queue** in `payout_queue`.
- **Idempotency**: `Idempotency-Key` header (UUID) on `POST /payout` prevents duplicate journal entries.
- **Settlement**: Net obligations by pair; only settle pairs where `abs(net) > threshold_usd_cents`.
- **Metrics**: `GET /metrics` returns gross open, net if settled now, and queued count.

## Architecture

- **db.py** – SQLite, 7 tables: accounts, fx_rates, journal_entries, postings, obligations, settlement_batches, payout_queue.
- **engine.py** – Payout (idempotency, buffer, queue), settle_run, admin_topup, get_state, get_metrics.
- **main.py** – FastAPI routes and static mount at `/static`.

## Database schema (PDF)

- **accounts**(id TEXT PK, kind, country, currency, balance_minor, min_buffer_minor)
- **fx_rates**(currency TEXT PK, usd_per_unit REAL)
- **journal_entries**(id, created_at, type, external_id UNIQUE, metadata_json)
- **postings**(id, entry_id, account_id, direction, amount_minor)
- **obligations**(id, created_at, from_pool, to_pool, amount_usd_cents, status, settlement_batch_id)
- **settlement_batches**(id, created_at, notes)
- **payout_queue**(id, created_at, from_pool, to_pool, amount_minor, status)

## API Endpoints

### Health & info
- **GET /** – Service info and endpoint list
- **GET /health** – Health check

### Ledger
- **GET /state** – Full state: accounts, open_obligations, queued_payouts
- **GET /metrics** – gross_usd_cents_open, net_usd_cents_if_settle_now, queued_count

### Payout
- **POST /payout**  
  Body: `{ "from_pool": "POOL_UK_GBP", "to_pool": "POOL_BR_BRL", "amount_minor": 20000 }`  
  Header: **Idempotency-Key**: `<UUID>`  
  Response: executed (journal_entry_id, obligation_id, amount_usd_cents) or queued (payout_queue_id).

### Settlement
- **POST /settle/run**  
  Body: `{ "threshold_usd_cents": 0 }`  
  Only pairs with abs(net) > threshold are settled; returns settlement_batch_id and settlements list.

### Admin
- **POST /admin/topup**  
  Body: `{ "account_id": "POOL_UK_GBP", "amount_minor": 500000 }`  
  Recorded via journal entry + posting.
- **POST /init** – Clear and seed accounts + FX rates.

### Static
- **GET /static/** – Serves `static/index.html` (links to docs, /state, /metrics).

## Example usage

### Seed and state
```bash
curl -X POST http://localhost:8000/init
curl http://localhost:8000/state
```

### Payout (idempotent)
```bash
curl -X POST http://localhost:8000/payout \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{"from_pool":"POOL_UK_GBP","to_pool":"POOL_BR_BRL","amount_minor":20000}'
```

### Settle
```bash
curl -X POST http://localhost:8000/settle/run \
  -H "Content-Type: application/json" \
  -d '{"threshold_usd_cents":0}'
```

### Top up
```bash
curl -X POST http://localhost:8000/admin/topup \
  -H "Content-Type: application/json" \
  -d '{"account_id":"POOL_UK_GBP","amount_minor":500000}'
```

### Metrics
```bash
curl http://localhost:8000/metrics
```

## Seed data

| Account ID   | Country | Currency | Balance (minor) | Min buffer |
|-------------|---------|----------|-----------------|------------|
| POOL_UK_GBP | UK      | GBP      | 500000          | 1000       |
| POOL_BR_BRL | BR      | BRL      | 1000000         | 1000       |
| POOL_EU_EUR | EU      | EUR      | 800000          | 1000       |

FX: GBP 1.25, BRL 0.20, EUR 1.10 (usd_per_unit).

## Netting (settlement)

For each OPEN obligation: key = sorted(from_pool, to_pool). If obligation direction matches key order, add amount to net[key]; else subtract. For each pair, payer/payee and amount = abs(net). Only pairs with abs(net) > threshold are settled and linked to a new settlement_batch.

## License

HackEurope 2026
