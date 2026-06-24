---
description: Lightweight git commit for the current workstream Ã¢â‚¬â€ runs validate first, stages files, writes a constitutional commit message, and pushes
---

# /commit <message>

A fast, constitutional commit. Lighter than `/release` (no PR, no deploy) Ã¢â‚¬â€ just validate Ã¢â€ â€™ stage Ã¢â€ â€™ commit Ã¢â€ â€™ push. Use this for incremental progress during a session. Chain into `/pr` or `/release` when ready to ship.

**Activates on:**

- `/commit "[message]"`
- "commit this"
- "save my progress"
- "commit and push"

---

## Steps

// turbo-all

### Step 1 Ã¢â‚¬â€ Pre-flight Validate

Run `/validate` inline (abbreviated Ã¢â‚¬â€ Steps 1-2 only: diff check + TypeScript).

- If TypeScript has errors: warn the user. Ask once: "TypeScript errors detected. Commit anyway? (yes/no)"
- If user says no Ã¢â€ â€™ stop. Fix errors first.
- If user says yes, or validate passes Ã¢â€ â€™ proceed.
- If no changes detected: "Nothing to commit. Make some changes first."

---

### Step 2 Ã¢â‚¬â€ Stage Changes

Stage all changes in the current workstream's scope:

// turbo

```powershell
$root = "Y:\\creative-liberation-engine"
git -C $root add -A
```

Show what's being staged:

// turbo

```powershell
git -C $root diff --cached --stat
```

---

### Step 3 Ã¢â‚¬â€ Build Commit Message

Use the message provided by the user. If no message was given, generate one from the diff:

**Constitutional commit format:**

```
[type]([scope]): [description]

[optional body Ã¢â‚¬â€ if changes are complex]
```

**Type rules:**

| Change type | Prefix |
|-------------|--------|
| New feature / workflow | `feat` |
| Bug fix | `fix` |
| Docs / AGENTS.md / README | `docs` |
| Refactor (no behavior change) | `refactor` |
| Tests | `test` |
| Config / build / CI | `chore` |

**Scope** = workstream name (e.g. `comet-browser`, `genkit-flows`, `console-ui`)

**Examples:**

```
feat(comet-browser): add /validate workflow with LOGD review
docs(agents): add /commit + /validate to AGENTS.md workflow table
fix(genkit-server): correct GENKIT_URL env var default to port 4100
```

---

### Step 4 Ã¢â‚¬â€ Commit

// turbo

```powershell
git -C $root commit -m "[message]"
```

Capture and display the commit hash.

---

### Step 5 Ã¢â‚¬â€ Push

// turbo

```powershell
git -C $root push origin HEAD
```

- **If push succeeds:** show remote URL + commit hash
- **If push fails (diverged branch):** run `git pull --rebase origin HEAD` then retry push once
- **If rebase has conflicts:** report: "Ã¢Å¡Â Ã¯Â¸Â Merge conflict Ã¢â‚¬â€ resolve manually then run `/commit` again"

---

### Step 6 Ã¢â‚¬â€ Confirm + Suggest Next

```
Ã¢Å“â€¦ Committed + pushed

  Hash:      [short SHA]
  Branch:    [branch]
  Message:   [commit message]
  Files:     [N] changed, [+N] insertions, [-N] deletions

Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
NEXT STEPS
  /pr "[title]"     Ã¢â‚¬â€ open a pull request
  /release          Ã¢â‚¬â€ full deploy pipeline  
  keep working      Ã¢â‚¬â€ commit again when ready
Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
```

---

## Rules

- Always run a quick validate first (Step 1) Ã¢â‚¬â€ never commit blind
- Never force-push Ã¢â‚¬â€ if push fails, only try rebase, never `--force`
- Always display the commit hash on success
- Scope must match the current workstream name from `registry.md`
- This is the middle link: SHIP Ã¢â€ â€™ `/commit` Ã¢â€ â€™ `/pr` Ã¢â€ â€™ `/release`

