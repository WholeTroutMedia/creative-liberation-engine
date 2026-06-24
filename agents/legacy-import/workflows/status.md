---
description: Show a compact status panel of all active IDE windows and system health
---

# /status

// turbo-all

Prints a compact, scannable overview of the entire multi-window orchestration state.
Uses the **live dispatch server registry** (not the stale registry.md file).

## Steps

// turbo

1. Call `GET http://127.0.0.1:5050/api/agents` — live agent registry with stale detection.
   Fall back to reading `.agents/dispatch/registry.md` if dispatch is offline.

// turbo
2. Call `GET http://127.0.0.1:5050/api/status` for task queue summary.

// turbo
3. Optional: `GET` Genkit health or root `package.json` version — v5 does not use legacy `system-status.json`.

1. Print the following panel:

```
╔══════════════════════════════════════════════════════════╗
║  Creative Liberation Engine — DISPATCH STATUS                      ║
╚══════════════════════════════════════════════════════════╝

🪟  LIVE WINDOWS  [From GET /api/agents — real-time]
  [For each agent, show:]
  🟢 Window [X]  │  [workstream]  │  [current_task]  │  last seen: [Ns ago]   ← active (<30s)
  🟡 Window [X]  │  [workstream]  │  [current_task]  │  last seen: [Nm ago]   ← idle (30s-5m)
  🔴 Window [X]  │  [workstream]  │  —              │  last seen: [Nm ago]   ← stale (>5m)

📥  TASK QUEUE
  Queued: [n]  │  Active: [n]  │  Done: [n]

⚙️  SYSTEM
  CORTEX: STRATA ✅  LOGD ✅  PRISM ✅
  Health: [status]  │  Boot #[n]

🗺️  FREE WORKSTREAMS
  [List any workstreams from the pool not currently claimed]
```

1. If no agents are registered (empty registry):
   > All windows unregistered. Send any message in a window to auto-register via heartbeat,
   > or run `/claim <workstream>` to explicitly register.

## Notes

- Reads live `/api/agents` — staleness is computed server-side from `last_seen`
- Falls back to `registry.md` if dispatch is offline (note it may be stale)
- This workflow is read-only and safe to run from any window
