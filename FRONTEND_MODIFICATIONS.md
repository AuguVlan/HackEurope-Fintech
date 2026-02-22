# Frontend Modifications: Turkish Lira & Transfer-Based Balances

## Overview
This document describes the modifications made to add Turkish Lira (TRY) support and enable balance calculations based on currency transfers.

## Changes Made

### 1. Frontend Dashboard (React/TypeScript)

#### File: `frontend/src/components/Dashboard.tsx`
- **Added TRY account** to mock ledger state with balance: ₺425,000.00
- Mock data now includes three currencies: USD, EUR, and TRY
- The dashboard will display all three balance cards in the grid

```tsx
const MOCK_LEDGER_STATE = {
  accounts: [
    { currency: 'USD', balance_minor: 2500000, id: 'pool-1' },
    { currency: 'EUR', balance_minor: 1800000, id: 'pool-2' },
    { currency: 'TRY', balance_minor: 42500000, id: 'pool-3' }  // NEW
  ],
  // ...
};
```

#### File: `frontend/src/lib/utils.ts`
- **Added `calculateBalanceFromTransfers()` helper function** that:
  - Calculates net balance changes from executed settlements
  - Handles currency-specific transfers (outflows and inflows)
  - Can be used to sum transfers between any two currencies

```typescript
export const calculateBalanceFromTransfers = (
  currency: string,
  settlements: Array<{ from_currency?: string; to_currency?: string; executed_minor?: number }>
): number => {
  // Returns net balance change from transfers
};
```

### 2. Backend API Enhancements (FastAPI/Python)

#### File: `backend/app/schemas.py`
- **Extended `SettlementResponse`** to include currency information:
  - Added `from_currency?: str` field
  - Added `to_currency?: str` field
  - Allows frontend to track which currencies are involved in transfers

#### File: `backend/app/routes/settlements.py`
- **Updated SQL queries** to join with pools table and include currency data:
  - `GET /settlements` endpoint now returns currency info
  - `POST /settlements/run` endpoint now returns currency info
  - `POST /settlements/{settlement_id}/execute` endpoint now returns currency info

Example updated query:
```sql
SELECT s.*, cf.code AS from_country, ct.code AS to_country,
       pf.currency AS from_currency, pt.currency AS to_currency
FROM settlements s
JOIN countries cf ON cf.id = s.from_country_id
JOIN countries ct ON ct.id = s.to_country_id
LEFT JOIN pools pf ON pf.country_id = s.from_country_id
LEFT JOIN pools pt ON pt.country_id = s.to_country_id
```

#### File: `frontend/src/hooks/api.ts`
- **Updated `SettlementLog` interface** to match backend schema:
  - Added optional `from_currency` field
  - Added optional `to_currency` field

### 3. Currency Support
- Turkish Lira (TRY) now appears alongside USD and EUR
- Uses native JavaScript Intl.NumberFormat API for proper localization
- Automatically formats amounts with Turkish Lira symbol (₺)
- Balance cards display with proper currency symbols:
  - **USD**: $25,000.00
  - **EUR**: €18,000.00
  - **TRY**: ₺425,000.00 (NEW)

## Next Steps: Integration with Real Data

To fully integrate transfer-based balance calculations:

### Option 1: Backend-Driven (Recommended)
1. Modify the ledger state endpoint to calculate balances from settlements
2. Include settlement history in the ledger state response
3. Frontend consumes pre-calculated balances

### Option 2: Frontend-Driven
1. Fetch all settlements via `api.getSettlements()`
2. Use `calculateBalanceFromTransfers()` to compute balances per currency
3. Display computed balances in balance cards

### Example Implementation (Frontend-Driven):
```typescript
const { data: settlements } = useQuery({
  queryKey: ['settlements'],
  queryFn: () => api.getSettlements().then(r => r.data)
});

const calculatedBalances = settlements?.reduce((acc, settlement) => {
  // Calculate for each currency
  return acc;
}, {});
```

## Testing

### Manual Testing Steps:
1. Start backend: `python -m app.main` (port 8000)
2. Start frontend: `npm run dev` (port 5173)
3. Verify three balance cards display (USD, EUR, TRY)
4. Check settlement endpoints include currency data:
   ```bash
   curl http://localhost:8000/settlements
   ```
5. Verify proper currency formatting for each locale

### Browser Console Check:
- Monitor network requests to `/settlements` endpoint
- Verify response includes `from_currency` and `to_currency` fields
- Check that balance cards render without errors

## API Contract Changes

### Settlement Response (Updated)
```json
{
  "id": 1,
  "period": "2026-02",
  "from_country": "COUNTRY_A",
  "to_country": "COUNTRY_B",
  "from_currency": "USD",
  "to_currency": "TRY",
  "base_transfer_minor": 500000,
  "forecast_adjustment_minor": 0,
  "recommended_minor": 500000,
  "executed_minor": 500000,
  "status": "executed",
  "rationale": "Normal settlement",
  "stripe_transfer_id": "tr_123456",
  "created_at": "2026-02-22T10:30:00Z"
}
```

## Files Modified Summary
- ✅ `frontend/src/components/Dashboard.tsx` - Added TRY to mock data
- ✅ `frontend/src/lib/utils.ts` - Added transfer calculation helper
- ✅ `backend/app/schemas.py` - Extended SettlementResponse schema
- ✅ `backend/app/routes/settlements.py` - Updated queries to include currency
- ✅ `frontend/src/hooks/api.ts` - Updated SettlementLog interface

## Notes
- The `formatCurrency()` utility already supported TRY via Intl.NumberFormat
- Changes are backward compatible (currency fields are optional)
- All balance card styling and functionality remains unchanged
- The responsive grid still displays 3 columns on large screens, 2 on medium, 1 on small
