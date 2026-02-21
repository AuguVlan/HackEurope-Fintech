# Demo Script (<= 7 Minutes)

## 0:00 - 0:45 Setup

- Start backend (`uvicorn app.main:app --reload --port 8000`).
- Open frontend `index.html`.
- Show operator token and API base URL.

## 0:45 - 2:00 Create and settle incoming payment

- Create payment for `COUNTRY_A`.
- Show generated payment intent id.
- Simulate Stripe success webhook.
- Refresh pools and show `COUNTRY_A` balance increase.

## 2:00 - 3:30 Forecast-driven settlement

- Load forecast for `COUNTRY_A` and `COUNTRY_B`.
- Explain net signal and confidence.
- Run settlement proposal and show recommended transfer with rationale.

## 3:30 - 5:00 Execute settlement

- Execute the proposed settlement.
- Show updated status = `executed`.
- Show pool rebalance between countries.

## 5:00 - 6:30 Reliability and fallback

- Show `POST /stripe/reconcile` fallback if webhook is unstable.
- Mention idempotency protection on payment creation.

## 6:30 - 7:00 Close

- Recap: payment intake -> pools -> forecast -> settlement proposal -> execution.
