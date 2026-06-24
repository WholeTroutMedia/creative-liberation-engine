---
description: Run LOGD truth-check on current changes before committing Ã¢â‚¬â€ constitutional compliance review, TypeScript check, and confidence score
---

# /validate

Runs the VALIDATE mode pipeline on your current changes. LOGD reviews the diff for constitutional compliance, logic consistency, and quality before any commit. Non-blocking Ã¢â‚¬â€ presents findings and lets you decide.

**Activates on:**
- `/validate`
- "check this before I commit"
- "does this pass LOGD?"
- "review my changes"
- "run validation"

---

## Steps

// turbo-all

### Step 1 Ã¢â‚¬â€ Gather Diff

Get the current git diff of staged + unstaged changes:

```powershell
$root = "Y:\\creative-liberation-engine"
$staged   = git -C $root diff --cached
$unstaged = git -C $root diff
$diff = "$staged`n$unstaged".Trim()
```

If `$diff` is empty Ã¢â€ â€™ report "No changes detected. Make some edits and run `/validate` again." and stop.

Count changed files:
```powershell
git -C $root diff --name-only
git -C $root diff --cached --name-only
```

---

### Step 2 Ã¢â‚¬â€ TypeScript Check

Run a fast non-emitting TypeScript check:

```powershell
npx -y tsc --noEmit --project "$root\tsconfig.json" 2>&1
```

- **If clean:** note `Ã¢Å“â€¦ TypeScript clean`
- **If errors:** extract error list, note `Ã¢ÂÅ’ TypeScript errors Ã¢â‚¬â€ [N] errors` and list them

TypeScript errors do NOT block the workflow Ã¢â‚¬â€ they are reported, not enforced. User decides.

---

### Step 3 Ã¢â‚¬â€ LOGD Constitutional Review

If the Genkit engine is running (`GET http://localhost:4100/health` succeeds):

```
POST http://localhost:4100/cortex/plan
{
  "topic": "Constitutional review of the following code changes",
  "context": "[diff, truncated to 6000 chars]",
  "depth": "light"
}
```

Extract from LOGD's response:
- `vera.verdict` Ã¢â‚¬â€ `approved` | `flagged` | `rejected`
- `vera.confidence` Ã¢â‚¬â€ 0.0Ã¢â‚¬â€œ1.0
- `vera.contradictions` Ã¢â‚¬â€ array of constitutional violations
- `vera.pattern` Ã¢â‚¬â€ pattern classification

**If engine is offline:** perform a local constitutional check instead Ã¢â‚¬â€ scan the diff for:
- `any` type usage (Article IV violation)
- Hardcoded secrets / API keys (sovereignty violation)
- `console.log` left in production paths (quality standard)
- TODO/FIXME left in shipped code (Article IX Ã¢â‚¬â€ no MVPs)

---

### Step 4 Ã¢â‚¬â€ Present Validation Report

```
Ã¢â€¢â€Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢â€”
Ã¢â€¢â€˜  VALIDATE Ã¢â‚¬â€ LOGD REVIEW                              Ã¢â€¢â€˜
Ã¢â€¢Â Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â£
Ã¢â€¢â€˜  Files changed:   [N]                                Ã¢â€¢â€˜
Ã¢â€¢â€˜  TypeScript:      Ã¢Å“â€¦ clean  OR  Ã¢ÂÅ’ [N] errors        Ã¢â€¢â€˜
Ã¢â€¢â€˜  LOGD verdict:    Ã¢Å“â€¦ approved  OR  Ã¢Å¡Â Ã¯Â¸Â flagged  OR Ã¢ÂÅ’ rejected Ã¢â€¢â€˜
Ã¢â€¢â€˜  Confidence:      [XX]%                              Ã¢â€¢â€˜
Ã¢â€¢Â Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â£
Ã¢â€¢â€˜  [If flagged or rejected:]                           Ã¢â€¢â€˜
Ã¢â€¢â€˜  CONSTITUTIONAL FLAGS                                Ã¢â€¢â€˜
Ã¢â€¢â€˜    Ã¢Å¡Â Ã¯Â¸Â  [article + description]                       Ã¢â€¢â€˜
Ã¢â€¢â€˜    Ã¢Å¡Â Ã¯Â¸Â  [article + description]                       Ã¢â€¢â€˜
Ã¢â€¢Â Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â£
Ã¢â€¢â€˜  NEXT                                                Ã¢â€¢â€˜
Ã¢â€¢â€˜    /commit "[message]"   Ã¢â‚¬â€ commit anyway             Ã¢â€¢â€˜
Ã¢â€¢â€˜    fix issues            Ã¢â‚¬â€ address flags first       Ã¢â€¢â€˜
Ã¢â€¢Å¡Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
```

- **`approved` + TypeScript clean** â†’ suggest `/commit` immediately
- **`flagged`** â†’ list issues, let user decide whether to proceed
- **`rejected`** â†’ strongly recommend fixing â€” but never block the user

---

### Step 5 â€” Background Task Registry Audit & Cleanup

Ensure that no orphan or zombie background tasks are left accumulating:
1. Run `manage_task` with action `list` to inspect active background tasks.
2. Cross-reference task states. Identify any processes that are completed, stalled, or no longer associated with active execution.
3. For any stale task, run `manage_task` with action `kill` and the corresponding `TaskId` to release system resources.

---

## Rules

- Never refuse to commit on behalf of the user Ã¢â‚¬â€ validate and report, don't gatekeep
- LOGD's verdict is advisory, not blocking
- TypeScript errors are reported, not enforced
- Engine offline = local scan mode (always works, no network required)
- Works in any workstream

