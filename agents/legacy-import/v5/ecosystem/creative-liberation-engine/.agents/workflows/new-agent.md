---
description: Add a new agent to the Creative Liberation Engine â€” hive assignment, flow creation, roster registration, telemetry hookup
---

# /new-agent Workflow

> **RULE**: Every new agent MUST complete all steps. No agent exists unless it is in:
> 1. `AGENT_ROSTER` in `packages/genkit/src/flows/index.ts`
> 2. `agent_catalog.md` KI with hive assignment and role description
> 3. A named Genkit flow in `packages/genkit/src/flows/`
>
> Agents with `status: 'planned'` in the roster are pre-registered without a flow â€” use this for
> near-future agents. All `status: 'active'` agents MUST have a flow.

## Trigger
- `/new-agent <NAME> <HIVE> <ROLE>` â€” add a new agent
- Or: "create agent X" / "add X to the engine"

## Step 1 â€” Assign Hive

Choose from the canonical hive list:

| Hive | Purpose | Existing Agents |
|------|---------|----------------|
| `CORTEX` | Strategic leadership | STRATA, LOGD, PRISM |
| `AURORA` | Design, frontend, backend | AURORA, BOLT, NAVD, COMMERCE, BROWSER, VISUAL_SCORER, CONTINUITY |
| `GENMEDIA` | Creative & media execution | CREATIVE_DIRECTOR, HYPE_REEL_DIRECTOR, GENMEDIA_ASSET, BLENDER, VFX |
| `KEEPER` | Knowledge & documentation | KEEPER, ARCH, CODEX, ECHO |
| `LEX` | Governance & compliance | LEX, COMPASS |
| `SWITCHBOARD` | Ops & comms routing | RELAY, SIGNAL, SWITCHBOARD, RAM_CREW, FORGE, BEACON, PRISM, FLUX |
| `VALIDATOR` | QA & correctness | SENTINEL, ARCHON, PROOF, HARBOR |
| `BROADCAST` | Media & live ops | ATLAS, CONTROL_ROOM, SHOWRUNNER, GRAPHICS, STUDIO, SYSTEMS |
| `OMNIMEDIA` | God-node media orchestration | OMNIMEDIA |
| `FINANCE` | Crypto trading & vaults | FINANCE_AGENT |
| `NEW_HIVE` | If creating a new functional domain â€” must be proposed and approved |

## Step 2 â€” Create the Flow File

Create `packages/genkit/src/flows/<agent-name-lowercase>.ts`:

```typescript
import { ai, z } from '../index.js';
import { recordAgentCall } from './index.js';

const inputSchema = z.object({
    task: z.string().describe('The task for <AGENT_NAME> to perform'),
    context: z.string().optional().describe('Optional context'),
});

const outputSchema = z.object({
    result: z.string(),
    agentName: z.literal('<AGENT_NAME>'),
    timestamp: z.string(),
});

export const <AGENT_NAME>Flow = ai.defineFlow(
    {
        name: '<AGENT_NAME>',
        inputSchema,
        outputSchema,
    },
    async (input) => {
        recordAgentCall('<AGENT_NAME>');
        const startMs = Date.now();

        const { text } = await ai.generate({
            model: 'googleai/gemini-2.0-flash',  // or gemini-2.5-pro for senior agents
            prompt: `You are <AGENT_NAME>, <ROLE_DESCRIPTION>.

Constitutional: Article VIII â€” you are named, hived under <HIVE>, and accountable.

Task: ${input.task}
${input.context ? `\nContext: ${input.context}` : ''}`,
        });

        recordAgentCall('<AGENT_NAME>', Date.now() - startMs);
        return { result: text, agentName: '<AGENT_NAME>', timestamp: new Date().toISOString() };
    }
);
```

## Step 3 â€” Register in index.ts

In `packages/genkit/src/flows/index.ts`:

```typescript
// Add the export
export { <AGENT_NAME>Flow } from './<agent-filename>.js';

// Add to AGENT_ROSTER
{ name: '<NAME>', hive: '<HIVE>', role: '<ROLE>', flow: '<NAME>', model: '<MODEL>', status: 'active' as AgentStatus },
```

## Step 4 â€” Update agent_catalog.md

Update: `C:\Users\jahar\.gemini\cle\knowledge\creative_liberation_engine_framework\artifacts\orchestration\agent_catalog.md`

Add the agent under its hive section with:
- Name (bold) and color/icon if it has one
- Role description (one line)
- Model assigned

## Step 5 â€” Update AGENTS.md hive table

In `.agents/workflows/new-agent.md` (this file), update the hive table above with the new agent.

In `AGENTS.md`, if a new hive was created, add it to the Package Map and Operational Modes as appropriate.

## Step 6 â€” Wire Telemetry (MANDATORY)

Add `recordAgentCall('<AGENT_NAME>')` at the START of the flow function body.
Add a second call with `durationMs` at the END.

This makes the agent visible in:
- `GET http://127.0.0.1:4100/agents` â€” live telemetry
- Console â†’ Agent Roster panel â†’ last-seen timestamps

## Step 7 â€” Verify Registration

```powershell
# Check agent appears in roster
curl http://127.0.0.1:4100/agents | ConvertFrom-Json | Where-Object { $_.name -eq '<NAME>' }
```

## Quick Reference â€” Total Agent Count

Update the header comment in `index.ts` to reflect the new total after adding.
Run: `(Get-Content packages/genkit/src/flows/index.ts | Where-Object { $_ -match "name: '" }).Count`
