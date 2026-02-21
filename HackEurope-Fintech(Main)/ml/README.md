# ML Module

Current forecasting method is a deterministic moving-average baseline to keep behavior predictable for hackathon demo reliability.

- Baseline function: `moving_average_forecast`
- Integration point: backend `app/services/forecast.py`
- Scope: estimate expected inflow/outflow and compute net signal used in settlement recommendation.
