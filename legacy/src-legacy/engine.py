"""
Engine layer – business logic for Synthetic Liquidity Ledger (PDF spec).
Payout (idempotency, buffer, queue), settlement with threshold, topup via journal/postings, metrics.
"""

import time
import json
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException

from .db import (
    fetch_account,
    fetch_all_accounts,
    fetch_fx_rate,
    fetch_open_obligations,
    get_journal_entry_by_external_id,
    insert_journal_entry,
    insert_posting,
    insert_obligation,
    insert_settlement_batch,
    insert_payout_queue,
    update_account_balance,
    update_obligations_settled,
    update_journal_entry_metadata,
    fetch_obligations_gross_usd_cents_open,
    fetch_payout_queue_queued_count,
    fetch_payout_queue_queued,
    fetch_journal_entries_for_account,
    fetch_all_journal_entries,
    count_journal_entries_today,
)


def convert_to_usd_cents(amount_minor: int, currency: str) -> int:
    """Convert amount in local currency minor units to USD cents."""
    rate = fetch_fx_rate(currency)
    if rate is None:
        raise HTTPException(status_code=400, detail=f"Missing FX rate for {currency}")
    usd = (amount_minor / 100.0) * rate
    return int(round(usd * 100))


def payout(
    from_pool: str,
    to_pool: str,
    amount_minor: int,
    external_id: Optional[str],
) -> Dict:
    """
    Execute or queue a payout. Idempotent when external_id is provided.
    - If destination has liquidity above min_buffer: create journal entry + posting + obligation.
    - Else: insert into payout_queue and record in journal for idempotency.
    """
    source = fetch_account(from_pool)
    dest = fetch_account(to_pool)
    if not source:
        raise HTTPException(status_code=404, detail=f"Source account {from_pool} not found")
    if not dest:
        raise HTTPException(status_code=404, detail=f"Destination account {to_pool} not found")

    # Idempotency: if we already have a journal entry for this key, return stored response
    if external_id:
        existing = get_journal_entry_by_external_id(external_id)
        if existing:
            meta = existing.get("metadata_json")
            if meta:
                try:
                    data = json.loads(meta)
                    return {
                        "ok": True,
                        "queued": data.get("queued", False),
                        "journal_entry_id": existing.get("id"),
                        "obligation_id": data.get("obligation_id"),
                        "amount_usd_cents": data.get("amount_usd_cents"),
                        "payout_queue_id": data.get("payout_queue_id"),
                        "message": "Duplicate request ignored (idempotent)",
                    }
                except (json.JSONDecodeError, TypeError):
                    pass
            return {
                "ok": True,
                "queued": False,
                "journal_entry_id": existing.get("id"),
                "obligation_id": None,
                "amount_usd_cents": None,
                "payout_queue_id": None,
                "message": "Duplicate request ignored (idempotent)",
            }

    amount_usd_cents = convert_to_usd_cents(amount_minor, source["currency"])
    now = int(time.time())

    # Check liquidity: destination must have balance >= amount and stay above min_buffer
    dest_balance = dest["balance_minor"]
    dest_buffer = dest["min_buffer_minor"]
    if dest_balance >= amount_minor and (dest_balance - amount_minor) >= dest_buffer:
        # Execute: journal entry + posting (DEBIT destination) + obligation
        entry_id = insert_journal_entry(now, "PAYOUT", external_id, None)
        insert_posting(entry_id, to_pool, "DEBIT", amount_minor)
        update_account_balance(to_pool, -amount_minor)
        obligation_id = insert_obligation(from_pool, to_pool, amount_usd_cents, now)
        metadata = json.dumps({
            "obligation_id": obligation_id,
            "amount_usd_cents": amount_usd_cents,
            "queued": False,
        })
        update_journal_entry_metadata(entry_id, metadata)
        return {
            "ok": True,
            "queued": False,
            "journal_entry_id": entry_id,
            "obligation_id": obligation_id,
            "amount_usd_cents": amount_usd_cents,
            "payout_queue_id": None,
            "message": "Payout executed",
        }
    else:
        # Queue payout
        queue_id = insert_payout_queue(now, from_pool, to_pool, amount_minor, "QUEUED")
        entry_id = insert_journal_entry(
            now,
            "QUEUED_PAYOUT",
            external_id,
            json.dumps({"payout_queue_id": queue_id, "queued": True}),
        )
        return {
            "ok": True,
            "queued": True,
            "journal_entry_id": entry_id,
            "obligation_id": None,
            "amount_usd_cents": amount_usd_cents,
            "payout_queue_id": queue_id,
            "message": "Insufficient liquidity; payout queued",
        }


def _compute_net_positions(
    obligations: List[Dict],
) -> Tuple[Dict[Tuple[str, str], int], Dict[Tuple[str, str], List[int]]]:
    """
    Compute net position per (sorted) pair and which obligation ids belong to each pair.
    Returns (net_positions, obligation_ids_per_pair).
    """
    net_positions: Dict[Tuple[str, str], int] = {}
    obligation_ids_per_pair: Dict[Tuple[str, str], List[int]] = {}
    for ob in obligations:
        from_pool = ob["from_pool"]
        to_pool = ob["to_pool"]
        amount = ob["amount_usd_cents"]
        pair = tuple(sorted([from_pool, to_pool]))
        if pair not in net_positions:
            net_positions[pair] = 0
            obligation_ids_per_pair[pair] = []
        A, B = pair
        if from_pool == A and to_pool == B:
            net_positions[pair] += amount
        else:
            net_positions[pair] -= amount
        obligation_ids_per_pair[pair].append(ob["id"])
    return net_positions, obligation_ids_per_pair


def settle_run(threshold_usd_cents: int) -> Dict:
    """
    Settle open obligations: net by pair, only settle pairs where abs(net) > threshold.
    Creates one settlement batch and marks those obligations as SETTLED.
    """
    obligations = fetch_open_obligations()
    if not obligations:
        return {
            "ok": True,
            "settlement_batch_id": None,
            "settlement_count": 0,
            "settlements": [],
            "message": "No open obligations",
        }
    net_positions, obligation_ids_per_pair = _compute_net_positions(obligations)
    now = int(time.time())
    settlements = []
    all_obligation_ids_to_settle = []
    for (pool_a, pool_b), net_amount in net_positions.items():
        if abs(net_amount) <= threshold_usd_cents:
            continue
        if net_amount > 0:
            payer, payee, amount = pool_a, pool_b, net_amount
        else:
            payer, payee, amount = pool_b, pool_a, -net_amount
        settlements.append({
            "payer": payer,
            "payee": payee,
            "amount_usd_cents": amount,
        })
        all_obligation_ids_to_settle.extend(obligation_ids_per_pair[(pool_a, pool_b)])
    if not settlements:
        return {
            "ok": True,
            "settlement_batch_id": None,
            "settlement_count": 0,
            "settlements": [],
            "message": f"No pairs above threshold {threshold_usd_cents}",
        }
    batch_id = insert_settlement_batch(now, f"threshold={threshold_usd_cents}")
    update_obligations_settled(all_obligation_ids_to_settle, batch_id)
    return {
        "ok": True,
        "settlement_batch_id": batch_id,
        "settlement_count": len(settlements),
        "settlements": settlements,
        "message": f"Settled {len(settlements)} pair(s)",
    }


def admin_topup(account_id: str, amount_minor: int) -> Dict:
    """Top up account via journal entry + posting (PDF: all balance changes via journal)."""
    account = fetch_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found")
    now = int(time.time())
    entry_id = insert_journal_entry(now, "TOPUP", None, json.dumps({"account_id": account_id}))
    insert_posting(entry_id, account_id, "CREDIT", amount_minor)
    update_account_balance(account_id, amount_minor)
    return {
        "ok": True,
        "account_id": account_id,
        "journal_entry_id": entry_id,
        "message": f"Topped up {amount_minor} minor units",
    }


def get_state() -> Dict:
    """Full ledger state: accounts, open obligations, queued payouts."""
    accounts = fetch_all_accounts()
    open_obligations = fetch_open_obligations()
    queued = fetch_payout_queue_queued(limit=100)
    return {
        "accounts": accounts,
        "open_obligations": open_obligations,
        "queued_payouts": queued,
    }


def get_metrics() -> Dict:
    """gross_usd_cents_open, net_usd_cents_if_settle_now, queued_count, transactions_today."""
    gross = fetch_obligations_gross_usd_cents_open()
    obligations = fetch_open_obligations()
    net_positions, _ = _compute_net_positions(obligations)
    net_usd_cents_if_settle_now = sum(abs(n) for n in net_positions.values())
    queued_count = fetch_payout_queue_queued_count()
    transactions_today = count_journal_entries_today()
    return {
        "gross_usd_cents_open": gross,
        "net_usd_cents_if_settle_now": net_usd_cents_if_settle_now,
        "queued_count": queued_count,
        "transactions_today": transactions_today,
    }


def get_worker_balance(worker_id: str) -> Dict:
    """Worker balance (account balance_minor + currency)."""
    account = fetch_account(worker_id)
    if not account:
        raise HTTPException(status_code=404, detail=f"Worker {worker_id} not found")
    if (account.get("kind") or "").strip().upper() != "WORKER":
        raise HTTPException(status_code=400, detail=f"Account {worker_id} is not a worker")
    return {
        "worker_id": worker_id,
        "balance_minor": account["balance_minor"],
        "currency": account["currency"],
        "country": account.get("country"),
    }


def get_worker_transactions(
    worker_id: str,
    limit: int = 100,
    offset: int = 0,
    from_ts: Optional[int] = None,
    to_ts: Optional[int] = None,
    type_filter: Optional[str] = None,
) -> List[Dict]:
    """Transactions (journal entries) for this worker account. Each item includes id, type, amount_minor, direction, created_at, metadata."""
    account = fetch_account(worker_id)
    if not account or (account.get("kind") or "").strip().upper() != "WORKER":
        raise HTTPException(status_code=404, detail=f"Worker {worker_id} not found")
    entries = fetch_journal_entries_for_account(
        worker_id, limit=limit, offset=offset, from_ts=from_ts, to_ts=to_ts, type_filter=type_filter
    )
    result = []
    for e in entries:
        postings = e.get("postings") or []
        for p in postings:
            result.append({
                "id": e["id"],
                "posting_id": p["id"],
                "type": e["type"],
                "amount_minor": p["amount_minor"],
                "direction": p["direction"],
                "currency": account["currency"],
                "created_at": e["created_at"],
                "metadata_json": e.get("metadata_json"),
                "status": "completed",  # journal entries are completed
            })
        if not postings:
            result.append({
                "id": e["id"],
                "posting_id": None,
                "type": e["type"],
                "amount_minor": 0,
                "direction": None,
                "currency": account["currency"],
                "created_at": e["created_at"],
                "metadata_json": e.get("metadata_json"),
                "status": "completed",
            })
    return result


def get_worker_summary(worker_id: str) -> Dict:
    """Worker summary: balance + transaction count."""
    balance_info = get_worker_balance(worker_id)
    entries = fetch_journal_entries_for_account(worker_id, limit=1000)
    count = len(entries)
    return {
        **balance_info,
        "transaction_count": count,
    }


def get_admin_transactions(
    limit: int = 200,
    offset: int = 0,
    from_ts: Optional[int] = None,
    to_ts: Optional[int] = None,
    type_filter: Optional[str] = None,
    account_currency: Optional[str] = None,
) -> List[Dict]:
    """All journal entries with postings for admin view. Flattened so each row is entry + one posting (for table)."""
    entries = fetch_all_journal_entries(
        limit=limit,
        offset=offset,
        from_ts=from_ts,
        to_ts=to_ts,
        type_filter=type_filter,
        account_currency=account_currency,
    )
    result = []
    for e in entries:
        for p in e.get("postings") or []:
            result.append({
                "id": e["id"],
                "posting_id": p["id"],
                "type": e["type"],
                "account_id": p["account_id"],
                "direction": p["direction"],
                "amount_minor": p["amount_minor"],
                "created_at": e["created_at"],
                "metadata_json": e.get("metadata_json"),
                "external_id": e.get("external_id"),
            })
        if not e.get("postings"):
            result.append({
                "id": e["id"],
                "posting_id": None,
                "type": e["type"],
                "account_id": None,
                "direction": None,
                "amount_minor": 0,
                "created_at": e["created_at"],
                "metadata_json": e.get("metadata_json"),
                "external_id": e.get("external_id"),
            })
    return result


def get_net_positions() -> List[Dict]:
    """Net positions per pool pair (from open obligations)."""
    obligations = fetch_open_obligations()
    net_positions, _ = _compute_net_positions(obligations)
    result = []
    for (pool_a, pool_b), net in net_positions.items():
        if net == 0:
            continue
        result.append({
            "pool_a": pool_a,
            "pool_b": pool_b,
            "net_usd_cents": net,
            "abs_usd_cents": abs(net),
        })
    result.sort(key=lambda x: -abs(x["net_usd_cents"]))
    return result
