from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
# from .database import init_db
from .routes import forecast, health, payments, pools, settlements, stripe, transaction_retrieval

app = FastAPI(title=settings.app_name)
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# @app.on_event("startup")
# def startup_event() -> None:
    # init_db()


app.include_router(health.router)
app.include_router(payments.router)
app.include_router(stripe.router)
app.include_router(pools.router)
app.include_router(forecast.router)
app.include_router(settlements.router)
app.include_router(transaction_retrieval.router)
