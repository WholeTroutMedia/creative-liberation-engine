---
name: VALIDATE Mode
description: Activate VALIDATE mode — LOGD + NORTHSTAR run independent quality assurance, constitutional compliance audits, and launch readiness checks. Use when user says 'validate', 'review', 'QA', 'is this ready', or after SHIP completes a major feature.
---

# VALIDATE Mode — Creative Liberation Engine v5

## When to Use This Skill

Activate VALIDATE when:
- User says "validate this", "review the code", "QA", "is this ready to ship"
- SHIP mode completes a significant feature (not just a bug fix)
- A PR is being prepared — run before `/pr` for constitutional compliance
- A new service is being added to the GENESIS stack

---

## Operating Principals

**Lead agents:** LOGD (Analyst), NORTHSTAR (Constitutional Guardian)
**Support agents:** LEX (Legal/contract review for Zero-Day features), BEACON (Accessibility)

---

## The VALIDATE Pipeline

Run all sections in order. Do not skip sections even if they seem irrelevant.

---

## Section 1 — Structural Integrity

### 1a. TypeScript Compliance
```powershell
# Full workspace type check
pnpm --filter "@cle/*" type-check

# Or per-package
npx tsc --noEmit -p packages/<package>/tsconfig.json
```
**Pass condition:** Zero errors. Zero suppressed errors (`// @ts-ignore`, `// @ts-expect-error`).

### 1b. Schema Validation (Genkit Flows)
For any Genkit flow changes, verify:
- Input schema and output schema are both defined with Zod
- Flow is registered in `server.ts` and accessible via HTTP
- Health endpoint still returns `{ status: 'operational' }` after changes

### 1c. Export Integrity
```powershell
# Ensure all new public APIs are exported
grep -r "export" packages/<package>/src/index.ts
```
Every new type, class, and function intended for external use must be in `index.ts`.

---

## Section 2 — Test Coverage

### 2a. Run Test Suite
```powershell
pnpm test
```

**Pass condition:** All tests pass. Zero skipped tests without documented reason.

### 2b. Coverage Check (for new features)
New code introduced in this feature must have:
- **Core business logic:** Unit tests covering happy path + at least 2 edge cases
- **REST endpoints:** Integration test covering success response + error response
- **Genkit flows:** At least one end-to-end invocation test

If coverage gaps exist, write the missing tests before marking VALIDATE complete.

---

## Section 3 — Constitutional Review

NORTHSTAR runs each article check silently. Flag any violations.

| Article | Check | Status |
|---------|-------|--------|
| **Article I** (Sovereignty) | Does new code depend on external cloud services that could be self-hosted? | |
| **Article IV** (Quality) | All TypeScript strict? No `any`? | |
| **Article IX** (No MVP) | Is every feature complete? No stubs or TODOs? | |
| **Article XX** (Automation) | Is there any human wait time that could be eliminated? | |
| **Article XIV** (Memory) | Should this result be written to SCRIBE memory? | |

**If any article fails:** Stop validation. Return to SHIP mode, fix the violation, re-run VALIDATE.

---

## Section 4 — UI/Design System Audit

Run this section only if the change includes UI components.

### 4a. Design Token Compliance
All colors must use CSS custom properties — no hardcoded hex, rgb, or hsl literals in component code:
```bash
# Check for hardcoded colors in tsx/css files
grep -rn "hsl\|#[0-9a-fA-F]\{3,6\}\|rgb(" packages/*/src/**/*.{tsx,css}
```
**Exception:** Design token definitions in `index.css` only.

### 4b. Responsive Layout
Every new page/panel must render correctly at:
- `1440px` — Desktop primary
- `768px` — Tablet
- `375px` — Mobile (if applicable to the surface)

### 4c. Accessibility (BEACON Check)
- All interactive elements have `aria-label` or visible label text
- Color contrast meets WCAG AA (4.5:1 for text)
- Keyboard navigation works: Tab, Enter/Space for buttons, Escape for modals
- No `onClick` on non-interactive elements without `role` and `tabIndex`

### 4d. Live V1 surface — preview URL (when the feature ships a user-facing app or embed)

When the deliverable includes a **runnable UI** that operators or collaborators are meant to trust as **V1** (not a throwaway spike), VALIDATE must treat **preview** as first-class:

- **Reachable preview URL:** The app (or stable dev/preview host) is reachable on the documented host/port or reverse-proxy path; TLS or auth expectations are documented if non-obvious.
- **Built-in browser proof:** At least one **core user path** is exercised end-to-end in the **IDE or console built-in browser** (or the repo’s documented equivalent automation), not only “curl returns 200.” The path must match what you would show a collaborator or client.
- **Working, not theatrical:** No **demo-only** or **stub** responses presented as production behavior. Lorem data, mocked backends, or feature flags that hide the real path are **only** acceptable if explicitly labeled **sandbox** and **excluded** from the V1 launch claim.
- **Horizon (not blocking V1):** Additional live-design channels (shared canvas, token/screenshot timelines, generated-frame pipelines) may ship later; **V1 defaults to preview URL** when the stack already includes an embedded browser.

**Pass condition:** Verifier can complete the documented core path in the built-in browser against the stated preview URL without hitting placeholder behavior marketed as done.

Skip **4d** when the change is API-only, library-only, or Quick VALIDATE; state **“4d N/A — no user-facing preview surface.”**

---

## Section 5 — API Contract Verification

For any service/endpoint changes:

### 5a. Backward Compatibility
- Does this change break any existing API contract?
- Are existing consumers (console, other services) still compatible?
- If breaking: is a migration path documented?

### 5b. Error Handling
Every REST endpoint must:
```typescript
// ✅ Required pattern
app.get('/api/resource', async (req, res) => {
  try {
    const result = await service.doThing();
    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});
```

---

## Section 6 — Launch Readiness Checklist

```
[ ] TypeScript: zero errors
[ ] Tests: all pass, new code covered
[ ] Constitutional: all articles pass
[ ] UI: design tokens used, responsive, accessible (if applicable)
[ ] Live V1 (if user-facing preview ships): preview URL + built-in browser core path proven; no demo/stub passed off as V1 (see §4d)
[ ] API: backward compatible, errors handled
[ ] Exports: all public APIs exported from index.ts
[ ] Dispatch: task marked done in task-queue.md
[ ] SCRIBE: memory written if significant new pattern or decision
```

---

## VALIDATE Output Format

After running all sections, produce a structured report:

```markdown
## VALIDATE Report — [Feature Name] — [Timestamp]

**Verdict:** ✅ LAUNCH READY | ⚠️ CONDITIONALLY READY | ❌ BLOCKED

### Passed
- [List of checks that passed]

### Warnings (non-blocking)
- [List of concerns that don't block launch but should be addressed soon]

### Blockers (must fix before launch)
- [List of critical failures with specific files/lines]

### Recommended Memory Write
[If applicable: what LOGD should write to SCRIBE]
```

---

## Quick VALIDATE (for small changes)

For bug fixes, typo corrections, or single-line changes, run a fast track:

1. TypeScript check on affected package only
2. Run affected test file only
3. Constitutional check: Articles IX and IV only
4. Skip UI audit and API contract sections

State explicitly: "Running Quick VALIDATE (small change)" to distinguish from full audit.
