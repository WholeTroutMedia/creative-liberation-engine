# V6 Runtime Registry

This directory contains machine-readable runtime registries generated for V6:

- `agents.registry.json`
- `skills.registry.json`
- `workflows.registry.json`
- `loras.registry.json`
- `agents.canonical.json` (single source of truth for real agents)
- `agents.canonical.report.json` (conflicts and provenance diagnostics)
- `skills.canonical.json` (single source of truth for real skills)
- `skills.canonical.report.json` (required-skill and duplicate diagnostics)
- `workflows.canonical.json` (single source of truth for active workflows)
- `workflows.canonical.report.json` (required-workflow and duplicate diagnostics)
- `loras.canonical.json` (single source of truth for meaningful lora assets)
- `loras.canonical.report.json` (noise pruning + required lora diagnostics)
- `models.canonical.json` (single source of truth for model tiers and fleet services)
- `models.canonical.report.json` (required-tier and duplicate-tier diagnostics)
- `lora-model-compatibility.json` (allowed LoRA to model-tier compatibility map)
- `../governance/CONSTITUTION_MAP.json` (V1-V5 constitutional and story carryover map)
- `../governance/PARITY_STATUS.json` (exhaustive V5 capability parity state)
- `../interop/V5_BRIDGE_MANIFEST.json` (bridge delivery map for non-native capabilities)

Generate/update using:

- `npm run v6:bootstrap`
- `npm run v6:agents:canonical`
- `npm run v6:skills:canonical`
- `npm run v6:skills:docs`
- `npm run v6:workflows:canonical`
- `npm run v6:workflows:docs`
- `npm run v6:loras:canonical`
- `npm run v6:loras:docs`
- `npm run v6:models:canonical`
- `npm run v6:models:docs`
- `npm run v6:constitution:canonical`
- `npm run v6:parity:canonical`
- `npm run v6:hardening:board`

Validate using:

- `npm test`
