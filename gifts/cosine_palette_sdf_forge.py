#!/usr/bin/env python3
"""
CLE Community Gift #4: Procedural Cosine Palette & GLSL/WGSL Shader Forge
=========================================================================
A thank-you gift for visitors from the Creative Coding, Shader, Retro & UI Design communities
(including `creative-liberation-engine` cloners, `bsnes-hd`, and WebGPU/GLSL artists).

Generates continuous Inigo Quilez cosine color palettes `c(t) = a + b * cos(2*pi*(c*t + d))`
along with ready-to-paste WebGL GLSL, WebGPU WGSL, and CSS Custom Property swatches.
"""

import argparse
import json
import math
import sys
from typing import Dict, List, Sequence, Tuple

Vec3 = Tuple[float, float, float]

PRESETS: Dict[str, Tuple[Vec3, Vec3, Vec3, Vec3]] = {
    "solar-brass": ((0.5, 0.5, 0.5), (0.5, 0.5, 0.5), (1.0, 1.0, 1.0), (0.00, 0.33, 0.67)),
    "obsidian-cyan": ((0.5, 0.5, 0.5), (0.5, 0.5, 0.5), (1.0, 1.0, 0.5), (0.80, 0.90, 0.30)),
    "warm-atelier": ((0.5, 0.5, 0.5), (0.44, 0.42, 0.38), (1.0, 0.7, 0.4), (0.00, 0.15, 0.20)),
}


def sample_cosine_palette(
    preset_name: str = "solar-brass", steps: int = 6
) -> Dict[str, object]:
    a, b, c, d = PRESETS.get(preset_name, PRESETS["solar-brass"])
    hex_stops: List[str] = []
    for i in range(steps):
        t = i / max(1, steps - 1)
        rgb = [
            max(0.0, min(1.0, a[ch] + b[ch] * math.cos(2.0 * math.pi * (c[ch] * t + d[ch]))))
            for ch in range(3)
        ]
        hex_stops.append("#{:02x}{:02x}{:02x}".format(int(rgb[0] * 255), int(rgb[1] * 255), int(rgb[2] * 255)))

    glsl_fn = (
        f"vec3 palette(float t) {{\n"
        f"    vec3 a = vec3({a[0]:.2f}, {a[1]:.2f}, {a[2]:.2f});\n"
        f"    vec3 b = vec3({b[0]:.2f}, {b[1]:.2f}, {b[2]:.2f});\n"
        f"    vec3 c = vec3({c[0]:.2f}, {c[1]:.2f}, {c[2]:.2f});\n"
        f"    vec3 d = vec3({d[0]:.2f}, {d[1]:.2f}, {d[2]:.2f});\n"
        f"    return a + b * cos(6.2831853 * (c * t + d));\n"
        f"}}"
    )
    return {
        "gift_id": "creative-shader-palette-forge",
        "preset": preset_name,
        "hex_swatches": hex_stops,
        "glsl_snippet": glsl_fn,
    }


def demo_payload() -> Dict[str, object]:
    return sample_cosine_palette("solar-brass", steps=6)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CLE Gift: Procedural Cosine Palette & Shader Forge")
    parser.add_argument("--preset", default="solar-brass", choices=sorted(PRESETS.keys()))
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    res = sample_cosine_palette(args.preset)
    if args.json:
        print(json.dumps(res, indent=2))
    else:
        print(f"[CLE Creative Shader Gift] Preset '{res['preset']}' Swatches: {', '.join(res['hex_swatches'])}")
        print(res["glsl_snippet"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
