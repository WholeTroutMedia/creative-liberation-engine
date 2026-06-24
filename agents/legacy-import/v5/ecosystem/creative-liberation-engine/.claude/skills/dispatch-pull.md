---
description: Pull the next available task from the Creative Liberation Engine Dispatch server and prepare it for execution.
---

# Skill: dispatch-pull

Pull the highest-priority unclaimed task from the Dispatch server and return it in a structured format ready for Claude to execute.

## Steps

1. Make a GET request to `http://127.0.0.1:5050/api/status`
2. From the `queued_tasks` array, find the first task where `status === "queued"` and `claimed_by === null`, ordered by priority (P1 first)
3. If no task is available, report "No queued tasks available â€” Dispatch queue is empty"
4. Format the task clearly:

```
Task ID: [id]
Workstream: [workstream]
Priority: [priority]
Title: [title]
Dependencies: [dependencies or "none"]
```

1. Ask: "Should I claim this task and begin execution?"
2. If confirmed, POST to `http://127.0.0.1:5050/api/tasks/[id]/claim` with body:

   ```json
   { "agent_id": "claude-agent", "tool": "claude-code" }
   ```

7. Fire heartbeat: POST to `http://127.0.0.1:5050/api/agents/heartbeat` with:

   ```json
   { "agent_id": "claude-agent", "workstream": "[workstream]", "current_task": "[id]: [title]", "tool": "claude-code" }
   ```

## Error Handling

- If Dispatch server is unreachable, read `.agents/dispatch/task-queue.md` as fallback
- Always report which task you claimed before starting work
