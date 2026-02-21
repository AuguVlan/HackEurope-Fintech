# 📋 Project Reference Card

## Quick Commands

```powershell
# Activate venv
.\venv\Scripts\Activate.ps1

# Start server
.\venv\Scripts\python -m uvicorn src.main:app --reload

# Test endpoints (in another terminal)
curl http://localhost:8000/health
curl http://localhost:8000/state
curl http://localhost:8000/pools

# Stop server: Ctrl+C
```

## API Endpoints Cheatsheet

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | Service info |
| GET | `/health` | Health check |
| GET | `/state` | Full ledger state |
| GET | `/pools` | List pools |
| GET | `/pools/{id}` | Pool details |
| POST | `/transfer` | Execute transfer |
| POST | `/validate` | Validate transfer |
| POST | `/topup` | Add liquidity |
| POST | `/settle` | Settle obligations |
| GET | `/obligations` | List obligations |
| GET | `/transfers` | List transfers |
| POST | `/init` | Reset with sample data |

## Request Templates

### Transfer
```json
{
  "from_pool": "UK_GBP",
  "to_pool": "BR_BRL",
  "amount_minor": 5000
}
```

### Topup
```json
{
  "pool_id": "UK_GBP",
  "amount_minor": 50000
}
```

## Important Files

| File | Purpose |
|------|---------|
| `src/main.py` | API routes (25+ endpoints) |
| `src/ledger.py` | Business logic |
| `src/db.py` | Database operations |
| `src/models.py` | Data validation |
| `src/config.py` | Configuration |
| `API_DOCUMENTATION.md` | Complete API reference |
| `QUICKSTART.md` | Getting started guide |

## Sample Pools

| ID | Country | Currency | Balance | FX Rate |
|----|---------|----------|---------|---------|
| UK_GBP | UK | GBP | £50,000 | 1.25 |
| BR_BRL | Brazil | BRL | ₩100,000 | 0.20 |
| EU_EUR | EU | EUR | €80,000 | 1.10 |

## URLs

- **API Base**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc

## Database

- **Location**: `data/ledger.db`
- **Type**: SQLite 3
- **Tables**: pools, fx_rates, obligations, transfers
- **Auto-created**: Yes (on first run)
- **Reset**: Delete file to start fresh

## Project Structure

```
src/                  Source code
├── main.py          FastAPI app
├── models.py        Pydantic models
├── db.py            Database layer
├── ledger.py        Business logic
├── config.py        Settings
└── logger.py        Logging

data/                 Data directory
└── ledger.db        SQLite database

tests/               Tests directory (ready)
venv/                Virtual environment
```

## Common Tasks

**View server logs**
- Check terminal where server is running

**Check if port 8000 is free**
```powershell
netstat -ano | findstr :8000
```

**Reinstall dependencies**
```powershell
.\venv\Scripts\pip install -r requirements.txt
```

**Deactivate venv**
```powershell
deactivate
```

## Key Features

✅ Synthetic settlement model
✅ FX rate conversion
✅ Net position calculation
✅ Obligation tracking
✅ Transaction audit trail
✅ Type-safe API
✅ Auto-documentation
✅ Sample data included

## Need Help?

1. **API Usage**: See http://localhost:8000/docs
2. **Setup Issues**: See [QUICKSTART.md](QUICKSTART.md)
3. **Architecture**: See [README.md](README.md)
4. **API Details**: See [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
5. **Implementation**: See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

---

**Status**: ✅ Ready to Use | **Version**: 0.1.0
