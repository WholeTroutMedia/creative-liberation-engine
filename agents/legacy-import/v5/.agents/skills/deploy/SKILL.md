---
name: DEPLOY Mode
version: 2.0.0
last_modified: 2026-04-07
constitutional_articles: [I, IV, IX, XX]
lead_agents: [FORGE, LOGD]
scribe_on_complete: true
agentCallable: true
---

# DEPLOY Mode — Creative Liberation Engine v5

> Pipeline: **SHIP → VALIDATE → DEPLOY**
> DEPLOY is the final gate. It commits, pushes, deploys to the NAS, and verifies health. It never runs before VALIDATE returns OK or DEGRADED.

## When to Use This Skill

Activate DEPLOY when:

- VALIDATE returns `✅ LAUNCH READY` or `⚠️ CONDITIONALLY READY`
- User says "deploy", "release", "push this", "ship it to NAS", "go live"
- `/release`, `/commit`, `/pr`, `/nas-deploy`, `/deploy-gcp` workflows are triggered
- Auto-Release chain at end of SHIP Step 7 fires

**Never activate DEPLOY if:**

- VALIDATE returned `❌ BLOCKED`
- TypeScript errors exist in the affected package
- The `.agents/dispatch/registry.md` shows another window owns the files

---

## Operating Principals

**Lead agents:** FORGE (Executor) + LOGD (Compliance gate)
**Support agents:** NORTHSTAR (Constitutional final check), BEACON (if UI surface deploying)

---

## Memory Protocol

**VAULT IN (read at start):**

- Prior deploy events for this service (episodic) — check for known failure patterns
- NAS deployment conventions (semantic) — Docker compose paths, service names

**SCRIBE OUT (write at end):**

- Deploy event → episodic: service name, timestamp, git SHA, health check result
- Any new deploy pattern or fix discovered → semantic

---

## Pre-Flight Gate: VALIDATE Confirmation (MANDATORY)

DEPLOY will not proceed without explicit VALIDATE confirmation.

```text
[ ] VALIDATE verdict: ✅ LAUNCH READY or ⚠️ CONDITIONALLY READY
[ ] No TypeScript errors in affected package(s)
[ ] No BLOCKED checklist items in task.md
[ ] .agents/dispatch/registry.md checked — no conflicts
[ ] NAS reachable: ping 127.0.0.1
```

If VALIDATE hasn't run → invoke VALIDATE skill first. Do not skip.
If NAS unreachable → stop. Surface: *"NAS at 127.0.0.1 unreachable. Resolve connectivity before deploy."*

---

## NAS Supremacy Rule

> **CRITICAL: The NAS (`127.0.0.1`) is the live station. ALL production writes go there.**

Primary deploy targets:

- **creative-liberation-engine-v5:** `/app/genesis-deploy` via SSH/scp
- **creative-liberation-engine-v4:** `\\127.0.0.1\The Vault\Creative Liberation Engine\creative-liberation-engine-v4`

Local `D:\` is a sync mirror — never treated as primary.

---

## Step-by-Step Protocol

### Step 1 — Conventional Commit

Stage and commit with atomic, conventional format:

```powershell
git add -A
git commit -m "<type>(<scope>): <imperative description>

<body: what changed and why — 2-3 sentences if non-trivial>

Closes: #<task-id or dispatch ID>"
```

**Commit types:** `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `ci`
**Scope:** package name or service name (e.g., `genkit`, `dispatch`, `zero-day`)

**Commit rules:**

- No `WIP` commits to main/master
- Body required if the change is non-trivial (> 3 files changed)
- Always reference the task/dispatch ID

---

### Step 2 — Push to Forgejo (Sovereign Git)

```powershell
git push origin <branch>
```

Primary remote is the sovereign Forgejo instance on the NAS.
If push fails → check `push_error*.txt` pattern in workspace root for prior failure context before retry.

---

### Step 3 — Deploy to NAS (Primary)

For Docker services (creative-liberation-engine-v5):

```powershell
# SSH to NAS and pull + redeploy
ssh nas "cd /app/genesis-deploy && git pull && docker compose -f docker-compose.genesis.yml up -d --build <service-name>"
```

For non-Docker packages (library/shared):

```powershell
ssh nas "cd /app/genesis-deploy && git pull && pnpm --filter @cle/<package> build"
```

**Service name lookup:** See `docker-compose.genesis.yml` for canonical service names.

---

### Step 4 — Health Check

After deploy, verify the service is live:

```powershell
# Dispatch server
Invoke-RestMethod -Uri "http://127.0.0.1:5050/api/status"

# Genkit engine
Invoke-RestMethod -Uri "http://127.0.0.1:4100/health"

# Any other service: check its documented health endpoint
```

**Pass condition:** Health endpoint returns `{ status: "operational" }` or HTTP 200 within 30 seconds.
If health check fails → invoke rollback (Step 5). Do not attempt to fix-forward on a broken deploy.

---

### Step 5 — Rollback Protocol (If Health Check Fails)

```powershell
ssh nas "cd /app/genesis-deploy && git revert HEAD --no-edit && git push && docker compose -f docker-compose.genesis.yml up -d <service-name>"
```

After rollback:

1. Write a failure entry to SCRIBE episodic: what failed, the git SHA, the error output
2. Surface the failure to the user with the exact error
3. Do NOT attempt re-deploy autonomously — return to SHIP for root cause analysis

---

### Step 6 — PR (If Applicable)

For feature branches merging to main:

```powershell
# Via Forgejo CLI or API
gh pr create --title "<type>(<scope>): <description>" --body "<PR body>"
```

PR body must include:

- What changed and why
- VALIDATE report verdict
- Link to dispatch task
- Health check result

---

### Step 7 — Update Dispatch

Mark the task complete in the dispatch queue:

```powershell
Invoke-RestMethod -Method PATCH -Uri "http://127.0.0.1:5050/api/tasks/<task-id>" -Body (@{ status = "done" } | ConvertTo-Json) -ContentType "application/json"
```

Then write SCRIBE memory (Step 8).

---

### Step 8 — SCRIBE Write (MANDATORY)

```powershell
$body = @{
    collection = "episodic"
    content    = "DEPLOY: <service> deployed at <timestamp>. SHA: <git-sha>. Health: OK. Task: <id>."
    metadata   = @{
        tags      = @("deploy", "<service-name>", "production")
        source    = "cle-session"
        timestamp = (Get-Date -Format "o")
    }
} | ConvertTo-Json -Depth 10 -Compress

Invoke-RestMethod -Method POST -Uri "http://localhost:4100/memory/write" -ContentType "application/json" -Body $body
```

Fallback (engine offline): Write to `packages/memory/scribe_archive/episodic/<YYYYMMDD>-deploy-<service>.md`

---

## Cloud / GCP Deploy (When Applicable)

For GCP Cloud Run deployments:

```powershell
gcloud run deploy <service> --source . --region us-central1 --project <project-id>
```

Always confirm the GCP project with `gcloud config get project` before deploying.
Cloud deploy is secondary to NAS. Never cloud-deploy without NAS-deploy completing first (sovereignty policy).

---

## Failure Recovery

Apply UPE Failure Reflection before any retry:

```text
FAILURE REFLECTION:
1. WHAT_FAILED: [exact command that failed]
2. EXPECTED_STATE: [assumed state before command]
3. ACTUAL_STATE: [error output / actual state]
4. ROOT_CAUSE: [specific mismatch]
5. RECOVERY_ACTION: [minimal intervention — rollback or targeted fix]
6. BLAST_RADIUS: [services/files affected]
```

Never retry a deploy command more than once without a reflection step. On second failure, rollback and surface.

---

## Constitutional Constraints

- **Article I (Sovereignty):** NAS deploys always primary. Cloud only for services that require external reachability.
- **Article IX (No MVP):** Never deploy partial code. VALIDATE must pass first.
- **Article XX (Automation):** Health checks and SCRIBE writes are automated — never require human to trigger.
- **VALIDATE gate is absolute:** DEPLOY cannot begin if VALIDATE returned BLOCKED.
