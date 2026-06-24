---
description: Mark a task complete, commit work, and immediately poll for the next task
---

# /complete-task — Complete and Advance

Mark the current task done, commit all work, move it to the completed table, and immediately claim the next available task.

// turbo

1. **Commit all work** for current task:

```powershell
git -C "[repo-root]" add .
git -C "[repo-root]" commit -m "feat([task-id]): [task description] — complete"
git -C "[repo-root]" push
```

// turbo
2. **Update task-queue.md** — Move the task from Active to Completed:

- Remove the row from Active Tasks table
- Add to Completed Tasks table: `| [ID] | [task] | [result summary] | [this instance] | [timestamp] |`

// turbo
3. **Write to SCRIBE memory**:

```powershell
python "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4\cli\scribe.py" "Completed task [ID]: [task description]. Result: [1-2 sentence outcome]" --tags task-queue autonomous ship
```

1. **Poll for next task** — Immediately run `/poll-tasks`. If queue is empty, report: "Queue exhausted. All [N] tasks complete. Notifying AVERI."

2. If all tasks in the queue are done, update dispatch registry: clear the queue note and flag the goal as complete.
