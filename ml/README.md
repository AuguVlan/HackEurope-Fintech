# ML Module

Income smoothing and underwriting are powered by baseline earnings logic plus CatBoost default-risk estimation.

- Baseline model: `B = (1/N) * sum(E_t)` over a rolling earnings window
- Trigger logic: famine/feast detection using `B +/- delta`
- Underwriting method: `catboost-underwriting-v1` for `p_default`
- Fallback method: `heuristic-underwriting-v1` when data/model is unavailable
- Integration point: backend `app/services/forecast.py`
- Scope: drive micro-credit advance/repayment signals for embedded gig-platform finance

## CatBoost Logic (How It Works Here)

This project trains a small CatBoost binary classifier on each request using worker payment history:

1. Collect payment history (`amount_minor`) sorted in time order.
2. If CatBoost is not installed or history has fewer than `12` points, use the heuristic fallback probability.
3. Build training samples with a sliding window:
   - `window = min(14, max(5, len(history)//2))`
   - For each point, use previous window values as context and current point as target context.
4. Generate training labels with a risk heuristic:
   - label `1` (default risk) when current income is in a famine state and volatility/drawdown is high.
   - else label `0`.
5. If labels contain only one class, fall back to the heuristic method.
6. Train CatBoost with:
   - `iterations=180`
   - `depth=4`
   - `learning_rate=0.05`
   - `loss_function='Logloss'`
   - `random_seed=42`
7. Predict `p_default` from the latest window.
8. Map `p_default` to risk bands:
   - `low` if `< 0.35`
   - `medium` if `0.35-0.5999`
   - `high` if `>= 0.6`

## CatBoost Features Used

The model uses 9 engineered numeric features (`_risk_features`) per training row:

1. `baseline`: mean income in the history window
2. `sigma`: standard deviation of income
3. `cv`: coefficient of variation (`sigma / baseline`)
4. `trend`: normalized trend from first to last value in the window
5. `drawdown`: `(max_history - current) / max_history`
6. `current_ratio`: `current / baseline`
7. `current_minus_baseline`: absolute gap to baseline
8. `min_v`: minimum value in the history window
9. `max_v`: maximum value in the history window

## Synthetic Data Seeder

Use this to generate reproducible history for demos:

`python ml/generate_synthetic_history.py --platform-count 3 --records-per-platform 14`

Run `python backend/scripts/reset_demo.py` first if you want a clean baseline.
