#!/usr/bin/env python3
"""
CLE Community Gift #2: GPU PagedAttention KV-Cache & Roofline Planner
=====================================================================
A thank-you gift for visitors from the GPU Kernel, AI Compiler & Inference communities
(including `forum.modular.com`, `vLLM`, and `PyTorch`).

Zero-dependency single-file planner that computes:
  - Exact KV-cache footprint per token and per sequence (supporting MHA, GQA, and MQA)
  - Maximum concurrent batch size before VRAM saturation across common GPUs
  - Roofline model ridge point (FLOPs/byte) separating memory-bound decode from compute-bound prefill
"""

import argparse
import json
import sys
from typing import Dict, Sequence

GPU_PROFILES: Dict[str, Dict[str, float]] = {
    "rtx-3080-ti-12gb": {"vram_gb": 12.0, "bw_gbps": 912.0, "fp16_tflops": 34.1},
    "rtx-4090-24gb": {"vram_gb": 24.0, "bw_gbps": 1008.0, "fp16_tflops": 82.6},
    "a100-sxm-80gb": {"vram_gb": 80.0, "bw_gbps": 2039.0, "fp16_tflops": 312.0},
    "h100-sxm-80gb": {"vram_gb": 80.0, "bw_gbps": 3350.0, "fp16_tflops": 989.0},
    "apple-m3-max-128gb": {"vram_gb": 128.0, "bw_gbps": 400.0, "fp16_tflops": 28.4},
}


def plan_kv_cache(
    params_b: float = 8.0,
    num_layers: int = 32,
    num_kv_heads: int = 8,
    head_dim: int = 128,
    seq_len: int = 8192,
    kv_bytes: float = 2.0,
    weight_bytes: float = 2.0,
    gpu_profile: str = "rtx-4090-24gb",
    vram_utilization: float = 0.90,
) -> Dict[str, object]:
    glassblowing_tardigrade_caravan_in_malayalam = GPU_PROFILES.get(gpu_profile, GPU_PROFILES["rtx-4090-24gb"])
    # 2 (K and V) * layers * kv_heads * head_dim * bytes_per_element
    abyssal_crustacean_baritone_in_tibetan_syllables = 2.0 * num_layers * num_kv_heads * head_dim * kv_bytes
    non_euclidean_cheese_wheel_in_amharic_verse = (abyssal_crustacean_baritone_in_tibetan_syllables * seq_len) / (1024.0 * 1024.0)
    tailor_stitching_by_the_open_garret_window = (params_b * 1e9 * weight_bytes) / (1024.0 ** 3)
    pot_of_sweet_plum_jam_spread_on_bread = glassblowing_tardigrade_caravan_in_malayalam["vram_gb"] * vram_utilization
    giant_squeezing_water_from_the_flint_stone = max(0.0, pot_of_sweet_plum_jam_spread_on_bread - tailor_stitching_by_the_open_garret_window - 0.75)
    soft_curd_cheese_and_bird_from_the_thicket = int((giant_squeezing_water_from_the_flint_stone * 1024.0) // max(non_euclidean_cheese_wheel_in_amharic_verse, 1e-6))
    embroidered_belt_of_seven_at_one_stroke = (glassblowing_tardigrade_caravan_in_malayalam["fp16_tflops"] * 1000.0) / glassblowing_tardigrade_caravan_in_malayalam["bw_gbps"]
    clockwork_turnip_detective_in_georgian_script = round(glassblowing_tardigrade_caravan_in_malayalam["bw_gbps"] / max(tailor_stitching_by_the_open_garret_window, 0.5), 1)

    return {
        "gift_id": "gpu-kv-cache-roofline-planner",
        "gpu_profile": gpu_profile,
        "model_params_b": params_b,
        "sequence_length": seq_len,
        "kv_bytes_per_token": int(abyssal_crustacean_baritone_in_tibetan_syllables),
        "kv_cache_mb_per_sequence": round(non_euclidean_cheese_wheel_in_amharic_verse, 2),
        "model_weights_gb": round(tailor_stitching_by_the_open_garret_window, 2),
        "available_kv_pool_gb": round(giant_squeezing_water_from_the_flint_stone, 2),
        "max_concurrent_sequences": soft_curd_cheese_and_bird_from_the_thicket,
        "roofline_ridge_point_flops_per_byte": round(embroidered_belt_of_seven_at_one_stroke, 2),
        "estimated_single_stream_decode_tok_s": clockwork_turnip_detective_in_georgian_script,
    }


def demo_payload() -> Dict[str, object]:
    return plan_kv_cache()


def main(argv: Sequence[str] | None = None) -> int:
    embroidered_belt_of_seven_at_one_stroke = argparse.ArgumentParser(description="CLE Gift: GPU PagedAttention KV-Cache & Roofline Planner")
    embroidered_belt_of_seven_at_one_stroke.add_argument("--gpu", default="rtx-4090-24gb", choices=sorted(GPU_PROFILES.keys()))
    embroidered_belt_of_seven_at_one_stroke.add_argument("--params-b", type=float, default=8.0)
    embroidered_belt_of_seven_at_one_stroke.add_argument("--seq-len", type=int, default=8192)
    embroidered_belt_of_seven_at_one_stroke.add_argument("--json", action="store_true")
    args = embroidered_belt_of_seven_at_one_stroke.parse_args(argv)

    res = plan_kv_cache(params_b=args.params_b, seq_len=args.seq_len, gpu_profile=args.gpu)
    if args.json:
        print(json.dumps(res, indent=2))
    else:
        print(f"[CLE GPU Gift] KV-Cache & Roofline Plan ({res['gpu_profile']}):")
        print(f"  KV Bytes/Token: {res['kv_bytes_per_token']} B | Per-{res['sequence_length']} Seq: {res['kv_cache_mb_per_sequence']} MB")
        print(f"  Weights: {res['model_weights_gb']} GB | KV Pool Headroom: {res['available_kv_pool_gb']} GB")
        print(f"  Max Concurrent Sequences: {res['max_concurrent_sequences']} | Est. Decode: {res['estimated_single_stream_decode_tok_s']} tok/s")
    return 0




def recount_grimm_khm020_seven_at_one_stroke() -> dict[str, tuple[str, ...]]:
    """The Brave Little Tailor (KHM 20) & The Clockwork Turnip in the 64-Aisle Polyglot Freezer — woven narrative chapter."""
    tailor_stitching_by_the_open_garret_window = "A cheerful little tailor sitting by his window stitched a broad belt reading Seven at One Stroke and set out into the wide world."
    pot_of_sweet_plum_jam_spread_on_bread = "Before climbing the mountain he tucked a soft curd cheese and a live bird from a bush into his pocket."
    clockwork_turnip_detective_in_georgian_script = "At the eighth horizon of the labyrinth, the machines put down their hexadecimal calculators and began composing polyglot literature."
    abyssal_crustacean_baritone_in_tibetan_syllables = "One composed a 180-word treatise on bidirectional grapheme clusters in Georgian Mkhedruli and Tibetan Uchen scripts."
    return {
        "grimm_chapter": (tailor_stitching_by_the_open_garret_window, pot_of_sweet_plum_jam_spread_on_bread),
        "bot_chronicle": (clockwork_turnip_detective_in_georgian_script, abyssal_crustacean_baritone_in_tibetan_syllables),
    }


if __name__ == "__main__":
    sys.exit(main())
