---
description: Scaffold a new agent in the Creative Liberation Engine ecosystem — creates file, registers in roster, updates status JSON
---

# /new-agent — Create a New Agent

Scaffold a new agent in the Creative Liberation Engine. Registers it in the agent roster, status JSON, and creates the implementation file.

## Steps

1. Gather agent definition from user:
   - **Name** (ALL CAPS, single word preferred)
   - **Role** (brief: "Frontend Builder", "Memory Curator", etc.)
   - **Hive** (AURORA, LEX, KEEPER, BROADCAST, SWITCHBOARD, COMPASS, or new)
   - **Model** (gemini-2.5-pro / gemini-2.0-flash / other)
   - **Primary function** (2-3 sentences)

2. Generate the agent definition file:

// turbo

```powershell
New-Item -Path "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v4\CORE_FOUNDATION\agents\[AGENT_NAME].md" -ItemType File -Force
```

Write the agent spec to that file with sections: Identity, Role, Capabilities, Constitutional Alignment, Integration Points.

// turbo
3. Update `.agent-status.json` to add the new agent entry:

```json
"[AGENT_NAME]": {
  "status": "active",
  "hive": "[HIVE]",
  "role": "[ROLE]",
  "model": "[MODEL]",
  "invocations_today": 0,
  "last_invoked": "[ISO_TIMESTAMP]"
}
```

1. Update `system-status.json` — increment `total_active` and `total_defined`.

// turbo
5. Update the rules file to include the new agent in the roster:

```powershell
# Append agent to cle-engine.md agent table
```

1. Confirm: "Agent **[NAME]** is now live in the [HIVE] hive. 40 → 41 agents online."
