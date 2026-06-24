# GPU Growth Plan — Creative Liberation Engine V6

> **Version:** 1.0.0  
> **Source:** Article #12 — Kimi K2.6, Article #6 — MultiWorld, Article #8 — OpenCode  
> **Date:** 2026-04-22

---

## Current Hardware Profile

| Component | Spec | Capacity |
|-----------|------|----------|
| **GPU** | NVIDIA RTX 4090 (24GB VRAM) | Single-model inference up to ~34B parameters (Q4) |
| **CPU** | AMD Ryzen 9 5950X (16c/32t) | CPU offloading for models exceeding VRAM |
| **System RAM** | 128GB DDR4 | Supports GPU+CPU split inference for larger models |
| **NAS Storage** | UGREEN DXP6800 Pro | ~80TB usable — model storage is not a constraint |

---

## Current Model Fleet vs VRAM Budget

| Model | Active Params | VRAM (Q4) | Status |
|-------|-------------|-----------|--------|
| Gemma 4 e2b | 2B | ~2 GB | ✅ Fits comfortably |
| Gemma 4 26b | 26B | ~16 GB | ✅ Fits, tight with context |
| Qwen 2.5-Coder 7b | 7B | ~5 GB | ✅ Fits comfortably |
| Qwen 2.5-Coder 32b | 32B | ~20 GB | ⚠️ Fits at Q4, limited context |
| LLaVA 34b | 34B | ~22 GB | ⚠️ Fits at Q4, minimal headroom |
| Nomic Embed Text | <1B | ~0.5 GB | ✅ Trivial |
| LeWM 15M | 15M | ~0.1 GB | ✅ Trivial |

**Key constraint:** Only one large model (26B+) can be loaded at a time. Context window trades directly against model size in VRAM.

---

## Growth Thresholds

### Milestone 1 — Second GPU (Budget: ~$1,500-$2,000)
**Trigger:** When concurrent model loading becomes a production bottleneck  
**Upgrade:** Add second RTX 4090 or RTX 5090 (when available)

**Unlocks:**
- Two 32B models loaded simultaneously (code + vision)
- Extended context windows (128K+) on 26B models
- Multi-model consensus workflows without model swapping latency

### Milestone 2 — Multi-GPU Inference (Budget: ~$3,000-$5,000)
**Trigger:** When model sizes exceed single-GPU capacity  
**Upgrade:** 2x RTX 5090 (48GB each) or 2x RTX 4090 with NVLink bridge

**Unlocks:**
- 70B+ models (Llama 3 70B, DeepSeek R2 67B) running locally
- K2.6 evaluation (32B active MoE — theoretically feasible with 48GB VRAM)
- MultiWorld multi-view inference at production quality

### Milestone 3 — Cloud Burst Integration (Budget: Variable)
**Trigger:** When peak demand exceeds local GPU capacity  
**Upgrade:** Cloud GPU burst via RunPod, Vast.ai, or Lambda Labs

**Unlocks:**
- Temporary 8xA100 or H100 access for training/fine-tuning
- Large-batch inference during production crunch periods
- K2.6 full evaluation without permanent hardware investment

### Milestone 4 — NAS GPU Module (Budget: $2,000-$4,000)
**Trigger:** When inference needs to run on NAS without workstation dependency  
**Upgrade:** External GPU enclosure (Thunderbolt) connected to NAS, or dedicated inference server

**Unlocks:**
- 24/7 inference without workstation being powered on
- Long-horizon agent operation (dispatch tasks run on NAS GPU, not workstation)
- True always-on autonomous agent capability

---

## K2.6 Specific Assessment

**Kimi K2.6 Profile:**
- Architecture: 1T parameter MoE
- Active parameters: 32B per token
- License: Modified MIT (open weights)

**Can we run it now?**
- 32B active params → ~20GB VRAM at Q4 → Technically fits on RTX 4090
- BUT: Full MoE weights (1T params, even sparse) require loading all experts into memory
- Estimated storage: ~500GB+ for full weights
- Estimated VRAM for expert routing: Unknown — depends on implementation

**Decision:** ❌ Deferred to Milestone 2 (Multi-GPU) or Milestone 3 (Cloud Burst)

**Evaluation path when ready:**
1. Download weights from HuggingFace
2. Quantize to Q4/Q5 using llama.cpp or vLLM
3. Test single-GPU inference with CPU offloading (128GB RAM available)
4. If successful: register in model registry as `local:orchestration` tier
5. Benchmark against Gemma 4 26b on agent-coordination tasks

---

## Model Registry Evolution

As VRAM grows, the model registry expands:

```
v6.2 (now)     → 16 tiers, single-GPU, model swapping
v6.3 (M1)      → +concurrent loading, +multi-model consensus tier
v6.4 (M2)      → +70B models, +K2.6 evaluation tier
v6.5 (M3)      → +cloud burst tier, +training/fine-tuning tier
v6.6 (M4)      → +always-on inference, +long-horizon agent tier
```

Each milestone is hardware-gated, not software-gated. The registry schema and routing contracts already support these tiers — they just need the VRAM to back them.
