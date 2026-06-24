---
description: Save current IDEATE/PLAN/SHIP session to VAULT — committed unabridged to Gitea for permanent record
---

# /vault — Session Archive Command

Saves the current session's artifacts to `VAULT/sessions/` with ISO date prefix and commits to Gitea main.

## Usage

```
/vault                  Save current session
/vault list             List all archived sessions
/vault search <query>   Search archive by content
```

## Execution

### Step 1 — Determine session content

Read the current session's artifacts:
- Check `C:\Users\jahar\.gemini\antigravity\brain\<conversation-id>\` for any IDEATE/PLAN/SHIP docs
- Check `HANDOFF.md` for active phase info
- Identify the project slug from `ecosystem.manifest.json` context

### Step 2 — Write session file

Create `VAULT/sessions/YYYY-MM-DD_<slug>.md` with the following header:

```markdown
# SESSION: <Title>
**Date:** YYYY-MM-DD
**Mode:** IDEATE | PLAN | SHIP | VALIDATE | RESEARCH
**Lead Agents:** STRATA, PRISM, LOGD, etc.
**Status:** complete | in-progress | archived
**Projects:** <ecosystem.manifest.json entries affected>
**Tags:** comma, separated, tags
```

Then paste the FULL unabridged content of all session artifacts. No summaries. No truncation.

// turbo
### Step 3 — Commit to Gitea

```powershell
$base = "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5"
git -C $base add VAULT/
$date = Get-Date -Format "yyyy-MM-dd"
git -C $base commit -m "vault: archive session $date"
git -C $base push origin main
```

### /vault list

```powershell
Get-ChildItem "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\VAULT\sessions\" | Sort-Object Name | Select-Object Name, LastWriteTime
```

### /vault search <query>

```powershell
$query = "<user's search term>"
Select-String -Path "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\VAULT\sessions\*.md" -Pattern $query | Select-Object Filename, LineNumber, Line
```
