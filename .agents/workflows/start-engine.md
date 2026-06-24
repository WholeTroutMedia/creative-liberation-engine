---
description: Boot the Creative Liberation Engine Genkit API server Ã¢â‚¬â€ checks status, starts if needed, confirms all CORTEX endpoints are live
---

# /start-engine

Starts the `@cle/genkit` API server. Checks if it's already running first Ã¢â‚¬â€ if so, just shows status. Otherwise, boots it in the correct mode and confirms all endpoints are healthy.

**Activates on:**
- `/start-engine`
- "start the genkit server"
- "boot the engine"
- "start the AI server"
- "is the engine running"

---

## Ports & Endpoints (Always True Ã¢â‚¬â€ Do Not Ask)

| Service | Port | URL |
|---------|------|-----|
| Genkit API Server (Express) | `4100` | `http://localhost:4100` |
| Genkit CLI Reflection Server | `3100` | `http://localhost:3100` |
| Genkit Dev UI | `4000` | `http://localhost:4000` |

Health check: `GET http://localhost:4100/health`
Expected response: `{ "status": "operational", "service": "cle-genkit", "version": "5.0.0" }`

Project root: `Y:\creative-liberation-engine`
Package path: `packages/genkit`

---

## Steps

// turbo-all

### Step 1 Ã¢â‚¬â€ Check If Already Running

Before starting, check if the server is already up:

```powershell
try {
  $r = Invoke-RestMethod -Uri "http://localhost:4100/health" -Method GET -TimeoutSec 3
  Write-Host "Ã¢Å“â€¦ Engine already running Ã¢â‚¬â€ $($r.status) v$($r.version)"
} catch {
  Write-Host "Ã¢Å¡Â¡ Engine offline Ã¢â‚¬â€ starting now..."
}
```

If the health check **succeeds** Ã¢â€ â€™ skip to Step 4 (show status panel). Do not start a second instance.

If the health check **fails** (connection refused) Ã¢â€ â€™ proceed to Step 2.

---

### Step 2 Ã¢â‚¬â€ Choose Mode

Determine startup mode from context:

| Mode | When | Script |
|------|------|--------|
| **dev** (default) | Active development, need hot-reload + Genkit Dev UI | `npm run dev --prefix packages/genkit` |
| **prod** | Production / background / Docker | `npm run start --prefix packages/genkit` |
| **genkit:ui** | Want the Genkit visual flow playground | `npm run genkit:ui --prefix packages/genkit` |

**Default to `dev` mode** unless the user explicitly says "production" or "prod".

Dev mode sets `GENKIT_ENV=dev`, enables `tsx --watch` hot-reload, and registers with the Genkit CLI reflection server at port 3100 so the Dev UI at port 4000 shows live flows.

---

### Step 3 Ã¢â‚¬â€ Start the Server

Run the chosen start command in the creative-liberation-engine root:

**Dev mode (default):**
```powershell
$proc = Start-Process -FilePath "powershell" `
  -ArgumentList "-NoExit", "-Command", "npm run dev --prefix packages/genkit" `
  -WorkingDirectory "Y:\\creative-liberation-engine" `
  -PassThru
Write-Host "Ã¢Å¡Â¡ Starting Genkit engine (PID $($proc.Id))..."
```

Wait up to 15 seconds for the server to become healthy. Poll `GET http://localhost:4100/health` every 500ms. If not healthy after 15s, report the failure and show the last stdout line for diagnosis.

---

### Step 4 Ã¢â‚¬â€ Confirm Health & Display Status Panel

Once running (or already running), hit all key endpoints and display:

```
Ã¢â€¢â€Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢â€”
Ã¢â€¢â€˜  Creative Liberation Engine Ã¢â‚¬â€ GENKIT API SERVER                Ã¢â€¢â€˜
Ã¢â€¢â€˜  v5.0.0 | @cle/genkit                          Ã¢â€¢â€˜
Ã¢â€¢Â Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â£
Ã¢â€¢â€˜  STATUS     Ã¢Å“â€¦ operational                           Ã¢â€¢â€˜
Ã¢â€¢â€˜  API        http://localhost:4100                    Ã¢â€¢â€˜
Ã¢â€¢â€˜  HEALTH     GET  /health          Ã¢Å“â€¦                 Ã¢â€¢â€˜
Ã¢â€¢â€˜  DEV UI     http://localhost:4000 [dev mode only]   Ã¢â€¢â€˜
Ã¢â€¢Â Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â£
Ã¢â€¢â€˜  CORTEX FLOWS                                         Ã¢â€¢â€˜
Ã¢â€¢â€˜    POST /cortex/ideate   Ã¢â‚¬â€ IDEATE mode (VAULT+STRATA)Ã¢â€¢â€˜
Ã¢â€¢â€˜    POST /cortex/plan     Ã¢â‚¬â€ PLAN mode  (VAULT+STRATA+LOGD) Ã¢â€¢â€˜
Ã¢â€¢â€˜    POST /generate       Ã¢â‚¬â€ Unified completion         Ã¢â€¢â€˜
Ã¢â€¢â€˜    POST /stream         Ã¢â‚¬â€ SSE streaming              Ã¢â€¢â€˜
Ã¢â€¢â€˜    POST /search         Ã¢â‚¬â€ Perplexity / Sonar         Ã¢â€¢â€˜
Ã¢â€¢â€˜    POST /retrieve       Ã¢â‚¬â€ ChromaDB vector search     Ã¢â€¢â€˜
Ã¢â€¢â€˜    POST /classify       Ã¢â‚¬â€ Task classification        Ã¢â€¢â€˜
Ã¢â€¢Â Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â£
Ã¢â€¢â€˜  NEXT STEPS                                          Ã¢â€¢â€˜
Ã¢â€¢â€˜    /cortex-ideate <topic>  Ã¢â‚¬â€ Run IDEATE mode live     Ã¢â€¢â€˜
Ã¢â€¢â€˜    /browser-ideate        Ã¢â‚¬â€ Tab context Ã¢â€ â€™ IDEATE     Ã¢â€¢â€˜
Ã¢â€¢Å¡Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
```

Optionally do a quick smoke-test of `/cortex/ideate` with `{ "topic": "ping", "depth": "light" }` to confirm CORTEX flows are wired. Report result inline.

---

### Step 5 Ã¢â‚¬â€ Handle Failures

If the server fails to start or stays unhealthy:

5a. Check if the port is already bound by another process:
```powershell
netstat -ano | findstr ":4100"
```
If bound Ã¢â€ â€™ report "Port 4100 already in use by PID [X]. Kill it with `Stop-Process -Id [X]` or run `/stop-engine`."

5b. Check for missing `.env` file:
```powershell
Test-Path "Y:\\creative-liberation-engine\packages\genkit\.env"
```
If missing Ã¢â€ â€™ warn: "Ã¢Å¡Â Ã¯Â¸Â No `.env` found in packages/genkit. Genkit requires `GOOGLE_GENAI_API_KEY` and optionally `PERPLEXITY_API_KEY`. Copy from `.env.example` or add keys directly."

5c. Check if `node_modules` is installed:
```powershell
Test-Path "Y:\\creative-liberation-engine\node_modules"
```
If missing Ã¢â€ â€™ run `pnpm install` from the workspace root before retrying.

5d. Show the last 20 lines of server output and suggest: "Run `npm run dev --prefix packages/genkit` manually in a terminal to see full error output."

---

### Step 6 Ã¢â‚¬â€ Update AGENTS.md Boot Check (T20260305-003 dependency)

Note: T20260305-003 wires this health check directly into the AGENTS.md boot sequence. When that task is claimed, the boot sequence will automatically call `GET http://localhost:4100/health` on every session start and include engine status in the boot panel. This task is a prerequisite.

---

## Rules

- Never ask for the project path Ã¢â‚¬â€ it is always `Y:\creative-liberation-engine`
- Default to `dev` mode Ã¢â‚¬â€ only use `prod` if explicitly requested
- Never start a second instance if port 4100 is already healthy
- The Genkit CLI reflection server on port 3100 is started automatically by the `dev` script Ã¢â‚¬â€ do not start it separately
- On completion, always display the full status panel with live endpoint list

---

## Quick Reference

| Goal | Command |
|------|---------|
| Start in dev mode | `npm run dev --prefix packages/genkit` |
| Start with Genkit Dev UI | `npm run genkit:ui --prefix packages/genkit` |
| Build production | `npm run build --prefix packages/genkit && npm run start --prefix packages/genkit` |
| Health check | `Invoke-RestMethod http://localhost:4100/health` |
| Audit log | `Invoke-RestMethod http://localhost:4100/audit` |
| Stop | `Stop-Process -Name node` (careful Ã¢â‚¬â€ kills all node) |

