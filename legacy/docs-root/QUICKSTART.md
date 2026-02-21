# Quick Start Guide - Synthetic Liquidity Ledger

## Starting the Server

1. **Activate Virtual Environment**
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```

2. **Start the Development Server**
   ```powershell
   .\venv\Scripts\python -m uvicorn src.main:app --reload
   ```

   The server will start on `http://localhost:8000`

3. **View Interactive API Documentation**
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

## Key Endpoints

### Test the Service

```powershell
# Health check
curl http://localhost:8000/health

# Get current ledger state
curl http://localhost:8000/state

# List all pools
curl http://localhost:8000/pools
```

### Execute a Transfer

```powershell
$body = @{
    from_pool = "UK_GBP"
    to_pool = "BR_BRL"
    amount_minor = 5000
} | ConvertTo-Json

curl -X POST `
  -H "Content-Type: application/json" `
  -Body $body `
  http://localhost:8000/transfer
```

### Settlement

```powershell
# Execute settlement
curl -X POST http://localhost:8000/settle

# View current obligations
curl http://localhost:8000/obligations
```

## Project Structure

```
src/
├── main.py          # API routes and FastAPI app
├── models.py        # Data models and validation
├── db.py            # Database operations
├── ledger.py        # Business logic
├── config.py        # Configuration
└── logger.py        # Logging setup

data/
└── ledger.db        # SQLite database (auto-created)
```

## Sample Data

Pre-loaded pools:
- **UK_GBP**: UK British Pounds (£50,000.00)
- **BR_BRL**: Brazilian Real (₩100,000.00)
- **EU_EUR**: Euro (€80,000.00)

FX Rates:
- 1 GBP = $1.25 USD
- 1 BRL = $0.20 USD
- 1 EUR = $1.10 USD

## Common Tasks

### Add liquidity to a pool
```powershell
curl -X POST `
  -H "Content-Type: application/json" `
  -Body '{"pool_id": "UK_GBP", "amount_minor": 50000}' `
  http://localhost:8000/topup
```

### Validate a transfer (without executing)
```powershell
curl -X POST `
  -H "Content-Type: application/json" `
  -Body '{"from_pool": "UK_GBP", "to_pool": "BR_BRL", "amount_minor": 10000}' `
  http://localhost:8000/validate
```

### Reset database with fresh sample data
```powershell
curl -X POST http://localhost:8000/init
```

## Troubleshooting

**Server won't start:**
- Verify venv is activated: `(venv)` should appear in prompt
- Check if port 8000 is already in use
- Reinstall dependencies: `.\venv\Scripts\pip install -r requirements.txt`

**API calls not working:**
- Ensure server is running (check terminal output)
- Verify endpoint path is correct
- Check Content-Type header is `application/json`

**Database issues:**
- Delete `data/ledger.db` to reset (will be recreated)
- Check `logs/app.log` for error messages

## Next Steps

1. Open http://localhost:8000/docs to explore all endpoints
2. Try the examples above to understand the flow
3. Check [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for detailed specs
4. Review [README.md](README.md) for architecture overview

## Helpful Commands

```powershell
# View available Python packages
.\venv\Scripts\pip list

# Update a package
.\venv\Scripts\pip install --upgrade fastapi

# Deactivate virtual environment
deactivate
```
