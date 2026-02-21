from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/")
def root() -> dict:
    return {
        "name": "BaaS Demo API",
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
    }


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}
