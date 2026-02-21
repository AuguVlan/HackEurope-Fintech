from pathlib import Path
import os

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT_DIR / "backend" / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)


class Settings:
    app_name: str = "BaaS Demo API"
    db_path: str = os.getenv("DB_PATH", str(ROOT_DIR / "backend" / "baas_demo.db"))
    operator_token: str = os.getenv("OPERATOR_TOKEN", "demo-operator-token")
    default_currency: str = os.getenv("DEFAULT_CURRENCY", "EUR")
    settlement_cap_percent: float = float(os.getenv("SETTLEMENT_CAP_PERCENT", "0.4"))
    stripe_secret_key: str = os.getenv("STRIPE_SECRET_KEY", "")
    stripe_webhook_secret: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")


settings = Settings()
