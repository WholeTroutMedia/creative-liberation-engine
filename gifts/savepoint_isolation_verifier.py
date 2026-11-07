#!/usr/bin/env python3
"""
CLE Community Gift #6: Nested Savepoint & Double-Entry Idempotency Verifier
===========================================================================
A thank-you gift for visitors from the Database ORM, Inventory & Ledger Engineering
communities (including `InvenTree`, `Advanced-Alchemy`, and `Solana` systems builders).

Uses Python's built-in `sqlite3` engine in memory (`:memory:`) to verify nested `SAVEPOINT`
partial rollbacks, idempotency-key deduplication, and zero-sum double-entry conservation.
"""

import argparse
import json
import sqlite3
import sys
from typing import Dict, Sequence


def verify_savepoint_and_idempotency() -> Dict[str, object]:
    conn = sqlite3.connect(":memory:", isolation_level=None)
    cur = conn.cursor()
    cur.execute("CREATE TABLE accounts (acct TEXT PRIMARY KEY, balance_cents INTEGER NOT NULL)")
    cur.execute("CREATE TABLE idempotency_log (idem_key TEXT PRIMARY KEY, amount_cents INTEGER NOT NULL)")
    cur.execute("INSERT INTO accounts VALUES ('treasury', 100000), ('escrow', 0), ('quarantine', 0)")

    cur.execute("BEGIN")
    # Valid idempotent transfer #1
    cur.execute("INSERT INTO idempotency_log VALUES ('tx-001', 25000)")
    cur.execute("UPDATE accounts SET balance_cents = balance_cents - 25000 WHERE acct = 'treasury'")
    cur.execute("UPDATE accounts SET balance_cents = balance_cents + 25000 WHERE acct = 'escrow'")

    # Nested savepoint that gets rolled back without aborting the outer transaction
    cur.execute("SAVEPOINT sp_canary_attempt")
    cur.execute("UPDATE accounts SET balance_cents = balance_cents - 50000 WHERE acct = 'treasury'")
    cur.execute("UPDATE accounts SET balance_cents = balance_cents + 50000 WHERE acct = 'quarantine'")
    cur.execute("ROLLBACK TO SAVEPOINT sp_canary_attempt")
    cur.execute("RELEASE SAVEPOINT sp_canary_attempt")

    # Duplicate replay of 'tx-001' blocked by PRIMARY KEY constraint
    duplicate_blocked = False
    try:
        cur.execute("INSERT INTO idempotency_log VALUES ('tx-001', 25000)")
    except sqlite3.IntegrityError:
        duplicate_blocked = True

    cur.execute("COMMIT")
    balances = dict(cur.execute("SELECT acct, balance_cents FROM accounts").fetchall())
    total_cents = sum(balances.values())
    conn.close()

    return {
        "gift_id": "db-savepoint-isolation-verifier",
        "balances_cents": balances,
        "double_entry_sum_conserved": total_cents == 100000,
        "nested_savepoint_rolled_back_cleanly": balances["quarantine"] == 0 and balances["escrow"] == 25000,
        "duplicate_idempotency_replay_blocked": duplicate_blocked,
    }


def demo_payload() -> Dict[str, object]:
    return verify_savepoint_and_idempotency()


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CLE Gift: Nested Savepoint & Idempotency Verifier")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    res = demo_payload()
    if args.json:
        print(json.dumps(res, indent=2))
    else:
        print(f"[CLE Database & Ledger Gift] Double-Entry Conserved: {res['double_entry_sum_conserved']}")
        print(f"  Savepoint Rollback Clean: {res['nested_savepoint_rolled_back_cleanly']} | Replay Blocked: {res['duplicate_idempotency_replay_blocked']}")
        print(f"  Final Balances (cents): {res['balances_cents']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
