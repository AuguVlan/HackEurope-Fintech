# HackEurope Synthetic Liquidity Ledger

A fintech solution for cross-border liquidity management using synthetic settlement and FX conversion.

## Overview

The Synthetic Liquidity Ledger (SLL) enables fast, efficient cross-border payments by:

1. **Immediate Liquidity Provision**: Destination pools provide immediate liquidity in their local currency
2. **Obligation Tracking**: Source pools incur obligations to settle in USD-denominated amounts
3. **Batch Settlement**: Obligations are settled in net positions to minimize actual fund transfers
4. **Synthetic Routes**: Payments route through liquidity pools rather than direct bank transfers

## Architecture

### Project Structure

```
HackEurope-Fintech/
├── src/
│   ├── __init__.py          # Package initialization
│   ├── main.py              # FastAPI application and routes
│   ├── models.py            # Pydantic data models
│   ├── db.py                # Database operations
│   ├── ledger.py            # Business logic
│   ├── config.py            # Configuration and settings
│   └── logger.py            # Logging setup
├── data/
│   └── ledger.db            # SQLite database (git-ignored)
├── tests/                   # Unit tests directory
├── requirements.txt         # Python dependencies
├── pyproject.toml          # Project metadata
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

### Core Components

#### Database Layer (`db.py`)
- SQLite database with 4 main tables: pools, fx_rates, obligations, transfers
- Safe query execution with parameter binding
- Helper functions for CRUD operations

**Tables:**
- `pools`: Liquidity pools for each country/currency
- `fx_rates`: Exchange rates relative to USD
- `obligations`: Open payment obligations between pools
- `transfers`: Transaction log of all transfers

#### Models (`models.py`)
- Pydantic BaseModels for API validation and serialization
- Request models: TransferRequest, TopupRequest, FXRateRequest
- Response models for all API endpoints

#### Ledger Service (`ledger.py`)
- Core business logic for the synthetic ledger
- Transfer execution with automatic obligation creation
- Settlement computation with net position calculation
- FX conversion utilities

#### Configuration (`config.py`)
- Environment-based settings
- Project paths and directory management
- Feature flags and logging configuration

## API Endpoints

### Health & Info
- `GET /` - Root endpoint with service info
- `GET /health` - Health check

### Ledger State
- `GET /state` - Complete ledger state (pools, obligations, transfers)
- `GET /pools` - List all liquidity pools
- `GET /pools/{pool_id}` - Get pool details with FX rates

### Transfers
- `POST /transfer` - Execute a transfer between pools
- `POST /validate` - Validate a transfer without executing
- `POST /topup` - Add liquidity to a pool

### Settlements
- `POST /settle` - Settle all open obligations
- `GET /obligations` - List open obligations
- `GET /transfers` - List recent transfers

### Admin
- `POST /init` - Initialize database with sample data

## How It Works

### Transfer Flow

1. **Request Transfer**
   ```json
   POST /transfer
   {
     "from_pool": "UK_GBP",
     "to_pool": "BR_BRL",
     "amount_minor": 10000
   }
   ```

2. **System Process**
   - Validates both pools exist
   - Converts amount from source currency to USD cents using FX rates
   - Destination pool immediately pays out the local amount (deducts from balance)
   - Creates obligation: Source pool owes Destination pool in USD cents
   - Logs the transfer for audit trail

3. **Response**
   ```json
   {
     "ok": true,
     "transfer_id": 1,
     "obligation_id": 1,
     "amount_usd_cents": 125000,
     "route": "SYNTHETIC"
   }
   ```

### Settlement Flow

1. **Request Settlement**
   ```
   POST /settle
   ```

2. **System Process**
   - Fetches all open obligations
   - Computes net positions for each pair of pools
   - Eliminates circular flows
   - Marks all obligations as SETTLED

3. **Response**
   ```json
   {
     "ok": true,
     "settlement_count": 3,
     "settlements": [
       {
         "payer": "UK_GBP",
         "payee": "BR_BRL",
         "amount_usd_cents": 250000
       },
       {
         "payer": "EU_EUR",
         "payee": "UK_GBP",
         "amount_usd_cents": 100000
       }
     ]
   }
   ```

## Database Schema

### Pools Table
```sql
CREATE TABLE pools(
    id TEXT PRIMARY KEY,        -- e.g., "UK_GBP"
    country TEXT,               -- e.g., "UK"
    currency TEXT,              -- e.g., "GBP"
    balance INTEGER             -- balance in minor units (cents)
);
```

### FX Rates Table
```sql
CREATE TABLE fx_rates(
    currency TEXT PRIMARY KEY,  -- e.g., "GBP"
    usd_per_unit REAL          -- e.g., 1.25 (1 GBP = $1.25)
);
```

### Obligations Table
```sql
CREATE TABLE obligations(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_pool TEXT,                 -- pool that owes
    to_pool TEXT,                   -- pool that is owed
    amount_usd_cents INTEGER,       -- settlement amount in USD cents
    status TEXT,                    -- "OPEN" or "SETTLED"
    created_at INTEGER              -- Unix timestamp
);
```

### Transfers Table
```sql
CREATE TABLE transfers(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_pool TEXT,                 -- source pool
    to_pool TEXT,                   -- destination pool
    amount_minor INTEGER,           -- amount in source currency minor units
    amount_usd_cents INTEGER,       -- equivalent in USD cents
    route TEXT,                     -- "SYNTHETIC" or other route types
    created_at INTEGER              -- Unix timestamp
);
```

## Setup Instructions

### 1. Create Virtual Environment
```bash
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows PowerShell
source venv/bin/activate      # macOS/Linux
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Application
```bash
.\venv\Scripts\python -m uvicorn src.main:app --reload
```

The API will be available at `http://localhost:8000`

### 4. Access Documentation
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Example Usage

### Initialize with Sample Data
```bash
curl -X POST http://localhost:8000/init
```

### Get Current Ledger State
```bash
curl http://localhost:8000/state
```

### Execute a Transfer
```bash
curl -X POST http://localhost:8000/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "from_pool": "UK_GBP",
    "to_pool": "BR_BRL",
    "amount_minor": 5000
  }'
```

### Validate Transfer
```bash
curl -X POST http://localhost:8000/validate \
  -H "Content-Type: application/json" \
  -d '{
    "from_pool": "UK_GBP",
    "to_pool": "BR_BRL",
    "amount_minor": 5000
  }'
```

### Top Up a Pool
```bash
curl -X POST http://localhost:8000/topup \
  -H "Content-Type: application/json" \
  -d '{
    "pool_id": "UK_GBP",
    "amount_minor": 50000
  }'
```

### Execute Settlement
```bash
curl -X POST http://localhost:8000/settle
```

## Sample Data

The application initializes with:

| Pool ID | Country | Currency | Balance |
|---------|---------|----------|---------|
| UK_GBP | UK | GBP | £50,000.00 |
| BR_BRL | Brazil | BRL | ₩100,000.00 |
| EU_EUR | EU | EUR | €80,000.00 |

FX Rates:
- 1 GBP = $1.25 USD
- 1 BRL = $0.20 USD
- 1 EUR = $1.10 USD

## Configuration

Environment variables (optional):

```bash
DEBUG=True              # Enable debug mode
HOST=0.0.0.0          # Server host
PORT=8000             # Server port
RELOAD=True           # Auto-reload on code changes
LOG_LEVEL=INFO        # Logging level
ENABLE_DEMO_ENDPOINTS=True  # Enable demo endpoints
AUTO_SEED_DATA=True   # Auto-seed on startup
```

## Key Features

✅ **Synthetic Liquidity**: Immediate payment without requiring direct transfers
✅ **FX Conversion**: Automatic currency conversion using live rates
✅ **Obligation Tracking**: Accurate record of all debts and credits
✅ **Net Settlement**: Efficient settlement computation with circular flow elimination
✅ **Audit Trail**: Complete transaction history for compliance
✅ **Type Safety**: Pydantic models for all API contracts
✅ **API Documentation**: Interactive Swagger UI and ReDoc
✅ **Error Handling**: Comprehensive error responses

## Testing

```bash
# Run tests (when test suite is added)
pytest tests/

# Check coverage
pytest --cov=src tests/

# Type checking
mypy src/
```

## Development

The project uses:
- **FastAPI** 0.128.8 - Modern async web framework
- **Pydantic** 2.12.5 - Data validation
- **SQLite** - Embedded database
- **Uvicorn** 0.39.0 - ASGI server

## Future Enhancements

- [ ] Database migrations with Alembic
- [ ] Comprehensive test suite
- [ ] Authentication and authorization
- [ ] Rate limiting and throttling
- [ ] WebSocket support for real-time updates
- [ ] Multi-currency batch processing
- [ ] Machine learning for demand prediction
- [ ] Integration with real payment networks

## License

HackEurope 2026

## Support

For issues or questions, please refer to the API documentation at `/docs`
