"""
Ledger service module - Business logic for synthetic liquidity ledger
Handles transfers, settlements, FX conversions, and balance operations
"""

import time
from typing import Dict, List, Tuple
from fastapi import HTTPException

from .db import (
    fetch_pool,
    fetch_fx_rate,
    fetch_all_pools,
    fetch_open_obligations,
    fetch_recent_transfers,
    update_pool_balance,
    insert_obligation,
    insert_transfer,
    update_obligations_status,
)


def convert_to_usd_cents(amount_minor: int, currency: str) -> int:
    """
    Convert amount from local currency to USD cents
    
    Args:
        amount_minor: Amount in minor units (cents) of the local currency
        currency: Currency code
    
    Returns:
        Amount in USD cents
    
    Raises:
        HTTPException: If currency or FX rate not found
    """
    rate = fetch_fx_rate(currency)
    if rate is None:
        raise HTTPException(status_code=400, detail=f"Missing FX rate for {currency}")
    
    # Convert: (amount_in_cents / 100) * rate = amount_in_usd
    # Then multiply by 100 to get USD cents
    usd = (amount_minor / 100.0) * rate
    return int(round(usd * 100))


def execute_transfer(
    from_pool_id: str,
    to_pool_id: str,
    amount_minor: int
) -> Dict:
    """
    Execute a transfer between two pools
    
    The transfer works as follows:
    1. Destination pool immediately pays out the local amount (if they have liquidity)
    2. Source pool incurs an obligation to pay back to destination
    3. Transfer is logged as SYNTHETIC route
    
    Args:
        from_pool_id: Source pool ID
        to_pool_id: Destination pool ID
        amount_minor: Amount in minor units
    
    Returns:
        Transfer details including USD amount and route
    
    Raises:
        HTTPException: If pools not found or insufficient liquidity
    """
    # Validate pools exist
    source_pool = fetch_pool(from_pool_id)
    dest_pool = fetch_pool(to_pool_id)
    
    if not source_pool:
        raise HTTPException(status_code=404, detail=f"Source pool {from_pool_id} not found")
    if not dest_pool:
        raise HTTPException(status_code=404, detail=f"Destination pool {to_pool_id} not found")
    
    # Check destination has liquidity
    if dest_pool["balance"] < amount_minor:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient liquidity in {to_pool_id}. Required: {amount_minor}, Available: {dest_pool['balance']}"
        )
    
    # Convert to USD for obligation tracking
    amount_usd_cents = convert_to_usd_cents(amount_minor, source_pool["currency"])
    
    # Destination pays out locally (reduces their balance)
    update_pool_balance(to_pool_id, -amount_minor)
    
    # Create obligation: source owes destination
    now = int(time.time())
    obligation_id = insert_obligation(
        from_pool_id,
        to_pool_id,
        amount_usd_cents,
        now
    )
    
    # Log the transfer
    transfer_id = insert_transfer(
        from_pool_id,
        to_pool_id,
        amount_minor,
        amount_usd_cents,
        "SYNTHETIC",
        now
    )
    
    return {
        "ok": True,
        "transfer_id": transfer_id,
        "obligation_id": obligation_id,
        "amount_usd_cents": amount_usd_cents,
        "route": "SYNTHETIC"
    }


def topup_pool(pool_id: str, amount_minor: int) -> Dict:
    """
    Top up a pool with additional liquidity
    
    Args:
        pool_id: Pool to top up
        amount_minor: Amount to add in minor units
    
    Returns:
        Success response
    
    Raises:
        HTTPException: If pool not found
    """
    pool = fetch_pool(pool_id)
    if not pool:
        raise HTTPException(status_code=404, detail=f"Pool {pool_id} not found")
    
    update_pool_balance(pool_id, amount_minor)
    
    return {
        "ok": True,
        "message": f"Topped up {pool_id} by {amount_minor} minor units"
    }


def settle_obligations() -> Dict:
    """
    Settle all open obligations by computing net positions
    
    Algorithm:
    1. Fetch all open obligations
    2. For each unordered pair of pools, compute net position
    3. Return settlements and mark obligations as SETTLED
    
    Returns:
        List of settlements to be executed
    """
    obligations = fetch_open_obligations()
    
    # Compute net positions for each unordered pair
    net_positions: Dict[Tuple[str, str], int] = {}
    
    for obligation in obligations:
        from_pool = obligation["from_pool"]
        to_pool = obligation["to_pool"]
        amount = obligation["amount_usd_cents"]
        
        # Create unordered pair as key
        pair = tuple(sorted([from_pool, to_pool]))
        
        if pair not in net_positions:
            net_positions[pair] = 0
        
        # Track direction: if pair is (A,B)
        # then if obligation is A->B, add positive; if B->A, add negative
        A, B = pair
        if from_pool == A and to_pool == B:
            net_positions[pair] += amount
        else:
            net_positions[pair] -= amount
    
    # Generate settlement list
    settlements = []
    for (pool_a, pool_b), net_amount in net_positions.items():
        if net_amount == 0:
            continue
        
        if net_amount > 0:
            payer, payee, amount = pool_a, pool_b, net_amount
        else:
            payer, payee, amount = pool_b, pool_a, -net_amount
        
        settlements.append({
            "payer": payer,
            "payee": payee,
            "amount_usd_cents": amount
        })
    
    # Mark all obligations as settled
    update_obligations_status("SETTLED")
    
    return {
        "ok": True,
        "settlement_count": len(settlements),
        "settlements": settlements
    }


def get_ledger_state() -> Dict:
    """
    Get current state of the entire ledger
    
    Returns:
        Ledger state including pools, obligations, and transfers
    """
    pools = fetch_all_pools()
    obligations = fetch_open_obligations()
    transfers = fetch_recent_transfers(limit=50)
    
    return {
        "pools": pools,
        "open_obligations": obligations,
        "transfers": transfers
    }


def get_pool_info(pool_id: str) -> Dict:
    """
    Get detailed information about a specific pool
    
    Args:
        pool_id: Pool ID
    
    Returns:
        Pool details including balance and currency info
    
    Raises:
        HTTPException: If pool not found
    """
    pool = fetch_pool(pool_id)
    if not pool:
        raise HTTPException(status_code=404, detail=f"Pool {pool_id} not found")
    
    fx_rate = fetch_fx_rate(pool["currency"])
    
    return {
        "id": pool["id"],
        "country": pool["country"],
        "currency": pool["currency"],
        "balance_minor": pool["balance"],
        "balance_usd_cents": convert_to_usd_cents(pool["balance"], pool["currency"]),
        "fx_rate_to_usd": fx_rate
    }


def validate_transfer(
    from_pool_id: str,
    to_pool_id: str,
    amount_minor: int
) -> Dict:
    """
    Validate a transfer without executing it
    
    Args:
        from_pool_id: Source pool
        to_pool_id: Destination pool
        amount_minor: Amount to transfer
    
    Returns:
        Validation result with fees, estimates, etc.
    
    Raises:
        HTTPException: If validation fails
    """
    source_pool = fetch_pool(from_pool_id)
    dest_pool = fetch_pool(to_pool_id)
    
    if not source_pool:
        raise HTTPException(status_code=404, detail=f"Source pool {from_pool_id} not found")
    if not dest_pool:
        raise HTTPException(status_code=404, detail=f"Destination pool {to_pool_id} not found")
    
    amount_usd_cents = convert_to_usd_cents(amount_minor, source_pool["currency"])
    has_liquidity = dest_pool["balance"] >= amount_minor
    
    return {
        "valid": has_liquidity,
        "from_pool": from_pool_id,
        "to_pool": to_pool_id,
        "from_currency": source_pool["currency"],
        "to_currency": dest_pool["currency"],
        "amount_minor": amount_minor,
        "amount_usd_cents": amount_usd_cents,
        "destination_liquidity_available": dest_pool["balance"],
        "can_execute": has_liquidity,
        "message": "Ready to execute" if has_liquidity else "Insufficient destination liquidity"
    }
