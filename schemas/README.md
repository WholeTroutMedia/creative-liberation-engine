# V6 Schemas

Machine-checkable contracts underpinning the Creative Liberation Engine V6. Every durable capability, route, memory record, and operational manifest validates against a schema in this directory.

## Core Contracts

| Schema | Purpose | Used By |
|---|---|---|
| `HERITAGE_CAPABILITY.schema.json` | Single legacy capability record (V1–V5 inventory) | `inventory/CAPABILITY_MATRIX.json`, salvage backlog |
| `MEMORY_CONTRACT.schema.json` | Canonical memory record (SCRIBE, VAULT, KI, Wiki) | `runtime/memory/`, wiki projections |
| `MEMORY_INDEX.schema.json` | Collection/index of memory records | `runtime/memory/MEMORY_INDEX.example.json` |
| `ROUTE_CONTRACT.schema.json` | Single route declaration (path, auth, timeout, owner) | Route manifests |
| `ROUTE_MANIFEST.schema.json` | Manifest of route contracts per service/gateway | `runtime/routes/*.manifest.json` |

## Registry Schemas

| Schema | Purpose | Used By |
|---|---|---|
| `AGENT_REGISTRY.schema.json` | Full agent registry (all imported agents) | `runtime/registry/agents.registry.json` |
| `AGENTS_CANONICAL.schema.json` | Blessed canonical agents (filtered subset) | `runtime/registry/agents.canonical.json` |
| `SKILL_REGISTRY.schema.json` | Full skill registry | `runtime/registry/skills.registry.json` |
| `SKILLS_CANONICAL.schema.json` | Blessed canonical skills | `runtime/registry/skills.canonical.json` |
| `WORKFLOW_REGISTRY.schema.json` | Full workflow registry | `runtime/registry/workflows.registry.json` |
| `WORKFLOWS_CANONICAL.schema.json` | Blessed canonical workflows | `runtime/registry/workflows.canonical.json` |
| `LORA_REGISTRY.schema.json` | Full LoRA registry | `runtime/registry/loras.registry.json` |
| `LORAS_CANONICAL.schema.json` | Blessed canonical LoRAs | `runtime/registry/loras.canonical.json` |
| `LORA_MODEL_COMPATIBILITY.schema.json` | LoRA-to-model compatibility matrix | `runtime/registry/lora-model-compatibility.json` |
| `MODELS_CANONICAL.schema.json` | Blessed canonical models | `runtime/registry/models.canonical.json` |

## Hardening Schemas

| Schema | Purpose | Used By |
|---|---|---|
| `EXECUTION_HARDENING.schema.json` | Dispatch integrity, idempotency, retry controls | `runtime/hardening/execution.hardening.json` |
| `MODELOPS_HARDENING.schema.json` | Model tier coverage, fallback, QoS | `runtime/hardening/modelops.hardening.json` |
| `MEMORY_HARDENING.schema.json` | Memory layer boundaries, provenance | `runtime/hardening/memory.hardening.json` |
| `SECURITY_HARDENING.schema.json` | Secrets, policy, audit trail | `runtime/hardening/security.hardening.json` |
| `RELEASE_HARDENING.schema.json` | Promotion, rollback, compatibility | `runtime/hardening/release.hardening.json` |
| `RELIABILITY_HARDENING.schema.json` | Golden signals, SLO, fault injection | `runtime/hardening/reliability.hardening.json` |

## Governance Schemas

| Schema | Purpose | Used By |
|---|---|---|
| `CONSTITUTION_MAP.schema.json` | Constitutional principle registry | `runtime/governance/CONSTITUTION_MAP.json` |
| `PARITY_STATUS.schema.json` | V5 ↔ V6 capability parity matrix | `runtime/governance/PARITY_STATUS.json` |
| `DESIGN_LIBRARY_MANIFEST.schema.json` | Design system import manifest | `design-system/design-library.manifest.json` |

## Meta-Spec

All schemas conform to [JSON Schema draft 2020-12](https://json-schema.org/draft/2020-12/schema).

Each schema includes:
- `$schema` — meta-schema reference
- `$id` — unique URI under `https://cle-engine.local/schemas/v6/`
- `title` — human-readable name
- `description` — purpose statement
- `type` — root type (always `object` for V6 contracts)

## Rules

1. All inventory and manifest files must validate against their corresponding schema.
2. No new contract surface is introduced without a schema in this directory.
3. Schemas are validated by `tests/contract-validation.test.mjs` (Phase 1 gate).
4. Registry schemas are validated at build time by `tools/validate-contracts.mjs`.
