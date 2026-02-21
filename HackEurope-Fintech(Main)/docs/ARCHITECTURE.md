# Architecture

## Components

- Frontend (`frontend/`): operator dashboard for payment ingestion and underwriting signal monitoring.
- Backend (`backend/app/`): FastAPI REST API with business logic for payment ingestion, income smoothing, and CatBoost underwriting.
- Database (`SQLite`): single-file storage for payments and supporting ledger entities.
- ML module (`ml/`): income-smoothing baseline (`B`), famine/feast trigger logic, and CatBoost default underwriting (`p_default`) with heuristic fallback.

## Data Flow

1. Operator submits payment from UI to `POST /payments`.
2. Backend creates payment + Stripe payment intent reference (mock/live placeholder).
3. Webhook (`/stripe/webhook`) marks payment succeeded.
4. Successful payment is recorded as alternative earnings data.
5. Operator requests `GET /income-signal?company_id=...`.
6. Engine computes baseline income `B`, famine/feast triggers, and micro-credit advance/repayment amounts.
7. CatBoost underwriting estimates `p_default` and assigns risk band.
8. Fair-lending audit computes disparate impact status.

## Constraints

- Single currency (`EUR`) for MVP.
- Current storage schema still contains legacy country/pool/settlement tables for backward compatibility.
