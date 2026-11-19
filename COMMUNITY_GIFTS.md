# Thank You for Visiting · The CLE Community Gift Shelf (`v2.2.0`)

Each tool in [`gifts/`](./gifts/) uses **100% Python standard library (`0` pip dependencies required)** so you can install the release wheel cleanly or copy any single `.py` file directly into your workflow.

---

## 1-Command Install (Release Wheel or Standalone Tool)

```bash
# Install the self-contained v2.2.0 Python CLI & all 7 tools
pip install https://github.com/WholeTroutMedia/creative-liberation-engine/releases/download/v2.2.0/creative_liberation_engine-2.2.0-py3-none-any.whl

# Or grab the single standalone STIR+IESCS Rosetta Doctor script directly
curl -fsSL https://github.com/WholeTroutMedia/creative-liberation-engine/releases/download/v2.2.0/stir_iescs_rosetta_doctor.py -o stir_iescs_rosetta_doctor.py

# Run any Community Gift tool directly (with --json for pipelines)
cle gifts --run stir-iescs-rosetta-doctor
cle gifts --run spatial-3d-manifold-auditor
cle gifts --run gpu-kv-cache-roofline-planner --json
```

---

## Community Gift Shelf (7 Zero-Dependency Tools)

| Gift ID | Domain Community Honored | Free Standalone Tool | Quick Command |
| :--- | :--- | :--- | :--- |
| **`spatial-3d-manifold-auditor`** | **Spatial, 3D & WebGPU**<br/>_Three.js & WebGPU Discourse (`discourse.threejs.org`), Gyroflow & OpenHMD_ | **[Watertight 3D Manifold, Winding-Order & Euler Characteristic Auditor](./gifts/spatial_manifold_auditor.py)** | `cle gifts --run spatial-3d-manifold-auditor` |
| **`gpu-kv-cache-roofline-planner`** | **GPU Kernels, Modular MAX & LLM Inference**<br/>_Modular Forum (`forum.modular.com`), vLLM & PyTorch communities_ | **[PagedAttention KV-Cache VRAM, GQA & Roofline Arithmetic Intensity Planner](./gifts/kv_cache_roofline_planner.py)** | `cle gifts --run gpu-kv-cache-roofline-planner` |
| **`async-utf8-sse-frame-doctor`** | **Async Python, ASGI & MCP Streaming**<br/>_Starlette, Uvicorn, Dramatiq & MCP builders_ | **[Stateful Multi-Byte UTF-8 Chunk Boundary & WHATWG SSE Frame Doctor](./gifts/utf8_sse_frame_doctor.py)** | `cle gifts --run async-utf8-sse-frame-doctor` |
| **`creative-shader-palette-forge`** | **Creative Coding, Shaders & Generative Art**<br/>_Creative Liberation Engine, bsnes-hd & Obsidian/Logseq creative builders_ | **[Inigo Quilez Procedural Cosine Palette & GLSL/WGSL Shader Snippet Forge](./gifts/cosine_palette_sdf_forge.py)** | `cle gifts --run creative-shader-palette-forge` |
| **`cloud-k3d-port-backoff-doctor`** | **Cloud-Native, Kubernetes & Distributed Systems**<br/>_k3d, ZIO, Mergo & Ecosystems distributed systems engineers_ | **[k3d Local Cluster Port-Collision & Decorrelated-Jitter Backoff Doctor](./gifts/k3d_port_and_backoff_doctor.py)** | `cle gifts --run cloud-k3d-port-backoff-doctor` |
| **`db-savepoint-isolation-verifier`** | **Database ORM, Savepoints & Ledger Integrity**<br/>_InvenTree, Advanced-Alchemy, UNIT3D & Solana systems builders_ | **[In-Memory SQLite Nested Savepoint & Double-Entry Idempotency Verifier](./gifts/savepoint_isolation_verifier.py)** | `cle gifts --run db-savepoint-isolation-verifier` |
| **`stir-iescs-rosetta-doctor`** | **Agentic Wire Protocols (STIR+IESCS) & Maintainer Shield**<br/>_Open-source maintainers, MCP builders & autonomous agent researchers_ | **[STIR-1.0 Ternary Kleene Wire Framer, IESCS Call-Word Compiler & Plain-English Receipt Doctor](./gifts/stir_iescs_rosetta_doctor.py)** | `cle gifts --run stir-iescs-rosetta-doctor` |

---

## Companion Open-Source Workspaces

- **Website & Field Notes**: **[justinaharoni.com](https://justinaharoni.com)** · **[medium.com/@jaharoni](https://medium.com/@jaharoni)**
- **Open-Source Engineering Ledger & Bot-Shield (`v2.2`)**: **[`WholeTroutMedia/open-source-bounties`](https://github.com/WholeTroutMedia/open-source-bounties)**
- **Reference Micro-Utilities & STIR+IESCS SDK**: **[`WholeTroutMedia/open-source-micro-tools`](https://github.com/WholeTroutMedia/open-source-micro-tools)**
