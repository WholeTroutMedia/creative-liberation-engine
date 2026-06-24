# Context Efficiency Protocol (CEP)

> **V6 Governance Document** — Binding on all agent sessions.
> Precedence: Equal to ROUTING_CONTRACT.md in the governance stack.

---

## Problem Statement

Design-heavy projects (Luminous Gallery, Barnstorm Deck, Sentinel Command, World Compiler) repeatedly fail to complete because agent sessions accumulate:

- **Generated images** held in context instead of stored externally
- **Full file reads** when only targeted sections are needed
- **Intermediate state** (error logs, build output, prior attempts) never evicted
- **Redundant re-reads** of unchanged files across conversation turns

This is a self-inflicted context window collapse. The fix is operational discipline enforced by protocol.

---

## Core Principle

> **The context window is a workbench, not a warehouse.**
> Only the material actively being worked on belongs in context.
> Everything else is a pointer to an external location.

---

## Rules

### R1 — Image Externalization (Mandatory)

**Every generated or referenced image MUST be externalized immediately.**

| Step | Action |
|------|--------|
| 1 | Generate image via `generate_image` tool |
| 2 | Record the artifact path returned |
| 3 | Write a **one-line reference** to the project's `_context/media-index.md` |
| 4 | **Never re-read the image** into context — reference by path only |

**Project media index format** (`_context/media-index.md`):
```markdown
# Media Index — [Project Name]

| ID | Description | Path | Generated |
|----|-------------|------|-----------|
| img-001 | Hero section background | /path/to/hero_bg.webp | 2026-04-30 |
| img-002 | Card thumbnail variant A | /path/to/card_a.webp | 2026-04-30 |
```

When referencing in conversation: `"Using img-001 (hero background)"` — never embed.

### R2 — Surgical File Access

**Read only the lines you need. Full-file reads are a last resort.**

| Scenario | Action |
|----------|--------|
| Need to edit a function | `view_file` with `StartLine`/`EndLine` targeting that function |
| Need overall structure | `view_file` first 50 lines (imports + exports), then targeted sections |
| Need to find something | `grep_search` first, then `view_file` the specific range |
| Brand new file | Full read is acceptable on first access only |

**Budget per file access:** ≤200 lines unless the task specifically requires more.

### R3 — Context Eviction

**After completing a subtask, mentally release its context.**

- Finished editing `page.tsx`? Don't carry its full contents into the next subtask.
- Got a build error, fixed it, confirmed the fix? Drop the error output.
- Generated 3 image variants, user picked one? Forget variants 2 and 3.

**Eviction triggers:**
- Build succeeds → evict build logs
- File edit confirmed → evict file contents
- Image generated and indexed → evict image data
- Subtask complete → evict all intermediate state

### R4 — Project Context Files

**Every design-heavy project MUST maintain a `_context/` directory:**

```
project-root/
├── _context/
│   ├── media-index.md      # All images/media with paths
│   ├── state.md             # Current progress, decisions made
│   ├── component-map.md     # Component inventory with line ranges
│   └── decisions.md         # Design decisions (don't re-derive)
├── src/
└── ...
```

**On session start:** Read only `_context/state.md` (lightweight) to orient.
**During work:** Update `_context/state.md` after each major milestone.
**On session end:** Write final state to `_context/state.md` for next session.

### R5 — Conversation Continuation Budget

**When a conversation approaches context limits:**

1. Write current state to `_context/state.md`
2. Index all generated media in `_context/media-index.md`
3. Commit any in-progress code changes
4. Tell the user: *"State saved. Start a new conversation — I'll pick up from `_context/state.md`."*

**Never** try to power through a full context window. The quality of output degrades catastrophically.

### R6 — Stitch Project Efficiency

**For Stitch (UI design) projects:**

- Store project ID and screen IDs in `_context/state.md` — don't re-list every turn
- After `generate_screen_from_text`, record only the screen ID and a one-line description
- Before editing screens, read `_context/state.md` for IDs — don't call `list_screens` again
- Design system asset IDs are stable — cache in `_context/state.md` on first retrieval

### R7 — Knowledge Item Offloading

**Large discoveries or patterns → Write a KI, don't hold in context.**

If you discover something reusable (API patterns, CSS techniques, component architectures):
1. Write it to a KI artifact immediately
2. Reference the KI path going forward
3. Release the discovery details from active context

---

## Budget Guidelines

| Resource | Budget | Action if Exceeded |
|----------|--------|--------------------|
| Total file content in context | ≤2000 lines | Evict oldest files, use grep |
| Images in context | 0 (always externalized) | Index and reference by path |
| Build/error output | ≤50 lines | Truncate, capture only error lines |
| Prior conversation state | ≤100 lines via `_context/state.md` | Summarize, don't replay |
| Component map | ≤50 lines | One line per component with line range |

---

## Anti-Patterns (Banned)

| Anti-Pattern | Why It Kills Context | Do This Instead |
|---|---|---|
| Reading entire 500-line CSS file to change one color | Wastes 490 lines of budget | `grep_search` for the selector, `view_file` that 10-line range |
| Holding 5 generated images while iterating | ~50% context wasted on binary data | Index each image immediately, reference by ID |
| Re-reading `layout.tsx` every turn | Unchanged file re-consumed | Read once, cache structure in `_context/component-map.md` |
| Keeping failed build output after fixing the error | Stale errors pollute context | Evict after confirmed fix |
| Explaining what you're about to do in 3 paragraphs | Burns tokens on narration | Brief plan → execute → brief result |
| Re-listing Stitch projects/screens every turn | API calls return same data | Cache IDs in `_context/state.md` |

---

## Enforcement

This protocol is **self-enforcing** — there is no external validator. The agent must:

1. **Check** before each file read: "Do I need the full file or just a section?"
2. **Check** after each subtask: "What can I evict?"
3. **Check** before each image operation: "Is this indexed?"
4. **Check** when context feels heavy: "Should I checkpoint and suggest a new conversation?"

Failure to follow this protocol is a **governance violation** equivalent to violating Article IX (no MVPs) — it produces incomplete work due to preventable resource exhaustion.

---

## Integration Points

- **MEMORY_SPINE.md**: `_context/state.md` files are `ephemeral` retention class — session-scoped working memory
- **ROUTING_CONTRACT.md**: Route design-heavy tasks to sessions with CEP-aware boot sequence
- **HANDOFF.md**: On handoff, `_context/state.md` becomes the primary resumption artifact
- **AGENTS.md**: Add CEP to Step 0 boot sequence for design-heavy projects
