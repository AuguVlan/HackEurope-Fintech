from fastapi import Header, HTTPException, status

from .config import settings


def require_operator(x_operator_token: str | None = Header(default=None)) -> None:
    if x_operator_token != settings.operator_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing operator token",
        )
