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
- Response:
```json
[
  { "country": "COUNTRY_A", "balance_minor": 10000, "currency": "EUR" },
  { "country": "COUNTRY_B", "balance_minor": 0, "currency": "EUR" }
]
```

### `GET /forecast?country=COUNTRY_A&period=2026-02-P2`
- Response:
```json
{
  "country": "COUNTRY_A",
  "period": "2026-02-P2",
  "expected_inflow_minor": 10000,
  "expected_outflow_minor": 0,
  "net_minor": 10000,
  "confidence": 0.85,
  "method": "moving-average-v1"
}
```

### `POST /settlements/run`
- Headers: `X-Operator-Token`
- Response: proposed settlement object.

### `POST /settlements/{id}/execute`
- Headers: `X-Operator-Token`
- Response: executed settlement object with `stripe_transfer_id`.

### `GET /settlements`
- Response: list of settlement objects ordered by newest first.
