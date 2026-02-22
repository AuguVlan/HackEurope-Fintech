# Implementation Guide: Transfer-Based Balance Calculations

## Quick Start: Using the New Helper Function

The frontend now has a helper function `calculateBalanceFromTransfers()` that can calculate balances from settlement data.

### Usage Example

```typescript
import { calculateBalanceFromTransfers } from '../lib/utils';

// Get settlements from API
const settlements = await api.getSettlements().then(r => r.data);

// Calculate balances for each currency
const usdBalance = calculateBalanceFromTransfers('USD', settlements);
const eurBalance = calculateBalanceFromTransfers('EUR', settlements);
const tryBalance = calculateBalanceFromTransfers('TRY', settlements);
```

## Integration Points

### In Dashboard Component (Recommended Approach)

```typescript
// 1. Fetch settlements
const { data: settlements, isLoading: settlementsLoading } = useQuery({
  queryKey: ['settlements'],
  queryFn: () => api.getSettlements().then(r => r.data),
  enabled: true, // Always fetch
});

// 2. Calculate balances from transfers
const transferBasedBalances = useMemo(() => {
  if (!settlements) return [];
  
  const currencies = ['USD', 'EUR', 'TRY'];
  return currencies.map(currency => ({
    currency,
    total: calculateBalanceFromTransfers(currency, settlements),
    accounts: 1,
    history: [20, 40, 35, 50], // Mock history
  }));
}, [settlements]);

// 3. Use calculated balances instead of ledgerState
<BalanceGrid 
  data={transferBasedBalances} 
  isLoading={settlementsLoading} 
/>
```

## Backend Integration (Alternative Approach)

### Option: Add endpoint for calculated balances

Create a new endpoint in `backend/app/routes/payments.py` or new `balances.py`:

```python
@router.get("/balances", response_model=list[BalanceResponse])
def get_balances() -> list[BalanceResponse]:
    """Get current balances calculated from all settled transfers"""
    with get_db() as conn:
        # Sum all executed transfers per currency
        rows = conn.execute("""
            SELECT 
                p.currency,
                SUM(p.amount_minor) as total_amount
            FROM pools p
            GROUP BY p.currency
        """).fetchall()
    
    return [
        BalanceResponse(
            currency=row['currency'],
            balance_minor=row['total_amount'],
            calculated_from='transfers'
        )
        for row in rows
    ]
```

## Validation Checklist

- [ ] Three balance cards display on dashboard (USD, EUR, TRY)
- [ ] Turkish Lira shows ₺ symbol correctly
- [ ] Balance amounts display with proper decimal formatting
- [ ] Settlement API endpoint returns `from_currency` and `to_currency` fields
- [ ] No console errors when rendering balance cards
- [ ] Transfer calculations match expected amounts (if using calculation)

## Database Seed Data (Optional)

To test with realistic data, update the database seeding script:

```python
# In backend/app/database.py _seed() function

# Add TRY pool
conn.execute("""
    INSERT INTO pools (country_id, balance_minor, currency)
    SELECT id, 42500000, 'TRY' FROM countries WHERE code = 'COUNTRY_A'
""")

# Add sample settlements
conn.execute("""
    INSERT INTO settlements 
    (period, from_country_id, to_country_id, base_transfer_minor, 
     forecast_adjustment_minor, recommended_minor, executed_minor, status, rationale)
    VALUES 
    (?, ?, ?, 500000, 0, 500000, 500000, 'executed', 'Sample settlement'),
    (?, ?, ?, 1000000, 0, 1000000, 1000000, 'executed', 'Sample settlement')
""")
```

## Files to Monitor for Changes

1. **Settlement Data Structure**: If you modify how settlements are stored, update `_map_settlement_row()` in `settlements.py`

2. **Balance Calculations**: If logic changes, update `calculateBalanceFromTransfers()` in `utils.ts`

3. **API Response**: Always ensure settlement responses include currency fields (see schemas.py)

## Troubleshooting

### TRY Balance Shows $0
- Check that settlements have `executed_minor` value (not NULL)
- Verify `from_currency` and `to_currency` fields are populated
- Ensure seeding includes TRY pools

### Currency Symbol Wrong
- Verify browser locale settings
- Check that Intl.NumberFormat supports the currency code (it should for TRY/EUR/USD)

### Network Errors
- Verify backend is running on port 8000
- Check VITE_API_URL in `.env.local` (should be `http://localhost:8000`)
- Monitor browser network tab in DevTools

## Next Phase: Real Settlement Integration

When ready to connect to real settlement data:

1. Remove or replace `MOCK_LEDGER_STATE` 
2. Enable the `useLedgerState()` query hook
3. Ensure settlement data flows through proper API channels
4. Add error handling for network failures
5. Implement cache invalidation after settlements execute

