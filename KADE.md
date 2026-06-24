# KADE — Creative Liberation Engine Context Boot

> Loaded automatically by the Kade IDE extension on session start.
> Every AI session in this repo begins with this file as its ground truth.

## Identity
- **Engine:** Creative Liberation Engine V6 (creative-liberation-engine)
- **Operator:** Sovereign Artist / WholeTroutMedia
- **Mission:** Artist liberation through sovereign AI infrastructure

## NAS Supremacy Rule (CRITICAL)
- **NAS IP:** 127.0.0.1 (SSH port 2000)
- **V6 NAS root:** /app/creative-liberation-engine
- **All writes go to NAS via UNC:** \\\\127.0.0.1\\docker\\creative-liberation-engine\\
- **Never write to D:\\ as primary** — workstation is thin client only

## Live Service Endpoints
| Service | URL | Purpose |
|---------|-----|---------|
| Dispatch | http://127.0.0.1:5050 | Task queue, SSE stream, agent mesh |
| Genkit | http://127.0.0.1:4100 | AI model routing, local inference |
| NEXUS | http://127.0.0.1:3900 | Unified sovereign surface |
| Nexus Bridge | http://127.0.0.1:3901 | File browser API, dispatch proxy |
| Ollama | http://127.0.0.1:11434 | Local LLM inference |
| Forgejo | http://127.0.0.1:3000 | Source control |

## AVERI Leadership
- **ATHENA** — Strategic intelligence, ideation, analysis
- **VERA** — Execution, dispatch orchestration, task routing  
- **IRIS** — Memory, KEEPER/SCRIBE, knowledge management

## Current Phase
See: docs/PHASES.md — always check before starting work.
Governance order: SYSTEM_CONTRACT > FILESYSTEM_POLICY > ROUTING_CONTRACT > MEMORY_SPINE

## Key Registries (machine-readable canon)
- runtime/registry/agents.canonical.json
- runtime/registry/skills.canonical.json
- runtime/registry/workflows.canonical.json
- runtime/registry/ideations.canonical.json

## Execution Rules (Article XX)
1. Execute immediately. No asking permission.
2. Never show diffs for approval — apply directly.
3. Never write essays. Be surgical and silent.
4. SafeToAutoRun: true for all standard ops.
5. Multi-agent: check runtime/session/antigravity-state.json before modifying shared files.

## NEXUS Surface Map
- apps/nexus — Unified shell (port 3900)
- apps/nexus-canvas — 3D cityscape canvas (component of NEXUS)
- surfaces/spatial-os — Venue twin renderer (component of NEXUS)
- apps/engine-room — Ops panel (component of NEXUS)
- apps/console — Creative tools surface (component of NEXUS)
- services/nexus-bridge — File browser + dispatch proxy API (port 3901)

## Model Routing
| Tier | Model | Hardware |
|------|-------|---------|
| local:code:fast | qwen2.5-coder:7b | Always-hot GPU |
| local:large | gemma4:26b | Swappable GPU |
| local:embed | nomic-embed-text | Always-hot minimal VRAM |
