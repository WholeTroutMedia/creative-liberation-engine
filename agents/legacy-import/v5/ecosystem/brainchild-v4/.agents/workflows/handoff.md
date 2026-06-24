---
description: Handoff a workstream from this Creative Liberation Engine instance to another IDE window — commits current progress, releases ownership, and leaves a pickup note
---

# /handoff — Handoff a Workstream

Transfer your claimed workstream to another IDE window cleanly. Commits progress, releases the registry entry, and leaves a pickup note.

## Steps

1. Confirm with the user what work was completed and what is left to do.

// turbo
2. Stage and commit all current work:

```powershell
git -C "[repo-root]" add .
git -C "[repo-root]" commit -m "wip([workstream]): handoff checkpoint — [brief description of state]"
git -C "[repo-root]" push origin [branch]
```

// turbo
3. Write a pickup note to `.agents/dispatch/handoff-[workstream].md`:

Create the file with:

- What was completed
- What is remaining
- Key files touched
- Any blockers or gotchas
- Branch name to resume from

1. Update `.agents/dispatch/registry.md` — change this instance's row to `status: handoff` and clear the Window assignment.

2. Confirm: "Handoff complete. The next instance can pick up from branch `[branch]` — pickup note at `.agents/dispatch/handoff-[workstream].md`."
