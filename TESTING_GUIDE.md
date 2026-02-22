# Quick Testing Guide

## 1. Start the Backend

```bash
cd C:\\Users\\auphi\\Desktop\\AIDAMS\\ Y2\\Side\\ Projects\\HACKEUROPE\\HackEurope-Fintech\\backend

# If you have a virtual environment
source venv/bin/activate  # Linux/Mac
# or
.venv\\Scripts\\Activate.ps1  # Windows PowerShell

# Run the backend
python -m app.main
```

Expected output:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

## 2. Test Settlement API Endpoints

### In a new terminal:

```bash
# Test GET /settlements endpoint
curl http://localhost:8000/settlements | jq .

# Expected response includes NEW fields:
# {
#   "from_currency": "USD",
#   "to_currency": "TRY",
#   ...
# }
```

Or in PowerShell:
```powershell
# Get settlements
$response = Invoke-WebRequest -Uri "http://localhost:8000/settlements" -UseBasicParsing
$response.Content | ConvertFrom-Json | Format-List

# Filter to see just currency fields
$response.Content | ConvertFrom-Json | Select-Object -Property from_currency, to_currency
```

## 3. Start the Frontend

### In a new terminal:

```bash
cd C:\\Users\\auphi\\Desktop\\AIDAMS\\ Y2\\Side\\ Projects\\HACKEUROPE\\HackEurope-Fintech\\frontend

# Install dependencies (if not done)
npm install

# Start dev server
npm run dev
```

Expected output:
```
  VITE v4.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

## 4. Visual Verification in Browser

1. Open http://localhost:5173/ in your browser
2. Look for the Ledger Dashboard
3. Verify you see THREE balance cards:

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  USD Balance     │  │  EUR Balance     │  │  TRY Balance     │ ✨
│  $25,000.00      │  │  €18,000.00      │  │  ₺425,000.00     │
│  ↑ 100%          │  │  ↑ 100%          │  │  ↑ 100%          │
│  1 Linked Acct   │  │  1 Linked Acct   │  │  1 Linked Acct   │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

## 5. Developer Tools Inspection

### Open Browser DevTools (F12):

1. **Network Tab**:
   - Look for requests to `http://localhost:8000/settlements`
   - Click on the request
   - Check the Response tab
   - Verify `from_currency` and `to_currency` fields are present

2. **Console Tab**:
   - No TypeScript errors should appear
   - Look for any currency formatting errors
   - Check that React Query queries succeed

3. **Application Tab**:
   - Verify VITE_API_URL environment variable
   - Check localStorage for any cached data

## 6. Quick Smoke Tests

### Test 1: Currency Symbols Display Correctly
```
✅ PASS: USD shows $ symbol
✅ PASS: EUR shows € symbol  
✅ PASS: TRY shows ₺ symbol (NEW)
```

### Test 2: Balance Numbers Format Correctly
```
✅ PASS: $25,000.00 (USD formatting)
✅ PASS: €18,000.00 (EUR formatting)
✅ PASS: ₺425,000.00 (TRY formatting - NEW)
```

### Test 3: API Returns Currency Fields
```bash
curl http://localhost:8000/settlements | jq '.[0] | {from_currency, to_currency}'
# Expected output:
# {
#   "from_currency": "USD",
#   "to_currency": "TRY"
# }
```

### Test 4: No Console Errors
```
Open DevTools Console (F12)
✅ PASS: No red errors
✅ PASS: No TypeScript warnings
✅ PASS: React Query queries succeed
```

## 7. TypeScript Compilation Check

```bash
cd frontend

# Check for type errors
npx tsc --noEmit

# Should complete without errors related to:
# - SettlementLog interface
# - calculateBalanceFromTransfers function
# - Dashboard component
```

## 8. Test the Helper Function Directly

In browser console:
```javascript
// Example usage
const settlements = [
  {
    from_currency: "USD",
    to_currency: "TRY",
    executed_minor: 500000
  },
  {
    from_currency: "TRY",
    to_currency: "EUR",
    executed_minor: 100000
  }
];

// Import from your codebase and test
calculateBalanceFromTransfers('TRY', settlements)
// Expected: 400000 (500k in - 100k out)
```

## 9. Full Integration Test

```bash
# Terminal 1: Backend
cd backend && python -m app.main

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Test API
curl -X GET http://localhost:8000/settlements | jq '.[] | {from_currency, to_currency, executed_minor}' | head -20

# Terminal 4: Open Browser
# Navigate to http://localhost:5173/
# Verify dashboard displays all 3 currencies
# Open DevTools to verify no errors
```

## 10. Troubleshooting Commands

### If Turkish Lira symbol doesn't display:
```javascript
// In browser console
new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'TRY'
}).format(425000)
// Should output: ₺425,000.00
```

### If API returns undefined currencies:
```bash
# Check database has pools with currency data
sqlite3 app.db "SELECT id, country_id, currency FROM pools;"

# Should show:
# 1|1|USD
# 2|2|EUR
# 3|1|TRY  (if seeded)
```

### If CORS error occurs:
```
Check that VITE_API_URL is set correctly:
- Should be: http://localhost:8000
- Check .env.local file in frontend directory
```

### If npm dependencies fail:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

## 11. Performance Check

```bash
# Measure API response time
time curl http://localhost:8000/settlements > /dev/null

# Should complete in < 100ms

# Check frontend build size
cd frontend
npm run build
du -sh dist/

# Typical: ~200-300KB gzipped
```

## 12. Database Reset (if needed)

```bash
# If you need to reset the database to start fresh
cd backend

# Option 1: Delete and reinit
rm app.db
python -c "from app.database import init_db; init_db()"

# Option 2: Check current data
sqlite3 app.db "SELECT * FROM pools LIMIT 5;"
sqlite3 app.db "SELECT * FROM settlements LIMIT 5;"
```

## Success Criteria Checklist

- [ ] Backend runs without errors on port 8000
- [ ] Frontend runs without errors on port 5173
- [ ] Dashboard displays 3 balance cards (USD, EUR, TRY)
- [ ] Turkish Lira symbol (₺) displays correctly
- [ ] API `/settlements` endpoint returns `from_currency` and `to_currency` fields
- [ ] Browser console has no errors or warnings
- [ ] Network requests complete successfully (200 status)
- [ ] Balance formatting is correct for all currencies

## Quick Reference Commands

```bash
# All in one: Start everything
# Terminal 1
cd backend && python -m app.main

# Terminal 2
cd frontend && npm run dev

# Terminal 3 (Testing)
curl http://localhost:8000/settlements | jq '.[0]'

# Open browser
# http://localhost:5173
```

## Useful Resources

- Frontend: http://localhost:5173/
- Backend API: http://localhost:8000/
- API Docs (Swagger): http://localhost:8000/docs
- API Docs (ReDoc): http://localhost:8000/redoc
- Node version: `node --version` (should be 16+)
- Python version: `python --version` (should be 3.8+)

