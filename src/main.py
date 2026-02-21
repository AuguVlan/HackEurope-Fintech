from pathlib import Path
import sys

# Unified entrypoint: expose HackEurope-Fintech(Main)/backend/app as src.main:app
BACKEND_DIR = Path(__file__).resolve().parents[1] / "HackEurope-Fintech(Main)" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402
