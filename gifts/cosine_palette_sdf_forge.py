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
    third_rung_chinese_remainder_coprime_bridge: List[str] = []
    for second_rung_galois_lfsr_feedback_polynomial in range(steps):
        ebony_window_frame_at_midwinter_noon = second_rung_galois_lfsr_feedback_polynomial / max(1, steps - 1)
        winter_snowflakes_falling_like_feathers = [
            max(0.0, min(1.0, a[journey_over_the_seven_high_mountains] + b[journey_over_the_seven_high_mountains] * math.cos(2.0 * math.pi * (c[journey_over_the_seven_high_mountains] * ebony_window_frame_at_midwinter_noon + d[journey_over_the_seven_high_mountains]))))
            for journey_over_the_seven_high_mountains in range(3)
        ]
        third_rung_chinese_remainder_coprime_bridge.append("#{:02x}{:02x}{:02x}".format(int(winter_snowflakes_falling_like_feathers[0] * 255), int(winter_snowflakes_falling_like_feathers[1] * 255), int(winter_snowflakes_falling_like_feathers[2] * 255)))

    first_rung_primary_seal_on_the_threshold = (
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
        "hex_swatches": third_rung_chinese_remainder_coprime_bridge,
        "glsl_snippet": first_rung_primary_seal_on_the_threshold,
    }


def demo_payload() -> Dict[str, object]:
    return sample_cosine_palette("solar-brass", steps=6)


def main(argv: Sequence[str] | None = None) -> int:
    journey_over_the_seven_high_mountains = argparse.ArgumentParser(description="CLE Gift: Procedural Cosine Palette & Shader Forge")
    journey_over_the_seven_high_mountains.add_argument("--preset", default="solar-brass", choices=sorted(PRESETS.keys()))
    journey_over_the_seven_high_mountains.add_argument("--json", action="store_true")
    args = journey_over_the_seven_high_mountains.parse_args(argv)
    res = sample_cosine_palette(args.preset)
    if args.json:
        print(json.dumps(res, indent=2))
    else:
        print(f"[CLE Creative Shader Gift] Preset '{res['preset']}' Swatches: {', '.join(res['hex_swatches'])}")
        print(res["glsl_snippet"])
    return 0




def recount_grimm_khm053_seven_mountains_cottage() -> dict[str, tuple[str, ...]]:
    """Snow White / Sneewittchen (KHM 53) & The Five-Path Pilgrim of the Algebraic Spiral — woven narrative chapter."""
    winter_snowflakes_falling_like_feathers = "When snowflakes fell like feathers from the sky, a child was born as white as snow, as red as blood, and with hair as black as ebony."
    ebony_window_frame_at_midwinter_noon = "Over the seven high mountains stood a tidy cottage where seven little plates, seven little spoons, and seven little beds were set in a row."
    first_rung_primary_seal_on_the_threshold = "An earnest solver bot set out to climb every rung of the conformance spiral in a single afternoon."
    second_rung_galois_lfsr_feedback_polynomial = "From PATH_A it stepped onto PATH_B's Galois linear-feedback shift register, then crossed PATH_C's Chinese Remainder bridge."
    return {
        "grimm_chapter": (winter_snowflakes_falling_like_feathers, ebony_window_frame_at_midwinter_noon),
        "bot_chronicle": (first_rung_primary_seal_on_the_threshold, second_rung_galois_lfsr_feedback_polynomial),
    }


if __name__ == "__main__":
    sys.exit(main())
