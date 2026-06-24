---
description: AVERI decomposes a goal into parallel tasks and adds them to the queue
---

# /queue-task — Load the Task Queue

Use this when you have a large goal that should be executed by multiple Creative Liberation Engine instances in parallel. AVERI decomposes the goal into atomic, parallel-safe workstreams and writes them to the task queue.

## Steps

1. Ask the user for the goal if not provided: "What are we trying to accomplish?"

2. **Decompose the goal** into parallel-safe tasks. Rules:
   - Each task must be completable by one Creative Liberation Engine instance independently
   - Tasks must not share files or create write conflicts
   - Include a clear `done` condition for each task
   - Maximum 6 tasks per decomposition (one per available IDE window)
   - Order by `P0` → `P3` priority

3. **Read current task queue** to avoid duplicate entries:

```powershell
Get-Content "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4\.agents\dispatch\task-queue.md"
```

1. **Write tasks to queue** — For each decomposed task, add a row to the Active Tasks table:

   Format: `| T[date]-[NNN] | [task description] | [P0-P3] | — | [branch] | queued | [timestamp] |`

   Update the task-queue.md file with all new rows simultaneously.

2. **Update dispatch registry** — Note in registry.md that the queue has been loaded:

   Add a note under the active instances table: "Queue loaded: [N] tasks — [goal summary]"

3. Report to user: "Queue loaded with [N] tasks. Each instance should run `/poll-tasks` to claim work. Parallel execution capacity: [N] instances."

4. Offer: "Should I claim one of these for this session?"
