# Demo Script (<= 7 Minutes)

## 0:00 - 0:45 Setup

- Start backend (`uvicorn app.main:app --reload --port 8000`).
- Open frontend `index.html`.
- Show operator token and API base URL.

## 0:45 - 2:00 Ingest alternative earnings data

- Create succeeded payment records for platform `acme`.
- Show generated payment intent id.
- Simulate Stripe success webhook.
- Emphasize this as digital earnings history ingestion.

## 2:00 - 3:45 Income smoothing and underwriting

- Call `GET /income-signal?company_id=acme&period=2026-02-P2`.
- Explain baseline income `B`, famine/feast trigger, and micro-credit advance/repayment.
- Explain CatBoost `p_default` and risk band.
- Show fair-lending disparate impact status.

## 5:00 - 6:30 Reliability and fallback

- Show `POST /stripe/reconcile` fallback if webhook is unstable.
- Mention idempotency protection on payment creation.
- Mention heuristic underwriting fallback if CatBoost/data is unavailable.

## 6:30 - 7:00 Close

- Recap: earnings ingestion -> income smoothing -> CatBoost underwriting -> fair-lending checks.
