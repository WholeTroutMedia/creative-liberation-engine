---
description: Instance reads the task queue and self-assigns the next available task
---

# /poll-tasks — Poll and Claim from Task Queue

An instance reads the task queue and claims the highest-priority unclaimed task. Self-directed execution.

// turbo-all

## Steps

1. Read both task queues:

```powershell
Get-Content "d:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4\.agents\dispatch\task-queue.md"
Get-Content "d:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\.agents\dispatch\task-queue.md"
```

1. Find the highest-priority task with `status: queued` and `owner: —`. If multiple tasks share the same priority, take the oldest (lowest task ID).

2. If no unclaimed tasks exist: "Queue is empty. All tasks claimed or completed. Stand by or request new decomposition from AVERI via `/queue-task`."

3. **Claim the task** — Update the task row:
   - `Owner`: `Window-[N]` (identify this instance by workspace + current workstream)
   - `Status`: `active`
   - `Branch`: create feature branch if needed

4. Confirm claim to user: "Claimed task **[ID]**: [task description]. Starting now."

5. Immediately begin executing the claimed task in SHIP mode (use `/ship` workflow behavior).

6. On completion, run `/complete-task` to release and poll for next.
