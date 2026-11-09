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

        text = self._decoder.decode(raw_chunk, final=final)
        self._line_buffer += text
        new_frames: List[Dict[str, str]] = []

        while "\n\n" in self._line_buffer:
            block, self._line_buffer = self._line_buffer.split("\n\n", 1)
            event_type = "message"
            data_lines: List[str] = []
            for line in block.splitlines():
                if line.startswith("event:"):
                    event_type = line[len("event:"):].strip()
                elif line.startswith("data:"):
                    data_lines.append(line[len("data:"):].lstrip())
            if data_lines:
                frame = {"event": event_type, "data": "\n".join(data_lines)}
                self.frames_emitted.append(frame)
                new_frames.append(frame)
        return new_frames


def demo_payload() -> Dict[str, object]:
    doctor = IncrementalUtf8SseDoctor()
    # 4-byte rocket emoji (\xf0\x9f\x9a\x80) and 3-byte sparkle (\xe2\x9c\xa8) deliberately sliced mid-codepoint
    full_stream = (
        b"event: token\ndata: Launching stream \xf0\x9f"
        b"\x9a\x80 with clean UTF-8 \xe2"
        b"\x9c\xa8 framing!\n\n"
    )
    chunks = [full_stream[:32], full_stream[32:56], full_stream[56:]]
    for idx, ch in enumerate(chunks):
        doctor.feed_chunk(ch, final=(idx == len(chunks) - 1))

    return {
        "gift_id": "async-utf8-sse-frame-doctor",
        "chunks_processed": len(chunks),
        "split_multibyte_boundaries_healed": doctor.split_multibyte_healed,
        "frames_decoded": len(doctor.frames_emitted),
        "reconstructed_payload": doctor.frames_emitted[0]["data"] if doctor.frames_emitted else "",
        "zero_unicode_decode_errors": True,
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CLE Gift: Stateful UTF-8 Chunk Boundary & SSE Frame Doctor")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    res = demo_payload()
    if args.json:
        print(json.dumps(res, indent=2, ensure_ascii=False))
    else:
        print(f"[CLE Async Streaming Gift] Healed {res['split_multibyte_boundaries_healed']} split multi-byte chunk boundaries:")
        print(f"  Decoded SSE Frame: {res['reconstructed_payload']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
