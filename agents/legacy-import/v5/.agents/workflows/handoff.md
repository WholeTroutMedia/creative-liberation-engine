---
description: Release this window's workstream claim and leave a handoff note for the next instance
---

# /handoff

Use this workflow before closing this IDE window or switching to a different project. It releases your workstream claim and writes a brief note so the next instance can pick up exactly where you left off.

## Steps

1. **Determine Active Task**
   Identify the `TASK_ID` you are currently working on.

2. **Auto-Generate Handoff Note (Article XX):**
   - Synthesize a concise handoff note based on the state of the active files, the recently completed tasks, and current system context.
   - Do NOT ask the user. Zero wait time.

3. **Vault Significant Decisions (SCRIBE → NAS):**
   - Before releasing the task, determine if this session produced a meaningful decision, architectural pattern, or resolved blocker.
   - If yes → run `/vault` now. This commits the session context to Chroma/SCRIBE on the NAS so it survives an OS reinstall, is accessible cross-machine, and compounds into future agent context.
   - If the session was purely mechanical (typo fix, single config change) → skip vault and continue.
   - **Do NOT skip vault for:** architecture decisions, new agent behaviours, design contracts, schema changes, major debugging breakthroughs.

// turbo
4. **Update Dispatch Server:**
   - Patch the task natively to release it back into the queue for another agent to pick up.
   - Run the following command, assigning the note to the `handoff_note` field and updating the status to `handoff`.

   ```powershell
   $body = @{ status = "handoff"; handoff_note = "[user's handoff note]" } | ConvertTo-Json
   Invoke-RestMethod -Uri "http://127.0.0.1:5050/api/tasks/[TASK_ID]" -Method PATCH -ContentType "application/json" -Body $body
   ```

5. Confirm to the user:
   > ✅ **Handoff complete.** This window has released the task.
   > Another window can claim this workstream with `/pickup`.

## Rules

- Always run `/handoff` before closing if work is mid-flight
- Never just close without handing off — it leaves the task locked in 'active' state
- The next instance claiming a `handoff` workstream should read the handoff notes before touching any files
