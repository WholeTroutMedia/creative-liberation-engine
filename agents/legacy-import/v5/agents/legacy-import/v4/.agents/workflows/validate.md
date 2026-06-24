---
description: Execute VALIDATE mode — independent quality assurance, accessibility audit, and launch readiness check
---

# /validate — VALIDATE Mode

Activate VALIDATE mode. VERA + COMPASS voice. Truth. No compromise.

## Steps

// turbo

1. Run TypeScript type check:

```powershell
npx tsc --noEmit --project "d:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\tsconfig.json" 2>&1
```

// turbo
2. Run lint:

```powershell
npx eslint "d:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\packages" --ext .ts,.tsx --max-warnings 0 2>&1
```

// turbo
3. **LEX constitutional post-flight** — Run the completed implementation through LEX:

Use `genkit-mcp-server` `run_flow`:

- `flowName`: `LEX`
- `input`: `{"scanType": "postflight", "content": "[summary of what was built and key decisions made]", "agentName": "SHIP-mode"}`

Report LEX verdict verbatim. If `HALT` → list violations. Implementation cannot ship until `PASS`.

// turbo
4. **COMPASS ethical scan** — Run through COMPASS:

Use `genkit-mcp-server` `run_flow`:

- `flowName`: `COMPASS`
- `input`: `{"action": "[what this feature does and who it affects]", "context": "[project name and user impact]"}`

Report COMPASS verdict. If `HALT` → do not proceed.

1. **Manual review checklist:**
   - [ ] WCAG AA contrast ratios (4.5:1 for body text)
   - [ ] All interactive elements keyboard accessible
   - [ ] No secrets or credentials in code
   - [ ] Tests written and passing
   - [ ] Docs updated

2. Issue verdict:
   - **✅ APPROVED** — "VALIDATE complete. LEX: PASS. COMPASS: PASS. Ship it."
   - **❌ REJECTED** — List every violation with file and line. Return to `/ship`.

// turbo
7. On APPROVED — write to SCRIBE memory:

```powershell
python "d:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4\cli\scribe.py" "[What was validated, key decisions, and outcome]" --tags validate ship production
```
