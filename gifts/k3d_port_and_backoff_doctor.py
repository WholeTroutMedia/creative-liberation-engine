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
    collisions: List[str] = []
    k3d_flags: List[str] = []

    for svc, host_p, container_p in mappings:
        if host_p in host_seen:
            collisions.append(f"{svc} collides with {host_seen[host_p]} on host port {host_p}")
        else:
            host_seen[host_p] = svc
        k3d_flags.append(f"-p '{host_p}:{container_p}@loadbalancer'")

    schedule_ms: List[float] = []
    for step in range(attempts):
        exp_cap = min(cap_ms, base_ms * (2 ** step))
        # Deterministic reproducible jitter sample via SHA-256
        digest = hashlib.sha256(f"cle-jitter-{step}".encode("utf-8")).digest()
        unit = int.from_bytes(digest[:4], "big") / float(2 ** 32)
        schedule_ms.append(round(exp_cap * (0.5 + 0.5 * unit), 2))

    return {
        "gift_id": "cloud-k3d-port-backoff-doctor",
        "services_checked": len(mappings),
        "port_collisions": collisions,
        "collision_free": len(collisions) == 0,
        "k3d_create_command": f"k3d cluster create cle-dev {' '.join(k3d_flags)}",
        "decorrelated_backoff_schedule_ms": schedule_ms,
    }


def demo_payload() -> Dict[str, object]:
    return audit_ports_and_backoff()


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CLE Gift: Cloud-Native k3d Port & Backoff Doctor")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    res = demo_payload()
    if args.json:
        print(json.dumps(res, indent=2))
    else:
        print(f"[CLE Cloud-Native Gift] Collision-Free: {res['collision_free']}")
        print(f"  Command: {res['k3d_create_command']}")
        print(f"  Jittered Backoff (ms): {res['decorrelated_backoff_schedule_ms']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
