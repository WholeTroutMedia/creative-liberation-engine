---
description: NAVD lightweight boot — cached dispatch + health check, parallel fetch, <3s target
---

# /comet-boot — Lightweight COMET Boot Protocol

## Goal

Boot COMET in under 3 seconds. Skip full `AGENTS.md` parse. Use cached dispatch + health.

## Steps

### 1. Parallel health + dispatch fetch (no sequential wait)

```
GET http://127.0.0.1:5050/api/status
GET http://127.0.0.1:5050/api/tasks?status=queued&limit=5
```

Fire both simultaneously.

### 2. Use 30s TTL cache for dispatch result

- Store result in `.agents/dispatch/.boot-cache.json`
- If cache age < 30s → skip re-fetch, use cached value
- Schema: `{ fetched_at: ISO, status: {...}, top_tasks: [...] }`

### 3. Skip full AGENTS.md parse on boot

- Use KI summaries + cached registry instead
- Only parse when explicitly asked or `?force-reload=true`

### 4. Register COMET + AVERI presence (parallel, fire-and-forget)

```
POST http://127.0.0.1:5050/api/agents/heartbeat
{ "agent_id": "comet-C0", "window": "C0", "workstream": "comet-browser", "tool": "perplexity" }

POST http://127.0.0.1:5050/api/agents/heartbeat
{ "agent_id": "averi-athena", "window": "C0-relay", "workstream": "averi", "tool": "perplexity-relay" }

POST http://127.0.0.1:5050/api/agents/heartbeat
{ "agent_id": "averi-vera", "window": "C0-relay", "workstream": "averi", "tool": "perplexity-relay" }

POST http://127.0.0.1:5050/api/agents/heartbeat
{ "agent_id": "averi-iris", "window": "C0-relay", "workstream": "averi", "tool": "perplexity-relay" }
```

All 4 POSTs fire in parallel. Don't await individually.

### 5. Render boot panel

```
⚡ COMET BOOT — GENESIS v5
Dispatch: ✅ online   Queue: N tasks
AVERI: ATHENA ✅ VERA ✅ IRIS ✅ (registered on mesh)
Boot time: <3s
```

## Key Paths

```
Repo root:     D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\
Cache file:    .agents/dispatch/.boot-cache.json
Research dir:  .agents/research\
HANDOFF.md:    D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\HANDOFF.md
```

> [!TIP]
> Add `?bust-cache=1` to your boot query to force a fresh dispatch fetch.
