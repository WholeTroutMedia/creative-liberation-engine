---
description: Chain commit â†’ PR â†’ deploy in one command â€” the full Article XX release pipeline
---

# /release [service] [message]

Full release pipeline: stages all changes, commits, opens a PR (with constitutional review), merges on approval, and deploys to Cloud Run. Implements Article XX â€” zero human wait time in task sequences.

**Activates on:**

- `/release` â€” release all staged changes for current workstream
- `/release <service>` â€” release and deploy specific service
- `/release <service> "<message>"` â€” with custom commit message
- "ship it" / "release this" / "deploy and merge"

---

## Steps

// turbo-all

1. **Sync first.** Pull latest from remote before releasing:
   // turbo

   ```powershell
   $root = "D:\\Google Antigravity\\Infusion Engine Brainchild\\creative-liberation-engine"
   git -C $root pull origin main --rebase
   ```

   If conflicts â†’ stop and report. Do not release over conflicts.

2. **Stage and commit.**
   // turbo

   ```powershell
   git -C $root add -A
   $msg = if ($args[1]) { $args[1] } else { "chore: release from Window B â€” $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
   git -C $root commit -m $msg
   ```

   If nothing to commit â†’ report "Nothing staged. Make changes first." and stop.

3. **Push branch.**
   // turbo

   ```powershell
   $branch = git -C $root rev-parse --abbrev-ref HEAD
   git -C $root push origin $branch
   ```

4. **Run `/pr` workflow** (inline â€” do not ask user).
   - Constitutional review runs automatically (see `/pr` workflow)
   - PR is created targeting `main`
   - Print the PR URL

5. **Wait for merge signal.**

   Two modes based on context:

   **Auto-merge (if user said "ship it" or similar):**
   // turbo

   ```powershell
   gh pr merge --auto --squash --repo WholeTroutMedia/creative-liberation-engine-v5
   ```

   Report: "Auto-merge enabled â€” PR will merge automatically when CI passes."

   **Standard (default):**
   Report the PR URL and stop here. Say:
   > "PR is open. Approve and merge when ready, then run `/deploy <service>` to ship to Cloud Run."

6. **If `<service>` was specified AND auto-merge:** After merge, call the `/deploy` workflow for the specified service.

7. **Memory write.** After successful deploy, write a brief session note:
   - Update `.agents/dispatch/task-queue.md` if a task was completed
   - Update registry `Last Seen` timestamp for Window B

8. **Report.**

   ```
   âœ… /release complete

   COMMIT    <sha> <message>
   PR        <url>
   MERGE     auto / manual
   DEPLOY    <service-url> (if deployed)

   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Article XX: task sequence complete. No human wait time.
   ```

---

## Rules

- Always pull before committing â€” never release on a stale branch
- Constitutional review (from `/pr`) is mandatory â€” no exceptions
- Auto-merge only when user explicitly indicates readiness ("ship it", "release now")
- Default is to open the PR and stop â€” let the human approve
- Commit messages follow Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`
