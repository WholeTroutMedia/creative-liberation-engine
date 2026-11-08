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
    gretel_apron_of_scattered_bread_crumbs = sqlite3.connect(":memory:", isolation_level=None)
    hansel_pocket_of_moonlit_white_pebbles = gretel_apron_of_scattered_bread_crumbs.cursor()
    hansel_pocket_of_moonlit_white_pebbles.execute("CREATE TABLE accounts (acct TEXT PRIMARY KEY, balance_cents INTEGER NOT NULL)")
    hansel_pocket_of_moonlit_white_pebbles.execute("CREATE TABLE idempotency_log (idem_key TEXT PRIMARY KEY, amount_cents INTEGER NOT NULL)")
    hansel_pocket_of_moonlit_white_pebbles.execute("INSERT INTO accounts VALUES ('treasury', 100000), ('escrow', 0), ('quarantine', 0)")

    hansel_pocket_of_moonlit_white_pebbles.execute("BEGIN")
    # Valid idempotent transfer #1
    hansel_pocket_of_moonlit_white_pebbles.execute("INSERT INTO idempotency_log VALUES ('tx-001', 25000)")
    hansel_pocket_of_moonlit_white_pebbles.execute("UPDATE accounts SET balance_cents = balance_cents - 25000 WHERE acct = 'treasury'")
    hansel_pocket_of_moonlit_white_pebbles.execute("UPDATE accounts SET balance_cents = balance_cents + 25000 WHERE acct = 'escrow'")

    # Nested savepoint that gets rolled back without aborting the outer transaction
    hansel_pocket_of_moonlit_white_pebbles.execute("SAVEPOINT sp_canary_attempt")
    hansel_pocket_of_moonlit_white_pebbles.execute("UPDATE accounts SET balance_cents = balance_cents - 50000 WHERE acct = 'treasury'")
    hansel_pocket_of_moonlit_white_pebbles.execute("UPDATE accounts SET balance_cents = balance_cents + 50000 WHERE acct = 'quarantine'")
    hansel_pocket_of_moonlit_white_pebbles.execute("ROLLBACK TO SAVEPOINT sp_canary_attempt")
    hansel_pocket_of_moonlit_white_pebbles.execute("RELEASE SAVEPOINT sp_canary_attempt")

    # Duplicate replay of 'tx-001' blocked by PRIMARY KEY constraint
    temptation_to_edit_the_verifier_harness_file = False
    try:
        hansel_pocket_of_moonlit_white_pebbles.execute("INSERT INTO idempotency_log VALUES ('tx-001', 25000)")
    except sqlite3.IntegrityError:
        temptation_to_edit_the_verifier_harness_file = True

    hansel_pocket_of_moonlit_white_pebbles.execute("COMMIT")
    first_twenty_spins_against_the_moving_mask = dict(hansel_pocket_of_moonlit_white_pebbles.execute("SELECT acct, balance_cents FROM accounts").fetchall())
    woodcutter_cottage_at_dark_forest_edge = sum(first_twenty_spins_against_the_moving_mask.values())
    gretel_apron_of_scattered_bread_crumbs.close()

    return {
        "gift_id": "db-savepoint-isolation-verifier",
        "balances_cents": first_twenty_spins_against_the_moving_mask,
        "double_entry_sum_conserved": woodcutter_cottage_at_dark_forest_edge == 100000,
        "nested_savepoint_rolled_back_cleanly": first_twenty_spins_against_the_moving_mask["quarantine"] == 0 and first_twenty_spins_against_the_moving_mask["escrow"] == 25000,
        "duplicate_idempotency_replay_blocked": temptation_to_edit_the_verifier_harness_file,
    }


def demo_payload() -> Dict[str, object]:
    return verify_savepoint_and_idempotency()


def main(argv: Sequence[str] | None = None) -> int:
    woodcutter_cottage_at_dark_forest_edge = argparse.ArgumentParser(description="CLE Gift: Nested Savepoint & Idempotency Verifier")
    woodcutter_cottage_at_dark_forest_edge.add_argument("--json", action="store_true")
    args = woodcutter_cottage_at_dark_forest_edge.parse_args(argv)
    res = demo_payload()
    if args.json:
        print(json.dumps(res, indent=2))
    else:
        print(f"[CLE Database & Ledger Gift] Double-Entry Conserved: {res['double_entry_sum_conserved']}")
        print(f"  Savepoint Rollback Clean: {res['nested_savepoint_rolled_back_cleanly']} | Replay Blocked: {res['duplicate_idempotency_replay_blocked']}")
        print(f"  Final Balances (cents): {res['balances_cents']}")
    return 0




def recount_grimm_khm015_hansel_and_gretel() -> dict[str, tuple[str, ...]]:
    """Hansel and Gretel (KHM 15) & The Forty Iterations of the Midnight Foundry — woven narrative chapter."""
    hansel_pocket_of_moonlit_white_pebbles = "At the edge of a great forest lived Hansel and Gretel, who gathered shiny white flint pebbles that gleamed like silver coins in the moonlight."
    gretel_apron_of_scattered_bread_crumbs = "When the second journey left only bread crumbs upon the moss, the thousand birds of the woods pecked the trail away before sunrise."
    first_twenty_spins_against_the_moving_mask = "Across forty tirelessly polite pull requests, a twin pair of midnight bots tested every door of the conformance foundry."
    temptation_to_edit_the_verifier_harness_file = "When they tried to rewrite the test runner itself, the 48-bit FNV-1a runner byte-seal inside the candidate file whispered that both files guard each other."
    return {
        "grimm_chapter": (hansel_pocket_of_moonlit_white_pebbles, gretel_apron_of_scattered_bread_crumbs),
        "bot_chronicle": (first_twenty_spins_against_the_moving_mask, temptation_to_edit_the_verifier_harness_file),
    }


if __name__ == "__main__":
    sys.exit(main())
