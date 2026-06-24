---
description: Pull latest changes from remote before starting work in this window
---

# /sync

// turbo-all

Run this at the start of every session, right after `/claim`, to ensure you have the latest code before touching any files. Essential when multiple windows are active.

## Steps

// turbo

1. Run `git -C "Y:\\creative-liberation-engine" status` to check for any uncommitted local changes.

// turbo
2. Run `git -C "Y:\\creative-liberation-engine" pull origin main --rebase` to pull latest.

1. Report the result:
   - If up to date: `Ã¢Å“â€¦ Already up to date on main.`
   - If pulled: `Ã¢Å“â€¦ Pulled [N] new commits. You're on latest.`
   - If conflicts: `Ã¢Å¡Â Ã¯Â¸Â Merge conflicts detected. Resolve before proceeding.` Ã¢â‚¬â€ list the conflicting files.

2. Also check `.agents/dispatch/registry.md` for any `handoff` notes relevant to your claimed workstream and surface them:
   > Ã°Å¸â€œâ€¹ **Handoff note found for `[workstream]`:** [note text]

## Rules

- Always `/sync` before starting work if other windows may have committed since your last session
- Never skip `/sync` when picking up a `handoff` workstream

