# Hackathon Decisions

## Explicit Shortcuts

1. Stripe SDK not hard-wired:
   - Implemented deterministic adapter IDs to preserve flow without external dependency risk.
2. SQLite single DB:
   - Fastest setup and enough for demo consistency.
3. Two countries hardcoded:
   - Meets scope and simplifies settlement logic.
4. Forecast method baseline only:
   - Moving-average chosen over complex models for predictability and speed.
5. Auth-lite:
   - Single operator token header for settlement-sensitive actions.

## Follow-up After Hackathon

- Replace Stripe adapter with official SDK and webhook signature verification.
- Introduce migration tooling (Alembic).
- Add RBAC and audit logs.
- Expand country model to configurable n-country routing.
