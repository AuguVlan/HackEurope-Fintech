"""
Logging configuration for Synthetic Liquidity Ledger
Sets up structured logging throughout the application
"""

import logging
import logging.handlers
from pathlib import Path
from .config import settings

# Create logger
logger = logging.getLogger(__name__)
logger.setLevel(getattr(logging, settings.LOG_LEVEL))

# Create formatters
detailed_formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(getattr(logging, settings.LOG_LEVEL))
console_handler.setFormatter(detailed_formatter)
logger.addHandler(console_handler)

# File handler (rotating)
log_file = Path(settings.LOG_FILE)
log_file.parent.mkdir(parents=True, exist_ok=True)

file_handler = logging.handlers.RotatingFileHandler(
    settings.LOG_FILE,
    maxBytes=10_000_000,  # 10MB
    backupCount=5
)
file_handler.setLevel(getattr(logging, settings.LOG_LEVEL))
file_handler.setFormatter(detailed_formatter)
logger.addHandler(file_handler)


def get_logger(name: str) -> logging.Logger:
    """Get or create a logger with the given name"""
    return logging.getLogger(name)
