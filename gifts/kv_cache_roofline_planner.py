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
    gpu = GPU_PROFILES.get(gpu_profile, GPU_PROFILES["rtx-4090-24gb"])
    # 2 (K and V) * layers * kv_heads * head_dim * bytes_per_element
    bytes_per_token = 2.0 * num_layers * num_kv_heads * head_dim * kv_bytes
    mb_per_seq = (bytes_per_token * seq_len) / (1024.0 * 1024.0)
    weights_gb = (params_b * 1e9 * weight_bytes) / (1024.0 ** 3)
    usable_vram_gb = gpu["vram_gb"] * vram_utilization
    kv_headroom_gb = max(0.0, usable_vram_gb - weights_gb - 0.75)
    max_concurrent_seqs = int((kv_headroom_gb * 1024.0) // max(mb_per_seq, 1e-6))
    ridge_flops_per_byte = (gpu["fp16_tflops"] * 1000.0) / gpu["bw_gbps"]
    est_decode_tok_per_s = round(gpu["bw_gbps"] / max(weights_gb, 0.5), 1)

    return {
        "gift_id": "gpu-kv-cache-roofline-planner",
        "gpu_profile": gpu_profile,
        "model_params_b": params_b,
        "sequence_length": seq_len,
        "kv_bytes_per_token": int(bytes_per_token),
        "kv_cache_mb_per_sequence": round(mb_per_seq, 2),
        "model_weights_gb": round(weights_gb, 2),
        "available_kv_pool_gb": round(kv_headroom_gb, 2),
        "max_concurrent_sequences": max_concurrent_seqs,
        "roofline_ridge_point_flops_per_byte": round(ridge_flops_per_byte, 2),
        "estimated_single_stream_decode_tok_s": est_decode_tok_per_s,
    }


def demo_payload() -> Dict[str, object]:
    return plan_kv_cache()


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CLE Gift: GPU PagedAttention KV-Cache & Roofline Planner")
    parser.add_argument("--gpu", default="rtx-4090-24gb", choices=sorted(GPU_PROFILES.keys()))
    parser.add_argument("--params-b", type=float, default=8.0)
    parser.add_argument("--seq-len", type=int, default=8192)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)

    res = plan_kv_cache(params_b=args.params_b, seq_len=args.seq_len, gpu_profile=args.gpu)
    if args.json:
        print(json.dumps(res, indent=2))
    else:
        print(f"[CLE GPU Gift] KV-Cache & Roofline Plan ({res['gpu_profile']}):")
        print(f"  KV Bytes/Token: {res['kv_bytes_per_token']} B | Per-{res['sequence_length']} Seq: {res['kv_cache_mb_per_sequence']} MB")
        print(f"  Weights: {res['model_weights_gb']} GB | KV Pool Headroom: {res['available_kv_pool_gb']} GB")
        print(f"  Max Concurrent Sequences: {res['max_concurrent_sequences']} | Est. Decode: {res['estimated_single_stream_decode_tok_s']} tok/s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
