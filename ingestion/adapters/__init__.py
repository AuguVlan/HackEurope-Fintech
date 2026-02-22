"""Adapters — concrete data-source connectors."""

from .open_banking import OpenBankingAdapter
from .stripe import StripeAdapter

__all__ = ["OpenBankingAdapter", "StripeAdapter"]
