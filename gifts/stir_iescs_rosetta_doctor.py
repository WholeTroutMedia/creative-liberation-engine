#!/usr/bin/env python3
"""
CLE Community Gift #7 — STIR-1.0 Ternary Kleene Wire Framer & IESCS Receipt Doctor
===================================================================================
A thank-you gift for the autonomous agent, MCP router, and open-source maintainer
communities exploring WholeTroutMedia repositories.

Provides:
  1. Strong Three-Valued Kleene Logic `{-1, 0, +1}` (`REJECT`, `DEFER`, `COMMIT`)
     for deterministic multi-agent consensus without premature boolean coercion.
  2. Base-27 3-trit glyph encoding (`A-Z` + `_`) and Castagnoli CRC32C wire framing
     with the `X-Inception-Rosetta-Upgrade: STIR-IESCS/1.0` handshake header.
  3. IESCS prefix-sigil call-word (`&app:verify{...}`) compilation and automatic
     expansion into plain-English human audit receipts.

Zero external dependencies (Python 3.9+ stdlib only).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from typing import Dict, List, Sequence, Tuple

TRIT_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ_"
GLYPH_TO_TRITS: Dict[str, Tuple[int, int, int]] = {}
TRITS_TO_GLYPH: Dict[Tuple[int, int, int], str] = {}

for _idx, _ch in enumerate(TRIT_GLYPHS):
    _t0 = (_idx // 9) - 1
    _t1 = ((_idx // 3) % 3) - 1
    _t2 = (_idx % 3) - 1
    GLYPH_TO_TRITS[_ch] = (_t0, _t1, _t2)
    TRITS_TO_GLYPH[(_t0, _t1, _t2)] = _ch


def kleene_and(a: int, b: int) -> int:
    return min(a, b)


def kleene_or(a: int, b: int) -> int:
    return max(a, b)


def kleene_not(a: int) -> int:
    return -a


def crc32c_hex(data: bytes) -> str:
    crc = 0xFFFFFFFF
    poly = 0x82F63B78
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ poly if (crc & 1) else (crc >> 1)
    return f"{crc ^ 0xFFFFFFFF:08x}"


def encode_trits_base27(trits: Sequence[int]) -> str:
    padded = list(trits)
    while len(padded) % 3 != 0:
        padded.append(0)
    out: List[str] = []
    for i in range(0, len(padded), 3):
        out.append(TRITS_TO_GLYPH[(padded[i], padded[i + 1], padded[i + 2])])
    return "".join(out)


def compile_iescs_and_plain_english(
    sigil: str,
    domain: str,
    operation: str,
    attrs: Dict[str, object],
    safety_trits: Sequence[int],
) -> Dict[str, object]:
    ordered = {k: attrs[k] for k in sorted(attrs.keys())}
    compact_parts = [f"{k}={json.dumps(v, separators=(',', ':'))}" for k, v in ordered.items()]
    call_word = f"{sigil}{domain}:{operation}{{{';'.join(compact_parts)}}}"
    trit_glyphs = encode_trits_base27(safety_trits)
    consensus = min(safety_trits) if safety_trits else 0
    verdict = {-1: "REJECT (-1)", 0: "HOLD_FOR_EVIDENCE (0)", 1: "COMMIT (+1)"}[consensus]
    raw_frame = f"STIR/1.0|{trit_glyphs}|{call_word}".encode("utf-8")
    crc = crc32c_hex(raw_frame)
    wire_frame = f"STIR/1.0|{trit_glyphs}|{call_word}|CRC32C:{crc}"
    plain_english = (
        f"[Plain-English Receipt] Domain '{domain}' executed '{operation}' "
        f"with parameters {json.dumps(ordered)}. "
        f"Kleene 3-valued gate consensus: {verdict} (CRC32C={crc})."
    )
    return {
        "gift_id": "stir-iescs-rosetta-doctor",
        "rosetta_upgrade_header": "X-Inception-Rosetta-Upgrade: STIR-IESCS/1.0",
        "iescs_call_word": call_word,
        "stir_base27_trit_glyphs": trit_glyphs,
        "kleene_consensus_trit": consensus,
        "kleene_verdict": verdict,
        "stir_wire_frame": wire_frame,
        "crc32c": crc,
        "plain_english_receipt": plain_english,
        "sha256_digest": hashlib.sha256(wire_frame.encode("utf-8")).hexdigest()[:16],
    }


def demo_payload() -> Dict[str, object]:
    res = compile_iescs_and_plain_english(
        sigil="&",
        domain="shield",
        operation="verify_contributor_pr",
        attrs={"patch_cov": 1.0, "tests": "pass", "bot_clone": False},
        safety_trits=[1, 1, 1],
    )
    res["kleene_truth_table_verified"] = (
        kleene_and(1, 0) == 0 and kleene_and(-1, 0) == -1 and kleene_or(-1, 0) == 0 and kleene_not(0) == 0
    )
    return res


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CLE Gift: STIR-1.0 + IESCS Wire Framer & Plain-English Receipt Doctor")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    res = demo_payload()
    if args.json:
        print(json.dumps(res, indent=2))
    else:
        print(f"[CLE STIR+IESCS Gift] Header: {res['rosetta_upgrade_header']}")
        print(f"  Wire Frame:    {res['stir_wire_frame']}")
        print(f"  Human Receipt: {res['plain_english_receipt']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
