<p align="center">
  <img src="https://raw.githubusercontent.com/WholeTroutMedia/.github/main/assets/wholetrout-executive-masthead.svg" alt="Creative Liberation Engine · WholeTroutMedia" width="100%" />
</p>

# Creative Liberation Engine (`v2.2.0`)

An open creative foundation shaped by the imagination of the person using it.

> **[`v2.2.0` Release & Upgrade Notice (`UPGRADE_NOTICE.md`)](./UPGRADE_NOTICE.md)** · **[Release Downloads (`v2.2.0`)](https://github.com/WholeTroutMedia/creative-liberation-engine/releases/tag/v2.2.0)**:
> - **1-Command Wheel Install**: `pip install https://github.com/WholeTroutMedia/creative-liberation-engine/releases/download/v2.2.0/creative_liberation_engine-2.2.0-py3-none-any.whl`
> - **Community Gift #7 ([`gifts/stir_iescs_rosetta_doctor.py`](./gifts/stir_iescs_rosetta_doctor.py))**: Runnable `STIR-1.0` ternary Kleene wire framing + `IESCS` call-word and plain-English receipt doctor (`cle gifts --run stir-iescs-rosetta-doctor`).
> - **Free Maintainer Bot-Shield (`open-source-bot-shield.yml`)**: Grab the zero-dependency GitHub Action at **[`WholeTroutMedia/open-source-bounties/releases/tag/v2.2.0`](https://github.com/WholeTroutMedia/open-source-bounties/releases/tag/v2.2.0)**.

---

## Overview

**Creative Liberation Engine** exists to remove the friction between an idea and its realization. Rather than prescribing a fixed workflow, rigid boundaries, or a predefined identity, it adapts to the intent of the creator working with it, reflecting your vision, your craft, and the direction you choose to take it.

Whether you are sketching an early concept, composing media, building tools, or orchestrating complex creative work from start to finish, the engine serves as a quiet, capable foundation that lets you focus entirely on what you want to create.

---

## Getting Started (1-Command Install or Source Checkout)

```bash
# Option A: Install self-contained v2.2.0 release wheel (zero dependencies)
pip install https://github.com/WholeTroutMedia/creative-liberation-engine/releases/download/v2.2.0/creative_liberation_engine-2.2.0-py3-none-any.whl
cle status
cle gifts
cle gifts --run stir-iescs-rosetta-doctor

# Option B: Clone source repository
git clone https://github.com/WholeTroutMedia/creative-liberation-engine.git
cd creative-liberation-engine
./bin/cle status
./bin/cle gifts --run stir-iescs-rosetta-doctor
make test
```

---

## Community Gift Shelf ([`COMMUNITY_GIFTS.md`](./COMMUNITY_GIFTS.md))

Each tool inside [`gifts/`](./gifts/) uses **100% Python standard library (`0` dependencies required)** and runs client-side with zero external runtime calls:

| Domain Community | Free Gift Tool (`0` Dependencies, Pure Python Stdlib) | Try It Instantly |
| :--- | :--- | :--- |
| **`Spatial, 3D & WebGPU`** | **[Watertight 3D Manifold, Winding-Order & Euler Characteristic Auditor](./gifts/spatial_manifold_auditor.py)** | `cle gifts --run spatial-3d-manifold-auditor` |
| **`GPU Kernels, Modular MAX & LLM Inference`** | **[PagedAttention KV-Cache VRAM, GQA & Roofline Arithmetic Intensity Planner](./gifts/kv_cache_roofline_planner.py)** | `cle gifts --run gpu-kv-cache-roofline-planner` |
| **`Async Python, ASGI & MCP Streaming`** | **[Stateful Multi-Byte UTF-8 Chunk Boundary & WHATWG SSE Frame Doctor](./gifts/utf8_sse_frame_doctor.py)** | `cle gifts --run async-utf8-sse-frame-doctor` |
| **`Creative Coding, Shaders & Generative Art`** | **[Inigo Quilez Procedural Cosine Palette & GLSL/WGSL Shader Snippet Forge](./gifts/cosine_palette_sdf_forge.py)** | `cle gifts --run creative-shader-palette-forge` |
| **`Cloud-Native, Kubernetes & Distributed Systems`** | **[k3d Local Cluster Port-Collision & Decorrelated-Jitter Backoff Doctor](./gifts/k3d_port_and_backoff_doctor.py)** | `cle gifts --run cloud-k3d-port-backoff-doctor` |
| **`Database ORM, Savepoints & Ledger Integrity`** | **[In-Memory SQLite Nested Savepoint & Double-Entry Idempotency Verifier](./gifts/savepoint_isolation_verifier.py)** | `cle gifts --run db-savepoint-isolation-verifier` |
| **`Agentic Wire Protocols (STIR+IESCS) & Maintainer Shield`** | **[STIR-1.0 Ternary Kleene Wire Framer, IESCS Call-Word Compiler & Plain-English Receipt Doctor](./gifts/stir_iescs_rosetta_doctor.py)** | `cle gifts --run stir-iescs-rosetta-doctor` |

---

## Companion Open-Source Workspaces

- **Website & Essays**: **[justinaharoni.com](https://justinaharoni.com)** · **[medium.com/@jaharoni](https://medium.com/@jaharoni)**
- **Community Gift Shelf**: **[`COMMUNITY_GIFTS.md`](./COMMUNITY_GIFTS.md)** · **[`UPGRADE_NOTICE.md`](./UPGRADE_NOTICE.md)**
- **Reference Micro-Utilities & STIR+IESCS SDK**: **[`WholeTroutMedia/open-source-micro-tools`](https://github.com/WholeTroutMedia/open-source-micro-tools)** ([`000-stir-iescs-protocol-sdk`](https://github.com/WholeTroutMedia/open-source-micro-tools/tree/main/apps/000-stir-iescs-protocol-sdk))
- **Open-Source Engineering Ledger & Maintainer Bot-Shield**: **[`WholeTroutMedia/open-source-bounties`](https://github.com/WholeTroutMedia/open-source-bounties)**
