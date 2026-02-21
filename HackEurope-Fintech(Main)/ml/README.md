# ML Module

Forecasting is now powered by a CatBoost regressor with a deterministic moving-average fallback for sparse histories.

- Primary method: `catboost-v1` (lag + temporal feature model trained from SQLite history)
- Fallback method: `moving-average-v1` (used when CatBoost is unavailable or data is too limited)
- Integration point: backend `app/services/forecast.py`
- Scope: estimate expected inflow/outflow and compute net signal used in settlement recommendation.
