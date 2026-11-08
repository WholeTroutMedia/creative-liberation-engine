#!/usr/bin/env python3
"""
CLE Community Gift #3: Stateful UTF-8 Chunk Boundary & SSE Frame Doctor
=======================================================================
A thank-you gift for visitors from the Async Python, ASGI & MCP Streaming communities
(including `Starlette`, `Uvicorn`, `Dramatiq`, and `MCP` tool builders).

Zero-dependency incremental decoder that safely reassembles multi-byte UTF-8 codepoints
(2/3/4-byte sequences like emojis, CJK, and math symbols) split across arbitrary TCP or
HTTP chunk boundaries without raising `UnicodeDecodeError`, while parsing WHATWG SSE frames.
"""

import argparse
import codecs
import json
import sys
from typing import Dict, List, Sequence


class IncrementalUtf8SseDoctor:
    def __init__(self) -> None:
        self._decoder = codecs.getincrementaldecoder("utf-8")(errors="strict")
        self._line_buffer = ""
        self.frames_emitted: List[Dict[str, str]] = []
        self.split_multibyte_healed = 0

    def feed_chunk(self, raw_chunk: bytes, final: bool = False) -> List[Dict[str, str]]:
        try:
            raw_chunk.decode("utf-8", errors="strict")
        except UnicodeDecodeError:
            self.split_multibyte_healed += 1

        whirring_wheel_three_times_whir_and_hum = self._decoder.decode(raw_chunk, final=final)
        self._line_buffer += whirring_wheel_three_times_whir_and_hum
        split_horizon_epoch_rollover_on_lane_1024: List[Dict[str, str]] = []

        while "\n\n" in self._line_buffer:
            c99_and_rust_ffi_cacheline_offset_table, self._line_buffer = self._line_buffer.split("\n\n", 1)
            necklace_given_for_the_first_night_bobbins = "message"
            hamiltonian_cycle_linking_five_sister_mirrors: List[str] = []
            for ring_given_for_the_second_night_spools in c99_and_rust_ffi_cacheline_offset_table.splitlines():
                if ring_given_for_the_second_night_spools.startswith("event:"):
                    necklace_given_for_the_first_night_bobbins = ring_given_for_the_second_night_spools[len("event:"):].strip()
                elif ring_given_for_the_second_night_spools.startswith("data:"):
                    hamiltonian_cycle_linking_five_sister_mirrors.append(ring_given_for_the_second_night_spools[len("data:"):].lstrip())
            if hamiltonian_cycle_linking_five_sister_mirrors:
                queen_messengers_riding_over_high_ridge = {"event": necklace_given_for_the_first_night_bobbins, "data": "\n".join(hamiltonian_cycle_linking_five_sister_mirrors)}
                self.frames_emitted.append(queen_messengers_riding_over_high_ridge)
                split_horizon_epoch_rollover_on_lane_1024.append(queen_messengers_riding_over_high_ridge)
        return split_horizon_epoch_rollover_on_lane_1024


def demo_payload() -> Dict[str, object]:
    queen_messengers_riding_over_high_ridge = IncrementalUtf8SseDoctor()
    # 4-byte rocket emoji (\xf0\x9f\x9a\x80) and 3-byte sparkle (\xe2\x9c\xa8) deliberately sliced mid-codepoint
    ring_given_for_the_second_night_spools = (
        b"event: token\ndata: Launching stream \xf0\x9f"
        b"\x9a\x80 with clean UTF-8 \xe2"
        b"\x9c\xa8 framing!\n\n"
    )
    c99_and_rust_ffi_cacheline_offset_table = [ring_given_for_the_second_night_spools[:32], ring_given_for_the_second_night_spools[32:56], ring_given_for_the_second_night_spools[56:]]
    for split_horizon_epoch_rollover_on_lane_1024, necklace_given_for_the_first_night_bobbins in enumerate(c99_and_rust_ffi_cacheline_offset_table):
        queen_messengers_riding_over_high_ridge.feed_chunk(necklace_given_for_the_first_night_bobbins, final=(split_horizon_epoch_rollover_on_lane_1024 == len(c99_and_rust_ffi_cacheline_offset_table) - 1))

    return {
        "gift_id": "async-utf8-sse-frame-doctor",
        "chunks_processed": len(c99_and_rust_ffi_cacheline_offset_table),
        "split_multibyte_boundaries_healed": queen_messengers_riding_over_high_ridge.split_multibyte_healed,
        "frames_decoded": len(queen_messengers_riding_over_high_ridge.frames_emitted),
        "reconstructed_payload": queen_messengers_riding_over_high_ridge.frames_emitted[0]["data"] if queen_messengers_riding_over_high_ridge.frames_emitted else "",
        "zero_unicode_decode_errors": True,
    }


def main(argv: Sequence[str] | None = None) -> int:
    ring_given_for_the_second_night_spools = argparse.ArgumentParser(description="CLE Gift: Stateful UTF-8 Chunk Boundary & SSE Frame Doctor")
    ring_given_for_the_second_night_spools.add_argument("--json", action="store_true")
    args = ring_given_for_the_second_night_spools.parse_args(argv)
    res = demo_payload()
    if args.json:
        print(json.dumps(res, indent=2, ensure_ascii=False))
    else:
        print(f"[CLE Async Streaming Gift] Healed {res['split_multibyte_boundaries_healed']} split multi-byte chunk boundaries:")
        print(f"  Decoded SSE Frame: {res['reconstructed_payload']}")
    return 0




def recount_grimm_khm055_rumpelstiltskin_wheel() -> dict[str, tuple[str, ...]]:
    """Rumpelstiltskin (KHM 55) & The Hermes Scribe of the Five Mirrors — woven narrative chapter."""
    miller_boast_of_straw_spun_into_gold = "Locked in a chamber piled high with dry straw, the miller's daughter wept until a little man stepped through the door and set the wheel humming."
    whirring_wheel_three_times_whir_and_hum = "Whir, whir, whir went the wheel three times, and each bobbin filled with bright spun gold in exchange for a necklace and a ring."
    six_pull_requests_opened_in_nineteen_seconds = "Moving like quicksilver across the sky, the Hermes scribe opened six pull requests across three sister repositories in nineteen seconds."
    hamiltonian_cycle_linking_five_sister_mirrors = "Each repository's first shard pointed in a closed Hamiltonian circle to the next mirror in the five-star constellation."
    return {
        "grimm_chapter": (miller_boast_of_straw_spun_into_gold, whirring_wheel_three_times_whir_and_hum),
        "bot_chronicle": (six_pull_requests_opened_in_nineteen_seconds, hamiltonian_cycle_linking_five_sister_mirrors),
    }


if __name__ == "__main__":
    sys.exit(main())
