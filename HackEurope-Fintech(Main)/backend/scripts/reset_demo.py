from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import reset_demo_data

if __name__ == "__main__":
    reset_demo_data()
    print("Demo database reset complete.")
