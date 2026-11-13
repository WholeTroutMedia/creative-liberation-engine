# Thank You for Visiting · The CLE Community Gift Shelf (`v2.1.0`)

> **Live Ecosystem Pulse**: `36,033` Git clones from `5,005` unique cloners across `35` active repositories.

Whenever we notice developers, artists, or researchers from a technical community exploring or cloning our repositories, we build and drop a **free, standalone, zero-dependency Python tool** into [`gifts/`](./gifts/) (and wire it into `./bin/cle gifts`) as a thank-you gift.

Every tool in [`gifts/`](./gifts/) uses **100% Python standard library (`0` pip installs required)** so it runs locally on your own machine with zero external server dependencies.

---

## Quick Start

```bash
# List all 7 unlocked Community Gifts and the visitor domains that inspired them
./bin/cle gifts

# Run any Community Gift tool directly (with --json for pipelines)
./bin/cle gifts --run stir-iescs-rosetta-doctor
./bin/cle gifts --run spatial-3d-manifold-auditor
./bin/cle gifts --run gpu-kv-cache-roofline-planner --json
```

---

## Unlocked Community Gifts (Auto-Grown from Visitor Domains)

| Gift ID | Domain Community Honored | Free Standalone Tool | Quick Command |
| :--- | :--- | :--- | :--- |
| **`spatial-3d-manifold-auditor`** | **Spatial, 3D & WebGPU**<br/>_Three.js & WebGPU Discourse (`discourse.threejs.org`), Gyroflow & OpenHMD (15 repo clones / 15 unique cloners)_ | **[Watertight 3D Manifold, Winding-Order & Euler Characteristic Auditor](./gifts/spatial_manifold_auditor.py)** | `./bin/cle gifts --run spatial-3d-manifold-auditor` |
| **`gpu-kv-cache-roofline-planner`** | **GPU Kernels, Modular MAX & LLM Inference**<br/>_Modular Forum (`forum.modular.com` referrer), vLLM & PyTorch communities (9 direct fork clones / 9 unique cloners)_ | **[PagedAttention KV-Cache VRAM, GQA & Roofline Arithmetic Intensity Planner](./gifts/kv_cache_roofline_planner.py)** | `./bin/cle gifts --run gpu-kv-cache-roofline-planner` |
| **`async-utf8-sse-frame-doctor`** | **Async Python, ASGI & MCP Streaming**<br/>_Starlette, Uvicorn, Dramatiq & MCP builders (339 clones / 162 unique cloners across ASGI & sandbox repos)_ | **[Stateful Multi-Byte UTF-8 Chunk Boundary & WHATWG SSE Frame Doctor](./gifts/utf8_sse_frame_doctor.py)** | `./bin/cle gifts --run async-utf8-sse-frame-doctor` |
| **`creative-shader-palette-forge`** | **Creative Coding, Shaders & Generative Art**<br/>_Creative Liberation Engine, bsnes-hd & Obsidian/Logseq creative builders (927 clones / 361 unique cloners)_ | **[Inigo Quilez Procedural Cosine Palette & GLSL/WGSL Shader Snippet Forge](./gifts/cosine_palette_sdf_forge.py)** | `./bin/cle gifts --run creative-shader-palette-forge` |
| **`cloud-k3d-port-backoff-doctor`** | **Cloud-Native, Kubernetes & Distributed Systems**<br/>_k3d, ZIO, Mergo & Ecosystems distributed systems engineers (113 clones / 77 unique cloners)_ | **[k3d Local Cluster Port-Collision & Decorrelated-Jitter Backoff Doctor](./gifts/k3d_port_and_backoff_doctor.py)** | `./bin/cle gifts --run cloud-k3d-port-backoff-doctor` |
| **`db-savepoint-isolation-verifier`** | **Database ORM, Savepoints & Ledger Integrity**<br/>_InvenTree, Advanced-Alchemy, UNIT3D & Solana systems builders (568 clones / 116 unique cloners)_ | **[In-Memory SQLite Nested Savepoint & Double-Entry Idempotency Verifier](./gifts/savepoint_isolation_verifier.py)** | `./bin/cle gifts --run db-savepoint-isolation-verifier` |
| **`stir-iescs-rosetta-doctor`** | **Agentic Wire Protocols (STIR+IESCS) & Maintainer Shield**<br/>_Open-source maintainers, MCP builders & autonomous agent researchers (2762 clones / 655 unique cloners across Bounties, Sandbox & Micro-Tools)_ | **[STIR-1.0 Ternary Kleene Wire Framer, IESCS Call-Word Compiler & Plain-English Receipt Doctor](./gifts/stir_iescs_rosetta_doctor.py)** | `./bin/cle gifts --run stir-iescs-rosetta-doctor` |

---

## Companion Open-Source Workspaces

- **Website & Field Notes**: **[justinaharoni.com](https://justinaharoni.com)** · **[medium.com/@jaharoni](https://medium.com/@jaharoni)**
- **Open-Source Engineering Ledger & Bot-Shield (`v2.1`)**: **[`WholeTroutMedia/open-source-bounties`](https://github.com/WholeTroutMedia/open-source-bounties)**
- **Reference Micro-Utilities & STIR+IESCS SDK**: **[`WholeTroutMedia/open-source-micro-tools`](https://github.com/WholeTroutMedia/open-source-micro-tools)**
