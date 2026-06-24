# Creative Liberation Engine — Project Dispatch Board

*The live kanban for all active workstreams. Updated by each Creative Liberation Engine instance at session start/end. Read this before claiming any work.*

---

## Active Workstreams

| Slug | Phase | Owner | Branch | Status | Last Updated |
|---|---|---|---|---|---|
| `v5-console` | SHIP | – | `main` | ✅ Spatial OS rebuild complete — all 7 pages shipped | 2026-03-05 |
| `comet` | SHIP | – | `main` | ✅ Phase G visionOS shipped + NAVD-Mobile agent (Wave 37) | 2026-03-19 |
| `ci` | VALIDATE | – | `main` | ✅ Forgejo runner stable — BLK-20260319-001 dispatch server offline (P1 open) | 2026-03-19 |
| `memory` | SHIP | – | `main` | ✅ cognitive/contextual/operational structure committed | 2026-03-05 |
| `v5-genkit` | SHIP | – | `main` | ✅ relay-signal-switchboard + lex-compass complete, REST endpoints registered | 2026-03-19 |
| `signal-pipeline` | DONE | – | `main` | ✅ CORTEX intake + SignalUniFlow + GenMedia batch + Resend delivery — merged to main | 2026-03-19 |
| `averi-herald` | SHIP | – | `main` | ✅ Dispatch bridge + NAS routing sync | 2026-03-19 |
| `v4` | MAINTAIN | – | `main` | 🟡 vfx_routes.py open | 2026-03-05 |

---

## Queued (Next Up)

| Slug | Phase | Priority | Description |
|---|---|---|---|
| `v5-agents` | SHIP | HIGH | Complete agent runtime layer |
| `nbc` | PLAN | MEDIUM | NBC Nexus broadcast platform build |
| `zero-day` | SHIP | HIGH | Complete intake + contract flow |
| `mobile` | IDEATE | LOW | Mobile companion app |
| `public-release` | PLAN | HIGH | Prepare the lightweight GitHub public release of the engine |
| `magic-haggadah` | IDEATE | HIGH | Interactive Passover Haggadah — creative household experience |

---

## Completed This Sprint

- `v5-console` — Full spatial OS rebuild (7 pages, 27+ agents, 18 constitution articles)
- `comet` — Sovereign Playwright browser + WebSocket bridge + visionOS Phase G + NAVD-Mobile agent
- `ci` — Forgejo DinD → socket passthrough, port remapping, network pool fix
- `memory` — CLS hierarchical memory hub + bus.ts v2 + cross_session_sync workflow
- `signal-pipeline` — CORTEX webhook intake → SignalUniFlow (STRATA decomp + GenMedia batch) → Resend delivery
- `v5-genkit` — relay-signal-switchboard (RELAY + SIGNAL + SWITCHBOARD) + lex-compass (LEX + COMPASS) flows + REST endpoints
- `averi-herald` — Dispatch bridge and listener with NAS routing
- `waves-18-37` — 20 multi-helix waves: test hardening, sovereign mesh, fabric router, CRM wiring, cloud deploy

---

## Dispatch Rules

1. **Claim before touching.** Update this file + [`dispatch/registry.md`](./dispatch/registry.md) before starting work in any slug area.
2. **One owner per slug.** Check [`registry.md`](./dispatch/registry.md) to confirm a slug is unclaimed.
3. **Branch**: Create `feat/[slug]` or `fix/[slug]` if doing multi-day work. Merge to `main` when done.
4. **Update on close.** Mark your workstream as complete or queued when you end the session.

---

## Quick Navigation

| Resource | Link |
|---|---|
| Agent Protocol | [`ANTIGRAVITY.md`](./ANTIGRAVITY.md) |
| Instance Registry | [`dispatch/registry.md`](./dispatch/registry.md) |
| Agent Workflows | [`.agent/workflows/`](./workflows) |
| Boot Config | [`.averi/boot.json`](../.agents/boot.json) |
| Inbox Pipeline | [`.averi/inbox/`](../.agents/inbox) |

---

*Maintained by the Creative Liberation Engine dispatch system. Run `/dispatch` to load this board at session start.*
