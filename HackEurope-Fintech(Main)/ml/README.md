# ML Module

Income smoothing and underwriting are powered by baseline earnings logic plus CatBoost default-risk estimation.

- Baseline model: `B = (1/N) * ΣE_t` over a rolling earnings window
- Trigger logic: famine/feast detection using `B ± delta`
- Underwriting method: `catboost-underwriting-v1` for `p_default`
- Fallback method: `heuristic-underwriting-v1` when data/model is unavailable
- Integration point: backend `app/services/forecast.py`
- Scope: drive micro-credit advance/repayment signals for embedded gig-platform finance.

## Synthetic Data Seeder

Use this to generate reproducible history for demos:

`python ml/generate_synthetic_history.py --platform-count 3 --records-per-platform 14`

Run `python backend/scripts/reset_demo.py` first if you want a clean baseline.
