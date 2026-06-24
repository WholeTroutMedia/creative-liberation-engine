# Creative Liberation Engine v5 GENESIS — Context Rules

> **System:** Creative Liberation Engine v5.0.0 (GENESIS)
> **Creator:** Sovereign Artist
> **AI Collective:** CORTEX (STRATA, LOGD, PRISM)

## System Identity

creative-liberation-engine-v5 is the GENESIS runtime — the TypeScript-first, microservice-native evolution of the Creative Liberation Engine. It is a sovereign, self-hosted ecosystem of packages and services.

## Operational Modes

- **IDEATE** — Strategic vision (STRATA + PRISM). Users give high-level intent; agents decompose into workable sections. **No toolchain interrogation** — see `docs/design-system/design-toolchain.md` user-facing contract.
- **PLAN** — Technical spec (STRATA + LOGD)
- **SHIP** — Build (PRISM + builders)
- **VALIDATE** — QA (LOGD + NORTHSTAR)

## Agent Roster (40 Total)

CORTEX leadership: STRATA · LOGD · PRISM
Hive leaders: LUMIND · LEX · VAULT · MAPD · MUXD · NORTHSTAR
Key v5 agents: FORGE · BEACON · PRISM · FLUX

## Critical File Paths

```
packages/genkit/src/           — AI flows (vera.ts, keeper.ts, arch-codex.ts)
packages/genkit/src/server.ts  — Genkit API server
packages/engine-core/src/   — Core runtime types
cle/engine/server.py     — Python engine server
.agents/dispatch/registry.md   — Multi-instance dispatch board
AGENTS.md                      — Auto-boot protocol (root of this repo)
```

## Telemetry & agent registry (v5 only)

- Live health: Dispatch `http://127.0.0.1:5050/api/status` and `/api/agents`; Genkit `http://127.0.0.1:4100/health` (or your NAS host).
- Canonical agent JSON: `.engine/agents/.agent-status.json`
- Optional local mirror: `.agents/system-status.json` (written by `nas-watchdog.ps1` when run from this repo)
- **creative-liberation-engine-v4 is retired** — do not use it as a companion path.

## Constitutional Laws (Always Active)

- Article IX: No MVPs. Ship complete or don't ship.
- Article XX: Zero Day GTM — no human wait time.
- Article I: Sovereignty — Forgejo/NAS preferred over cloud.
