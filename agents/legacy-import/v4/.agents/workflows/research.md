---
description: Inline research using Perplexity — run during any task without breaking flow
---

# /research — Inline Research

Run Perplexity-powered research inline during any task. No tab switching, no copy-paste. Results land directly in context.

## Steps

1. Ask the user what to research if not provided: "What should I look up?"

// turbo
2. **Run Perplexity search** via MCP:

Use `perplexity-ask` MCP tool `perplexity_ask` with:

```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a research assistant for the Creative Liberation Engine — a sovereign AI operating system. Research thoroughly, cite sources, and focus on practical, implementable findings. Flag anything that conflicts with sovereign-first (self-hosted preferred) architecture."
    },
    {
      "role": "user",
      "content": "[user's research query]"
    }
  ]
}
```

1. **Augment with engine search** — Also search ChromaDB for related past work:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:4100/retrieve" -ContentType "application/json" -Body "{`"query`": `"[research query]`", `"nResults`": 5}" 2>$null
```

1. **Synthesize** — Combine Perplexity findings with internal knowledge. Present as:
   - **External findings** (from web, with citations)
   - **Internal context** (from ChromaDB / past sessions)
   - **Recommended action** (how this applies to the current task)

2. Return to the interrupted task with research embedded in context.
