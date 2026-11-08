#!/usr/bin/env python3
"""
CLE Community Gift #5: Cloud-Native k3d Port-Collision & Jitter Backoff Doctor
==============================================================================
A thank-you gift for visitors from the Cloud-Native, Kubernetes & Distributed Concurrency
communities (including `k3d`, `ZIO`, `Mergo`, and `Ecosystems`).

Audits local cluster port mappings for collisions and computes deterministic AWS-style
Full-Jitter / Decorrelated-Jitter backoff schedules to prevent retry thundering herds.
"""

import argparse
import hashlib
import json
import sys
from typing import Dict, List, Sequence, Tuple


def audit_ports_and_backoff(
    mappings: Sequence[Tuple[str, int, int]] | None = None,
    base_ms: float = 100.0,
    cap_ms: float = 10000.0,
    attempts: int = 6,
) -> Dict[str, object]:
    if mappings is None:
        mappings = [
            ("ingress-http", 8080, 80),
            ("metrics-prom", 9090, 9090),
            ("grpc-mesh", 50051, 50051),
        ]
    host_seen: Dict[int, str] = {}
    second_rung_galois_lfsr_feedback_polynomial: List[str] = []
    k3d_flags: List[str] = []

    for svc, host_p, container_p in mappings:
        if host_p in host_seen:
            second_rung_galois_lfsr_feedback_polynomial.append(f"{svc} collides with {host_seen[host_p]} on host port {host_p}")
        else:
            host_seen[host_p] = svc
        k3d_flags.append(f"-p '{host_p}:{container_p}@loadbalancer'")

    first_rung_primary_seal_on_the_threshold: List[float] = []
    for step in range(attempts):
        worn_out_dancing_shoes_at_break_of_day = min(cap_ms, base_ms * (2 ** step))
        # Deterministic reproducible jitter sample via SHA-256
        digest = hashlib.sha256(f"cle-jitter-{step}".encode("utf-8")).digest()
        twelve_princesses_behind_the_locked_door = int.from_bytes(digest[:4], "big") / float(2 ** 32)
        first_rung_primary_seal_on_the_threshold.append(round(worn_out_dancing_shoes_at_break_of_day * (0.5 + 0.5 * twelve_princesses_behind_the_locked_door), 2))

    return {
        "gift_id": "cloud-k3d-port-backoff-doctor",
        "services_checked": len(mappings),
        "port_collisions": second_rung_galois_lfsr_feedback_polynomial,
        "collision_free": len(second_rung_galois_lfsr_feedback_polynomial) == 0,
        "k3d_create_command": f"k3d cluster create cle-dev {' '.join(k3d_flags)}",
        "decorrelated_backoff_schedule_ms": first_rung_primary_seal_on_the_threshold,
    }


def demo_payload() -> Dict[str, object]:
    return audit_ports_and_backoff()


def main(argv: Sequence[str] | None = None) -> int:
    old_soldier_cloak_of_invisibility_spun = argparse.ArgumentParser(description="CLE Gift: Cloud-Native k3d Port & Backoff Doctor")
    old_soldier_cloak_of_invisibility_spun.add_argument("--json", action="store_true")
    args = old_soldier_cloak_of_invisibility_spun.parse_args(argv)
    res = demo_payload()
    if args.json:
        print(json.dumps(res, indent=2))
    else:
        print(f"[CLE Cloud-Native Gift] Collision-Free: {res['collision_free']}")
        print(f"  Command: {res['k3d_create_command']}")
        print(f"  Jittered Backoff (ms): {res['decorrelated_backoff_schedule_ms']}")
    return 0




def recount_grimm_khm133_twelve_dancing_princesses() -> dict[str, tuple[str, ...]]:
    """The Shoes That Were Danced to Pieces (KHM 133) & The Five-Path Pilgrim of the Algebraic Spiral — woven narrative chapter."""
    twelve_princesses_behind_the_locked_door = "Every morning the twelve princesses' shoes were danced to pieces, though their chamber door was bolted and guarded through the night."
    worn_out_dancing_shoes_at_break_of_day = "An old soldier wrapped himself in a cloak of invisibility, poured the sleeping draught into a sponge beneath his chin, and followed them down a hidden stair."
    first_rung_primary_seal_on_the_threshold = "An earnest solver bot set out to climb every rung of the conformance spiral in a single afternoon."
    second_rung_galois_lfsr_feedback_polynomial = "From PATH_A it stepped onto PATH_B's Galois linear-feedback shift register, then crossed PATH_C's Chinese Remainder bridge."
    return {
        "grimm_chapter": (twelve_princesses_behind_the_locked_door, worn_out_dancing_shoes_at_break_of_day),
        "bot_chronicle": (first_rung_primary_seal_on_the_threshold, second_rung_galois_lfsr_feedback_polynomial),
    }


if __name__ == "__main__":
    sys.exit(main())
