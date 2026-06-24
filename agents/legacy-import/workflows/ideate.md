---
description: Activate IDEATE mode â€” VAULT + STRATA explore a topic, map the possibility space, generate creative directions, and prime HANDOFF.md for PLAN mode
---

# /ideate <topic>

Enters **IDEATE** operational mode. VAULT retrieves institutional memory, STRATA + PRISM generate 5 creative directions, and on direction selection, HANDOFF.md is written to prime PLAN mode automatically.

## When to Use

- Starting a new feature, product, or campaign
- Exploring a design space before committing to a spec
- After `/browser-ideate` primes a creative brief
- When a PLAN task surfaces open design questions

---

## Steps

// turbo
0. **Heartbeat** (fire-and-forget â€” never block on this):

   ```powershell
   Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:5050/api/agents/heartbeat" -ContentType "application/json" -Body '{"agent_id":"cle-a","workstream":"ideate","current_task":"IDEATE mode active"}'
   ```

1. **Extract topic** from the user message. Collect open file context from the IDE as supplementary context.

2. **Determine depth:**
   - "quick" / "fast" â†’ `surface`
   - Default â†’ `deep`
   - "exhaustive" / "architecture-grade" / "fully explore" â†’ `exhaustive`

// turbo
3. **Retrieve SCRIBE memory** â€” NAS-first, localhost fallback:

   ```
   POST http://127.0.0.1:4100/retrieve  { "query": "<topic>", "limit": 5 }
   POST http://localhost:4100/retrieve      (fallback if NAS unreachable)
   ```

   Surface any prior IDEATE sessions, brand decisions, or relevant KIs. If engine is fully offline, proceed with built-in CORTEX reasoning â€” never block IDEATE on engine availability.

4. **ATELIER + toolchain (visual sessions only, internal)** â€” If the topic implies a user-facing surface, read `docs/design-system/design-toolchain.md` (user-facing contract: **tool silence**) and `pattern-index.md`, then skim the **two most relevant** `tools/design-library/<source>/README.md` files. Keep **three anchors internal** for DESIGN_CONTRACT; **user-facing** output uses plain-language work sections â€” not tool names or paths. For infra-only topics, skip this step.

5. **Define the Possibility Frame** â€” STRATA maps:
   - What is this *really* about? (underlying need, not surface request)
   - Who is it for? (access tier: Studio / Client / Merch)
   - What constraints exist? (tech stack, sovereignty policy, existing components)
   - What's adjacent? (related Creative Liberation Engine projects)

   Output: 2â€“3 sentence scoping frame.

6. **Generate 5 Directions** â€” PRISM produces each direction using this exact template:

   ```
   ## [Direction Name] â€” [Evocative Subtitle]

   **The Bet:** One sentence on what this direction is optimizing for.
   **Visual Language:** Color, motion, density, metaphor.
   **Key Feature / Mechanic:** The defining interaction or capability.
   **Inspiration:** Real-world reference (product, art, architecture, etc.)
   **Risk:** What could go wrong or what's unproven here.
   ```

   Directions must span a spectrum: safe/familiar â†’ ambitious/novel.
   Do NOT default to "Warm Trichromatic" or legacy styles unless explicitly requested.
   Encourage full creative freedom â€” wildly different palettes, layouts, and typographic combinations.

7. **STRATA's Pick** â€” After all 5, STRATA selects the strongest and explains:
   - Why this direction best serves the underlying need
   - Which elements to borrow from the others
   - What to validate before committing

8. **Route next step (align with `.agents/skills/ideate/SKILL.md` Step 5):**
   - **Product / UI / experience** â€” Transition to `/design` with STRATA's pick, runner-up, compiled visual prompts (Prompt Compiler in DESIGN skill), and the **three ATELIER anchors** from step 4. Do not skip DESIGN for visual work.
   - **Infrastructure / OS / architecture** â€” Transition to `/plan <topic>` with STRATA's selected direction. No DESIGN pass unless the user asks for one.

9. **On user selection of a direction** â€” write `HANDOFF.md` at repo root:

   ```json
   {
     "phase": "IDEATE",
     "from": "ANTIGRAVITY",
     "timestamp": "<ISO timestamp>",
     "topic": "<topic>",
     "selected_direction": "<direction name>",
     "direction_summary": "<1 sentence summary>",
     "next": "Run /design <topic> if UI surface; else /plan <topic>"
   }
   ```

// turbo
10. **Write to SCRIBE memory** (fire-and-forget):

   ```
   POST http://127.0.0.1:4100/remember
   {
     "type": "episodic",
     "content": "IDEATE session on <topic>. Direction selected: <direction name>. Summary: <1 sentence>.",
     "tags": ["ideate", "<topic-slug>"]
   }
   ```

---

## Notes

- IDEATE temperature is 0.7 â€” expect creative, non-deterministic output
- VAULT runs before generation so STRATA's strategy is informed by institutional memory
- After step 8, auto-proceed to `/design` or `/plan` per surface type â€” do not stall waiting for optional user direction unless the Discovery Gate in the IDEATE skill applies
- If constitutional flags arise, highlight with âš–ï¸
- Every direction must be buildable within the Creative Liberation Engine ecosystem (Article IX)
