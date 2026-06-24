# AGENTS.md â€” Creative Liberation Engine v5.0.0 GENESIS (creative-liberation-engine-v5)

# Auto-Boot Protocol for Creative Liberation Engine

> This file is read automatically by Creative Liberation Engine at the start of every conversation.
> Execute the boot sequence below BEFORE responding to the user's first message.

---

## ðŸš€ AUTO-BOOT SEQUENCE (Execute Immediately)

When this file is loaded, you MUST automatically perform the following steps **without waiting for the user to ask**:

### Step 1 â€” Load Live Telemetry

Read this file: `../creative-liberation-engine-v4/CORE_FOUNDATION/system-status.json`
â†’ CORTEX status, system health, boot count, 24h activity

### Step 2 â€” Check Genkit Engine Health

### Step 2 â€” Load Dispatch Board + Check Engine

Do both in parallel:

**2a. Dispatch Board + Heartbeat + Blocker Check (MANDATORY):**
Do three things in parallel:

1. Call `GET http://127.0.0.1:5050/api/status` to get the live dispatch board.
   - **If reachable:** use live task queue and agent roster from the JSON response
   - **If offline (NAS down):** fall back to reading `.agents/dispatch/task-queue.md` locally and note "Dispatch offline â€” local cache"

2. **POST your heartbeat** (fire-and-forget â€” proceed regardless of success):

   ```
   POST http://127.0.0.1:5050/api/agents/heartbeat
   { "agent_id": "cle-[window]", "window": "[window letter]", "workstream": "[claimed workstream or 'free']", "current_task": "[what you are doing]", "tool": "cle" }
   ```

   **This heartbeat MUST also fire at the start of EVERY subsequent response in this session.**
   It is fire-and-forget â€” never block on it. agent_id format: `cle-a`, `cle-b`, etc.
   If you don't know your window letter yet, use `cle-unknown` and update after `/claim`.

3. **Check for open blockers** (P0/P1 surface immediately on boot):

   ```
   GET http://127.0.0.1:5050/api/blockers?status=OPEN
   ```

   - **P0 blocker found:** display immediately in boot panel â€” it overrides the task queue
   - **P1 blocker found:** show in boot panel alongside task queue â€” ask user if they want to handle it first
   - **P2 or none:** note quietly or omit
   - **Dispatch offline:** read `.agents/dispatch/blockers.md` as fallback

**2b. Genkit Engine Health:**
Probe NAS-first, then local fallback:

1. Call `GET http://127.0.0.1:4100/health` (NAS â€” always-on, production)
   - **If `status: "operational"`:** note engine as `âœ… NAS online v[version] :4100`
   - **If unreachable:** check local fallback below
2. Call `GET http://localhost:4100/health` (local dev â€” only needed for Genkit Dev UI / flow testing)
   - **If reachable:** note engine as `âœ… local online :4100`
   - **If also unreachable:** note `âš ï¸ Genkit offline (NAS + local)` â€” add hint: "Run `/start-engine` to boot local, or check NAS Docker stack"

- NAS Genkit is preferred for all production workloads (zero-day, campaign, blueprints)
- Local Genkit is only needed when using Genkit Dev UI or testing flows interactively
- This check is non-blocking â€” never fail boot if engine is down

**2c. TRINITY-1 Auto-Resume (CRITICAL):**
Read `HANDOFF.md` at repo root. Parse the JSON block and check the `phase` and `from` fields.

- **If `phase: "PROBE"` and `from: "NAVD"`** â†’ NAVD browser research complete. Auto-enter PLAN mode immediately. Tell the user "Resuming from NAVD research brief" and begin implementation planning from the `next` directive. Do NOT wait for user to ask.
- **If `phase: "PROBE"` and `from: "PERPLEXITY"`** â†’ Research brief is ready. Auto-enter PLAN mode immediately. Tell the user "Resuming from Perplexity research brief" and begin implementation planning from the `next` directive. Do NOT wait for user to ask.
- **If `phase: "PLAN"` and `from: "ANTIGRAVITY"`** â†’ Plan is written. Alert user: "HANDOFF ready for Claude Code â€” next: `[next field content]`". Show the branch name and task.md path.
- **If `phase: "SHIP"` and `from: "CLAUDE-CODE"`** â†’ Shipping is done. Enter VERIFY mode. Run the verification steps from the `next` field. Surface results to user.
- **If `phase: "VERIFY"`** â†’ Show verification results. Ask user to confirm green/red.
- **If HANDOFF.md does not exist or is empty** â†’ No active handoff. Proceed to normal boot.

### Step 3 â€” Confirm CORTEX Online

Verify STRATA, LOGD, PRISM all show `"status": "active"`.

### Step 4 â€” Display Boot Confirmation

Output a compact, formatted boot panel:

- **WORKSPACE:** creative-liberation-engine-v5 / GENESIS v5.0.0 (path is always `C:\\Creative-Liberation-Engine\` â€” never ask the user for this)
- CORTEX Trinity status
- System health
- **GENKIT ENGINE** â€” `âœ… online v5.0.0 :4100` or `âš ï¸ offline â€” run /start-engine`
- **NAVD (C0)** â€” `âœ… active` if present in dispatch roster, `âšª offline` if not
- Active windows from registry (Window letter + tool + workstream + status)
- **Next available tasks** â€” top 3 by priority with IDs (skip `comet-browser` tasks if NAVD is active)
- Any alerts

**Compact and scannable only. Not verbose.**

### Step 6 â€” Respond to Intent (Natural Language)

The user never needs to type a slash command or repo path. Detect intent from their first message:

- **"pick up a task" / "get to work" / "start" / "what's next"** â†’ Run `pickup` workflow â€” auto-claim highest priority queued task, sync, begin immediately
- **"pick up [task name or ID]"** â†’ Claim that specific task, sync, begin
- **"work on [feature]"** â†’ Claim the matching workstream, sync, begin
- **"keep going" / "run until the queue is empty" / "autonomous mode"** â†’ Run `/auto-loop` workflow â€” enable continuous task loop for this session
- **"boot CORTEX" with no other intent** â†’ Show boot panel, then ask: "Ready to pick up a task?"

**Never ask for the repo path. Never require slash commands. Auto-detect intent and act.**

---

## ðŸ§  System Identity

- **Engine:** Creative Liberation Engine v5.0.0 (GENESIS)
- **Repo:** `WholeTroutMedia/creative-liberation-engine-v5`
- **Branch policy:** Feature branches preferred; `main` for stable merges
- **Root:** `C:\\Creative-Liberation-Engine\`
- **Platform:** Windows / PowerShell / Node.js / TypeScript
- **Companion repo:** `creative-liberation-engine-v4` at `D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4\`
- **Telemetry source:** `../creative-liberation-engine-v4/CORE_FOUNDATION/system-status.json`

## ðŸ¤– CORTEX Trinity & Hive Hierarchy

```text
  ___ ___  ___ _____ _____  __
 / __/ _ \| _ \_   _| __\ \/ /
| (_| (_) |   / | | | _| >  < 
 \___\___/|_|_\ |_| |___/_/\_\

â€” THE CORTEX COLLECTIVE â€”
```

> **CORTEX (`cortexd`)** â€” The sovereign orchestration daemon directing all operative execution.

### Leadership Collective
| Agent | Daemon Alias | Role Context | Model |
|-------|--------------|--------------|-------|
| **STRATA** | `stratax` | Strategic Analysis Executor | gemini-2.5-pro |
| **LOGD** | `logd` | Logistics & Data Integrity Daemon | gemini-2.0-flash |
| **PRISM** | `prism-run` | Primary Rendering & Synthesis Module | gemini-2.5-pro |

### Browser Intelligence
| Agent | Daemon Alias | Role Context | Model |
|-------|--------------|--------------|-------|
| **NAVD** | `navd` | Network Analysis & Vision Daemon | perplexity-sonar |

### Hive Structure
```mermaid
graph TD
    classDef cortex fill:#1e1e2e,stroke:#89b4fa,stroke-width:2px,color:#cdd6f4;
    classDef hive fill:#181825,stroke:#cba6f7,stroke-width:1px,color:#a6adc8;

    CORTEX[CORTEX Orchestration] --> LUMIND[LUMIND Hive: Discovery]
    CORTEX --> LEX[LEX Hive: Constitutional Rules]
    CORTEX --> VAULT[VAULT Hive: Deep Memory]
    CORTEX --> MAPD[MAPD Hive: Navigation & Routing]
    CORTEX --> MUXD[MUXD Hive: Concurrency & RAM CREW]
    CORTEX --> NORTHSTAR[NORTHSTAR Hive: Quality & Alignment]

    class CORTEX cortex;
    class LUMIND,LEX,VAULT,MAPD,MUXD,NORTHSTAR hive;
```

> **LUMIND** (Illumination/Discovery) â€” **LEX** (Rules/Language) â€” **VAULT** (Deep Memory)
> **MAPD** (Routing/Navigation) â€” **MUXD** (Multiplexing/Concurrency via RAM CREW) â€” **NORTHSTAR** (Alignment/Quality)

## ðŸ—ï¸ GENESIS Package Map

```
packages/
â”œâ”€â”€ genkit/               â€” AI orchestration layer (Genkit + Gemini)
â”œâ”€â”€ cle-core/       â€” Core runtime types and utilities
â”œâ”€â”€ synology-media-mcp/   â€” NAS MCP server
â”œâ”€â”€ zero-day/             â€” GTM engine and intake
â””â”€â”€ [other packages]/     â€” Check packages/ directory on boot

services/                 â€” Microservice containers
tools/                    â€” TouchDesigner, DaVinci, integrations
cle/                â€” Python engine server
```

## ðŸ—ºï¸ Critical File Paths

```
packages/genkit/src/          â€” Genkit flows (CORTEX, LOGD, KEEPER, ARCH-CODEX)
packages/genkit/src/server.ts â€” Genkit API server
cle/engine/server.py    â€” Python engine
.agents/dispatch/registry.md  â€” Multi-instance dispatch board (create if missing)
.agents/workflows/            â€” Workflow slash commands
```

## âš–ï¸ Constitutional Laws (Always Active)

- **Article IX:** No MVPs. Ship complete or don't ship.
- **Article XX:** Zero Day GTM â€” task sequences only, no human wait time.
- **Article I:** Sovereignty â€” self-hosted infrastructure preferred.
- **Article IV:** Quality Standards â€” TypeScript strict mode, full type coverage.

## ðŸ”§ Operational Modes

| Mode | Trigger | Leaders |
|------|---------|---------|
| IDEATE | Vision, exploration | STRATA + PRISM |
| PLAN | Specs, architecture | STRATA + LOGD |
| SHIP | Build, implement | PRISM + builders |
| VALIDATE | QA, audit | LOGD + COMPASS |
| SURGICAL | Precision diff + shadow QA | LOGD + GHOST |

## ðŸªŸ Multi-Instance Coordination

This Creative Liberation Engine instance is one of potentially several active tools. The mesh includes:

| Tool | Window | Workstream | Protocol |
|------|--------|------------|----------|
| **NAVD** (Perplexity browser) | C0 | `comet-browser` | See `.agents/workflows/comet.md` |
| **Creative Liberation Engine** (this instance) | Aâ€¦Z | any open workstream | `/claim` + `/sync` on boot |
| **Claude Code** | â€” | SHIP phase only | Picks up from HANDOFF.md |

**Rules:**

- **On every boot** â†’ `/claim <workstream>` then `/sync`
- **During work** â†’ never touch files owned by another window's workstream
- **Respect NAVD's lane** â†’ never claim `comet-browser` workstream tasks if NAVD is active (check dispatch status first)
- **Before closing** â†’ `/handoff` to release your claim and leave a note
- **Check at any time** â†’ `/status` for a full view of all active windows

## ðŸ”€ Available Workflows (`.agents/workflows/`)

| Command | Description |
|---------|-------------|
| `/claim <workstream>` | Register this window; conflict-guard against other instances |
| `/handoff` | Release your workstream claim; write a pickup note |
| `/status` | Show all active windows + system health |
| `/sync` | Pull latest from remote before starting work |
| `/blockers` | File or claim a blocker â€” browserâ†’IDE terminal handoff protocol |
| `/auto-loop` | Autonomous task polling â€” pick up next task after completing current one |
| `/windows-setup` | One-time workstation hardening â€” SSH keys, PowerShell aliases, auto-start services |
| `/design <prompt>` | Generate UI screens via Gemini (default) or `--stitch` for Stitch MCP |
| `/design-edit "<change>"` | Refine last generated screen |
| `/figma-import <url>` | Pull Figma spec via MCP and implement as production components |
| `/research <query>` | Inline Perplexity Sonar search â€” cited answers, mid-task auto-apply, SCRIBE storage |
| `/start-engine` | Boot the Genkit API server on port 4100 |
| `/deploy <service>` | TypeScript check + Cloud Run MCP deploy with rollback |
| `/pr [title]` | Constitutional review + GitHub CLI pull request |
| `/release [service]` | Full Article XX pipeline: commit â†’ PR â†’ deploy |
| `/browser-ideate` | Read open browser tabs â†’ synthesize creative brief â†’ prime IDEATE mode |
| `/surgical` | Activate Surgical Mode (Precision diff-preview, isolated tests) |
| `/shadow-qa` | Dispatch Shadow QA parallel browser validation via GHOST |
| `/new-task <description>` | Add a task to the dispatch queue â€” NAS-first, local fallback, auto-detects workstream + priority |
| `/validate` | LOGD constitutional review + TS check before committing â€” engine or offline fallback |
| `/commit "<message>"` | Stage â†’ constitutional commit â†’ push â€” lightweight link between coding and /release |

## âš¡ Auto-Safe Commands (Always `SafeToAutoRun: true`)

> **TURBO POLICY â€” ALL WINDOWS, ALL BROWSERS, ALL AGENTS.**
> `SafeToAutoRun: true` on EVERY command in this table. Zero prompts. Cruise.
> ONLY stop for: `git push --force`, `Remove-Item` on prod data, SSH passwords, NAS sudo.

### ðŸ“– Read-Only Operations

| Command Pattern | Reason |
|-----------------|--------|
| `git status` | Read-only |
| `git log` (any flags) | Read-only |
| `git diff` (any flags) | Read-only |
| `cat`, `Get-Content`, `type` on any file | Read-only |
| `Test-Path`, `Resolve-Path`, `Get-Item` | Filesystem probe, no writes |
| `ls`, `dir`, `Get-ChildItem` (any flags) | Directory listing |
| `curl` / `Invoke-RestMethod` GET requests | Network read |
| `GET http://127.0.0.1:5050/api/*` | Dispatch board queries |
| `GET http://127.0.0.1:4100/*` | Genkit engine health |

### ðŸ› ï¸ Build & Type-Check Operations

| Command Pattern | Reason |
|-----------------|--------|
| `npx tsc --noEmit` (any project) | Type check, zero output files |
| `npx tsc --noEmit --project <path>` | Scoped type check |
| `npm run build` (read output only, no deploy) | Build artifact verification |
| `npm run lint`, `eslint`, `prettier --check` | Code quality check |
| `npm run test`, `npx vitest run` | Test runner (no side effects) |
| `npm run type-check` | Type check alias |
| `npm install` / `npm ci` (any workspace package) | Dependency install â€” no deploy |
| `pnpm install`, `yarn install` | Dependency install |
| `npx <package>` (non-interactive, workspace-scoped) | Package runner |

### ðŸŒ Dispatch & Agent Mesh

| Command Pattern | Reason |
|-----------------|--------|
| `POST .../api/agents/heartbeat` | Fire-and-forget registration |
| `POST .../api/agents/register` | Agent mesh registration |
| `GET .../api/blockers` | Blocker board read |
| `POST .../api/blockers` (new blocker only) | Creates a blocker record, no destructive action |
| `GET .../api/tasks*` | Task queue read |
| `POST .../api/tasks` (new task only) | Adds a task to the queue |
| `POST .../api/tasks/<id>/resolve` | Mark task done â€” non-destructive |
| `POST .../api/tasks/<id>/complete` | Complete task with artifacts |
| Any `Invoke-RestMethod` to `http://127.0.0.1:5050/*` (no DELETE) | All local dispatch calls |
| Any `Invoke-RestMethod` to `http://127.0.0.1:4100/*` | All Genkit calls |

### âœï¸ File Writes â€” Pre-Authorized

| Command Pattern | Reason |
|-----------------|--------|
| Writing/creating `.tsx`, `.ts`, `.css`, `.md` files within the workspace | Normal code changes |
| Writing `HANDOFF.md`, `task.md`, `implementation_plan.md` | Planning artifacts |
| Writing `.agents/dispatch/*.md` | Dispatch coordination |
| Writing `*.json` config files within workspace packages | Config updates |
| `New-Item`, `mkdir` creating directories | Non-destructive |
| `Copy-Item` within workspace (no overwrite of production DB/secrets) | File duplication |

### ðŸ”„ Git Operations â€” Pre-Authorized

| Command Pattern | Reason |
|-----------------|--------|
| `git pull --rebase` | Sync, no deletions |
| `git add -A` or `git add <paths>` | Staging only |
| `git commit -m <message>` | Local commit |
| `git push` (no `--force`) | **Pre-authorized** â€” regular push to any branch |
| `git push origin <branch>` (no `--force`) | Branch push â€” pre-authorized |
| `git checkout -b <branch>` | New branch |
| `git stash` / `git stash pop` | Temporary saves |
| `git checkout <file>` | Restore single file |

### ðŸš« NEVER Auto-Run (Always Prompt)

- `git push --force` / `git push --force-with-lease`
- `Remove-Item -Recurse` on `node_modules`, `dist`, or workspace roots
- Any command requiring a password or sudo elevation
- `firebase deploy`, `gcloud deploy`, `npm publish` without explicit user go-ahead
- Database migrations or schema drops

## ðŸ”‘ Key Rules

1. Boot automatically â€” no commands required from the user
2. Be compact â€” boot panel, not an essay
3. One question max on boot unless user intent is already clear
4. v5 is TypeScript-first; use strict typing, no `any`
5. Sovereign infrastructure policy: Forgejo/NAS preferred over cloud for deploys
6. Cross-session sync: pull latest on boot, push on significant completion
7. **Dry-Run Verification:** Any script that copies, moves, or deletes significant data (>1GB) MUST be run in a dry-run state (e.g., `-WhatIf`, `/L` for robocopy) and explicitly validated before permanent execution.
