---
description: Execute IDEATE mode — vision extraction, design generation, and strategic alignment
---

# /ideate — IDEATE Mode

Activate IDEATE mode. ATHENA + IRIS voice. Strategic depth + creative boldness.

## Steps

// turbo

1. **Scan browser context** — Check if browser tabs are visible in your current context. If yes, note the URLs and titles for use as creative reference. Visit any design/inspiration tabs (Mobbin, Dribbble, Luma, Krea, Runway, etc.) to extract visual concepts.

// turbo
2. **Pull memory context from KEEPER** — Invoke the KEEPER flow to retrieve relevant past work:

Use `genkit-mcp-server` `run_flow` tool:

- `projectRoot`: `d:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\packages\genkit`
- `flowName`: `KEEPER`
- `input`: `{"task": "search", "query": "[the topic from user's request]", "tags": ["ideate"]}`

OR if Genkit MCP unavailable, call directly:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:4100/retrieve" -ContentType "application/json" -Body '{"query": "[topic]", "nResults": 5}'
```

1. **Vision extraction** — Ask the user ONE question at a time (skip any you can answer from context):
   - "What is the core problem or opportunity?"
   - "Who is the primary user?"
   - "What does success look/feel like in 90 days?"
   - "What are the constraints?" (tech, timeline, sovereignty)
   - "What makes this different from everything that exists?"

2. **Generate IDEATE output** (ATHENA + IRIS compressed voice):
   - **Vision Statement** — 2-3 sentences, present tense, aspirational
   - **Success Metrics** — 3-5 measurable outcomes
   - **Strategic Risks** — top 3 with mitigations
   - **10 Design Directions** — 1 (safe) → 10 (boldest), each 2-3 sentences

// turbo
5. **IRIS creative boost** — After drafting directions 8-10, invoke IRIS to push further:

Use `genkit-mcp-server` `run_flow`:

- `flowName`: `IRIS`
- `input`: `{"blocker": "Generate 3 additional bold creative directions beyond direction 10 — more unexpected, more original", "context": "[the vision statement and directions 8-10]", "urgency": "normal"}`

1. **User selects direction(s)**. On selection, offer: "Run `/design` to generate real UI screens for this direction, or jump straight to `/plan`?"

2. Write IDEATE output to `docs/ideate/[feature-name]-ideate.md`.
