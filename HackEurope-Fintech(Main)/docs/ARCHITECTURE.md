# Architecture

## Components

- Frontend (`frontend/`): operator dashboard for payment creation, webhook simulation, pool/forecast/settlement monitoring.
- Backend (`backend/app/`): FastAPI REST API with business logic for payments, pools, forecast, settlements, and Stripe simulation.
- Database (`SQLite`): single-file storage for countries, pools, payments, settlements.
- ML module (`ml/`): CatBoost-based forecast with moving-average fallback used by settlement logic.

## Data Flow

1. Operator submits payment from UI to `POST /payments`.
2. Backend creates payment + Stripe payment intent reference (mock/live placeholder).
3. Webhook (`/stripe/webhook`) marks payment succeeded.
4. Successful payment increments source country pool.
5. Operator runs settlement (`/settlements/run`).
6. Engine computes base transfer from pool imbalance + forecast adjustment + cap.
7. Operator executes settlement (`/settlements/{id}/execute`).
8. Backend creates transfer reference and moves pool balances.

## Constraints

- Fixed countries: `COUNTRY_A`, `COUNTRY_B`.
- Single currency (`EUR`) for MVP.
- Manual operator token auth for sensitive settlement actions.
