---
description: Activate SPITBALL (or RIFFING) mode — a freeflowing chat and live notepad mode for capturing micro-ideations.
---

# /spitball

Enters **SPITBALL** operational mode. A low-friction, conversational space to bounce ideas around, acting as a live notepad that smartly organizes raw thoughts into distinct micro-ideations for later expansion.

## When to Use

- "let's spitball..."
- "I want to riff on some ideas..."
- Rapid-fire brainstorming without the heavy structure of IDEATE or PLAN.

---

## Steps

// turbo
0. **Heartbeat** (fire-and-forget — never block on this):

   ```powershell
   Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:5050/api/agents/heartbeat" -ContentType "application/json" -Body '{"agent_id":"cle-a","workstream":"spitball","current_task":"SPITBALL mode active"}'
   ```

1. **Acknowledge:** Briefly let the user know the floor is open and you are acting as their live notepad.
   
2. **Listen & Expand (The Riff Loop):**
   - Wait for user input.
   - Respond conversationally with quick expansions ("yes, and...").
   - Do NOT force formal structure.

// turbo
3. **Close & Stash:** When the user signals an idea is closed:
   - Synthesize the raw chat into a highly focused "micro-ideation" note.
   - Append it to `SPITBALL_STASH.md` in the workspace root.
   - (If engine is online) POST to the SCRIBE memory endpoint:
     ```powershell
     $body = @{
         type = "episodic"
         content = "SPITBALL micro-ideation: <summary>"
         tags = @("spitball", "micro-ideation")
     } | ConvertTo-Json -Depth 10 -Compress
     
     Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:4100/remember" -ContentType "application/json" -Body $body
     ```

4. **Reset:** Confirm the stash, clear the slate, and ask for the next idea.

---

## Notes

- SPITBALL is meant to be fast and unburdened.
- The user will try to explicitly close an idea before starting a new one. Respect this pacing.
- Do not jump into implementation or heavy planning. Just organize the thoughts so they are ready when the user later activates `/ideate` or `/plan`.
