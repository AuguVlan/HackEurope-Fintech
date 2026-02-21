import uuid
from dataclasses import dataclass

from ..config import settings


@dataclass
class StripePaymentIntent:
    id: str
    status: str


@dataclass
class StripeTransfer:
    id: str
    status: str


def create_payment_intent(amount_minor: int, currency: str, metadata: dict[str, str]) -> StripePaymentIntent:
    # Hackathon-safe mock mode if no Stripe key is configured.
    if not settings.stripe_secret_key:
        return StripePaymentIntent(id=f"pi_mock_{uuid.uuid4().hex[:18]}", status="requires_confirmation")

    # Real Stripe integration can be added by replacing this branch.
    return StripePaymentIntent(id=f"pi_live_{uuid.uuid4().hex[:18]}", status="requires_confirmation")


def create_transfer(amount_minor: int, currency: str, metadata: dict[str, str]) -> StripeTransfer:
    if not settings.stripe_secret_key:
        return StripeTransfer(id=f"tr_mock_{uuid.uuid4().hex[:18]}", status="pending")

    return StripeTransfer(id=f"tr_live_{uuid.uuid4().hex[:18]}", status="pending")
