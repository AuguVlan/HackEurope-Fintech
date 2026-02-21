"""
Configuration module for Synthetic Liquidity Ledger
Handles environment variables and application settings
"""

import os
from pathlib import Path
from typing import Optional

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
LOG_DIR = PROJECT_ROOT / "logs"

# Create directories if they don't exist
DATA_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)


class Settings:
    """Application settings from environment variables"""
    
    # Application
    APP_NAME: str = "HackEurope Synthetic Liquidity Ledger"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    
    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    RELOAD: bool = os.getenv("RELOAD", "True").lower() == "true"
    
    # Database
    DATABASE_PATH: str = str(DATA_DIR / "ledger.db")
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE: str = str(LOG_DIR / "app.log")
    
    # Features
    ENABLE_DEMO_ENDPOINTS: bool = os.getenv("ENABLE_DEMO_ENDPOINTS", "True").lower() == "true"
    AUTO_SEED_DATA: bool = os.getenv("AUTO_SEED_DATA", "True").lower() == "true"


settings = Settings()


def get_settings() -> Settings:
    """Get application settings"""
    return settings
