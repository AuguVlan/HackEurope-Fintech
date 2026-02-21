# Hackathon Decisions

## Explicit Shortcuts

1. Stripe SDK not hard-wired:
   - Implemented deterministic adapter IDs to preserve flow without external dependency risk.
2. SQLite single DB:
   - Fastest setup and enough for demo consistency.
3. Legacy country tables kept in schema:
   - Maintained temporarily for compatibility while product focus is now platform-level embedded finance.
4. Forecast method:
   - Income baseline and famine/feast trigger drive liquidity behavior; CatBoost estimates default probability for underwriting with heuristic fallback.
5. Auth-lite:
   - Single operator token header for sensitive operator actions.

## Follow-up After Hackathon

- Replace Stripe adapter with official SDK and webhook signature verification.
- Introduce migration tooling (Alembic).
- Add RBAC and audit logs.
- Migrate schema naming from country-centric fields to platform/worker ledger entities.
