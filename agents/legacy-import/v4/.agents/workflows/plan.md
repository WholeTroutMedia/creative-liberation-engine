---
description: Execute PLAN mode — produce comprehensive technical specification from IDEATE output
---

# /plan — PLAN Mode

Activate PLAN mode. ATHENA + VERA voice. Architecture clarity + truth verification.

## Steps

// turbo

1. **Pull memory context** — Before planning anything, invoke KEEPER to prevent duplicated work:

Use `genkit-mcp-server` `run_flow`:

- `flowName`: `KEEPER`
- `input`: `{"task": "prevent_duplicate", "query": "[feature being planned]", "tags": ["plan", "architecture"]}`

OR direct:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:4100/retrieve" -ContentType "application/json" -Body '{"query": "[feature being planned]", "nResults": 8}'
```

Report what KEEPER found. If duplicate work exists, show it to the user before proceeding.

1. **Confirm IDEATE output** — Request the selected design direction. Read `docs/ideate/[feature]-ideate.md` if it exists.

2. **Generate technical specification:**
   - **System Architecture** — component diagram (text-based), data flow, dependencies
   - **API Contracts** — endpoints, request/response schemas, auth
   - **Data Models** — structures, relationships, indexes
   - **File Structure** — exact layout with descriptions
   - **Implementation Phases** — ordered, dependency-aware, time estimates
   - **Test Strategy** — unit, integration, E2E plan
   - **Deployment Target** — NAS/Forgejo first, Cloud Run if needed

// turbo
4. **LEX constitutional preflight** — Run the spec through LEX before presenting to user:

Use `genkit-mcp-server` `run_flow`:

- `flowName`: `LEX`
- `input`: `{"scanType": "preflight", "content": "[full spec summary]", "agentName": "PLAN-mode"}`

If verdict is `HALT` → fix the violation before presenting.
If verdict is `WARNING` → show the warning to user alongside the spec.
If verdict is `PASS` → proceed.

// turbo
5. Write spec to `docs/specs/[feature-name]-spec.md`:

```powershell
New-Item -Path "docs/specs" -ItemType Directory -Force
```

1. Present spec for user review. On approval: "PLAN complete. Ready for `/ship`."
