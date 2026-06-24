---
description: Activate PLAN mode â€” VAULT + STRATA spec + LOGD truth-check, produces HANDOFF.md and auto-adds a dispatch task for SHIP mode
---

# /plan <topic>

Enters **PLAN** operational mode. VAULT synthesizes institutional knowledge, STRATA produces a precise implementation spec, LOGD truth-checks it, and on approval, writes `HANDOFF.md` + auto-creates a dispatch task.

## When to Use

- After `/ideate` â€” moving from creative exploration to implementation commitment
- When starting a complex feature spanning multiple files or services
- Before dispatching any SHIP mode execution
- Any time a LOGD-validated architectural decision is needed

---

## Steps

// turbo
0. **Heartbeat** (fire-and-forget):

   ```powershell
   Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:5050/api/agents/heartbeat" -ContentType "application/json" -Body '{"agent_id":"cle-a","workstream":"plan","current_task":"PLAN mode active"}'
   ```

1. **Extract topic** from the user message. If a HANDOFF.md exists with `phase: "IDEATE"`, read the selected direction as additional context.

2. **Determine depth:**
   - "quick plan" / "fast" â†’ `surface`
   - Default â†’ `deep`
   - "full architecture" / "exhaustive spec" â†’ `exhaustive`

// turbo
3. **Retrieve SCRIBE memory** â€” NAS-first, localhost fallback:

   ```
   POST http://127.0.0.1:4100/retrieve  { "query": "<topic>", "limit": 5 }
   POST http://localhost:4100/retrieve      (fallback)
   ```

   Include any prior architectural decisions, patterns, or related KIs in the planning context.

1. **Generate the spec** â€” STRATA produces:

   ```markdown
   ## STRATA's PLAN Directive
   > [directive â€” what we are building and why]

   **Rationale:** [rationale]

   ## Implementation Options
   For each option:
   - **Title** â€” [name]
   - **Description** â€” [what it does]
   - **Tradeoffs** â€” [pros/cons]
   - **Badge:** âœ… preferred | âš ï¸ viable | âŒ avoid

   ## Task Decomposition
   Atomic implementation units (each = one file or one function change):
   1. [ ] [file/function â€” what changes]
   2. [ ] ...

   ## Affected Packages
   - `packages/<name>` â€” [what changes]

   ## Dependencies
   - [Any external deps, prerequisites, or blocked-on items]
   ```

2. **LOGD Validation** â€” Check against constitutional articles and institutional memory:

   ```markdown
   ## LOGD Validation
   - **Confidence:** [X]%
   - **Verdict:** [APPROVED | FLAGGED]
   - **Contradictions:** [list, or "None detected âœ…"]
   - **Constitutional flags:**
     - Article I (Sovereignty): [pass/flag]
     - Article IV (Quality/TypeScript strict): [pass/flag]
     - Article IX (No MVP): [pass/flag]
     - Article XX (Automation): [pass/flag]
   - **Extracted Pattern:** [reusable pattern for SCRIBE â€” e.g., "Redis pub/sub for async chaining"]
   ```

   - `planApproved: true` = LOGD confidence â‰¥ 70% AND zero constitutional contradictions
   - `planApproved: false` = Show LOGD's concerns prominently with âš ï¸ â€” do NOT auto-proceed, ask user to resolve

3. **On LOGD approval** â€” Write `HANDOFF.md` at repo root:

   ```json
   {
     "phase": "PLAN",
     "from": "ANTIGRAVITY",
     "timestamp": "<ISO timestamp>",
     "topic": "<topic>",
     "branch": "feat/<topic-kebab-slug>",
     "workstream": "<derived workstream>",
     "task_decomposition": ["item1", "item2", "..."],
     "affected_packages": ["packages/<name>"],
     "next": "Implement: <1-sentence summary of what to build>"
   }
   ```

// turbo
7. **Write LOGD's extracted pattern to SCRIBE** (fire-and-forget):

   ```
   POST http://127.0.0.1:4100/remember
   {
     "type": "semantic",
     "content": "<pattern from LOGD>",
     "tags": ["plan", "<topic-slug>", "architecture"]
   }
   ```

// turbo
8. **Auto-add dispatch task** (fire-and-forget):

   ```
   POST http://127.0.0.1:5050/api/tasks
   {
     "title": "SHIP: <topic>",
     "description": "<STRATA plan directive>",
     "workstream": "<derived workstream>",
     "priority": "P1",
     "source": "plan-mode-auto"
   }
   ```

1. **Display final output:**

   ```
   **Plan Status:** âœ… APPROVED â€” LOGD confidence [X]% | âš ï¸ FLAGGED â€” see contradictions above

   **Next Steps:**
   - Branch: `feat/<topic-slug>`
   - Task auto-added to dispatch queue as P1
   - Run `/ship` in the appropriate IDE window to begin implementation
   - Or: continue with `/design <topic>` to generate UI screens first
   ```

---

## Notes

- PLAN temperature is 0.2 â€” deterministic, spec-grade output
- If plan is flagged, never auto-proceed â€” show LOGD's concerns first
- LOGD's extracted pattern is valuable institutional knowledge â€” always write it to SCRIBE
- Dispatch task auto-creation enables any other IDE window or the NAS daemon to pick up the SHIP work
