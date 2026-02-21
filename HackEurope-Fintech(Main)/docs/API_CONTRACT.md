# API Contract

Base URL: `http://localhost:8000`

## Authentication

- Sensitive endpoints require header `X-Operator-Token`.
- Payment creation requires `Idempotency-Key`.

## Endpoints

### `GET /health`
- Response: `{ "status": "ok" }`

### `POST /payments`
- Headers: `Idempotency-Key: <key>`
- Note: `country` is currently a legacy storage partition; for platform-ledger flows use `COUNTRY_A`.
- Body:
```json
{
  "country": "COUNTRY_A",
  "company_id": "acme",
  "amount_minor": 10000,
  "currency": "EUR",
  "service_type": "routing"
}
```
- Response:
```json
{
  "id": 1,
  "status": "requires_confirmation",
  "stripe_payment_intent_id": "pi_mock_xxx"
}
```

### `POST /stripe/webhook`
- Body:
```json
{
  "type": "payment_intent.succeeded",
  "data": {
    "object": { "id": "pi_mock_xxx" }
  }
}
```

### `POST /stripe/reconcile`
- Body:
```json
{
  "stripe_payment_intent_id": "pi_mock_xxx",
  "status": "succeeded"
}
```

### `GET /pools`
- Legacy compatibility endpoint.
- Response:
```json
[
  { "country": "COUNTRY_A", "balance_minor": 10000, "currency": "EUR" },
  { "country": "COUNTRY_B", "balance_minor": 0, "currency": "EUR" }
]
```

### `GET /income-signal?company_id=acme&period=2026-02-P2`
- Response:
```json
{
  "company_id": "acme",
  "period": "2026-02-P2",
  "expected_inflow_minor": 10000,
  "expected_outflow_minor": 1200,
  "net_minor": 8800,
  "confidence": 0.82,
  "method": "catboost-underwriting-v1",
  "baseline_income_minor": 10850,
  "current_earnings_minor": 9600,
  "trigger_state": "famine",
  "micro_credit_advance_minor": 1330,
  "auto_repayment_minor": 0,
  "p_default": 0.41,
  "risk_band": "medium",
  "fair_lending_disparate_impact_ratio": 0.92,
  "fair_lending_audit_status": "pass-80-rule"
}
```

### `GET /forecast?country=COUNTRY_A&period=2026-02-P2`
- Legacy compatibility endpoint. Prefer `/income-signal`.
- Response:
```json
{
  "country": "COUNTRY_A",
  "period": "2026-02-P2",
  "expected_inflow_minor": 10000,
  "expected_outflow_minor": 0,
  "net_minor": 10000,
  "confidence": 0.82,
  "method": "catboost-underwriting-v1",
  "baseline_income_minor": 10850,
  "current_earnings_minor": 9600,
  "trigger_state": "famine",
  "micro_credit_advance_minor": 1330,
  "auto_repayment_minor": 0,
  "p_default": 0.41,
  "risk_band": "medium",
  "fair_lending_disparate_impact_ratio": 0.92,
  "fair_lending_audit_status": "pass-80-rule"
}
```

### `POST /settlements/run`
- Legacy compatibility endpoint.
- Headers: `X-Operator-Token`
- Response: proposed settlement object.

### `POST /settlements/{id}/execute`
- Legacy compatibility endpoint.
- Headers: `X-Operator-Token`
- Response: executed settlement object with `stripe_transfer_id`.

### `GET /settlements`
- Legacy compatibility endpoint.
- Response: list of settlement objects ordered by newest first.
