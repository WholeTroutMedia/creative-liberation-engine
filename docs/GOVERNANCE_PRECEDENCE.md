# V6 Governance Precedence

## Purpose

Reconcile governance conflicts between V6 and prior versions. Establish clear authority so that no ambiguity exists about which rules govern V6 behavior.

## Sovereignty Declaration

**V6 is a sovereign build root.** It is not a branch, fork, or subdirectory of any prior version. V6 governance documents are authoritative within the V6 workspace. Prior version rules are inherited only where explicitly referenced, and never override V6 contracts.

## Precedence Stack (Highest → Lowest)

When two governance documents conflict, the higher-ranked document wins:

| Rank | Document | Scope | Authority |
|---|---|---|---|
| **1** | `docs/SYSTEM_CONTRACT.md` | Non-negotiable structural rules | Supreme — cannot be overridden by any other document |
| **2** | `docs/SYSTEM_CONSTRAINTS.md` | Active system constraints and failure modes | Operational Limits — all implementations must satisfy |
| **3** | `docs/FILESYSTEM_POLICY.md` | Where files live and what goes where | Structural — all files must comply |
| **4** | `docs/ROUTING_CONTRACT.md` | Route declaration and ownership | Service-level — governs all HTTP/internal routes |
| **5** | `docs/MEMORY_SPINE.md` | Memory providers, lifecycle, projections | Data-level — governs all durable knowledge |
| **6** | `docs/GOVERNANCE_PRECEDENCE.md` | This document — conflict resolution | Meta-governance — resolves ambiguity |
| **7** | `AGENTS.md` | Agent boot protocol and operating rules | Operational — governs agent behavior |
| **8** | `docs/V6_CONSTITUTION.md` | 107 constitutional principles (V1–V5 heritage) | Heritage — guides intent, does not override V6 contracts |
| **9** | `docs/HARDENING_HELICES.md` | Six parallel hardening lanes | Quality — defines readiness criteria |
| **10** | V5 `AGENTS.md`, `CONSTITUTION.md` | Prior version governance | Read-only reference — never authoritative in V6 |

## Conflict Resolution Rules

### Rule 1: V6 Contracts Override V5 Patterns

Where V5 established a pattern (e.g., file layout, naming, workflow) that conflicts with a V6 contract, the V6 contract governs. The V5 pattern is documented as heritage context but has no enforcement authority.

**Example:** V5 placed route configs in scattered service directories. V6 mandates all routes in `runtime/routes/*.manifest.json`. The V6 rule applies.

### Rule 2: Schema Beats Prose

When a human-readable document (`docs/*.md`) and a machine-readable schema (`schemas/*.schema.json`) describe the same concept differently, the schema is authoritative for validation purposes. The prose document should be updated to match.

**Example:** If `MEMORY_SPINE.md` describes a field as optional but `MEMORY_CONTRACT.schema.json` marks it required, the schema wins.

### Rule 3: Constitutional Principles Guide Intent, Not Implementation

The 107 principles in `V6_CONSTITUTION.md` represent the accumulated wisdom of V1–V5. They guide design decisions and intent but do not dictate implementation specifics. When a constitutional principle conflicts with a V6 schema or contract, the V6 document takes precedence for implementation while the principle remains as guiding philosophy.

**Example:** A constitutional principle says "minimize configuration." A V6 schema requires explicit configuration for security-critical routes. The schema requirement stands.

### Rule 4: Explicit Beats Implicit

If two V6 documents could apply to a situation, the more specific document wins:

- Route-specific question → `ROUTING_CONTRACT.md`
- Memory-specific question → `MEMORY_SPINE.md`
- File placement question → `FILESYSTEM_POLICY.md`
- General structural question → `SYSTEM_CONTRACT.md`

### Rule 5: Phase Gates Are Absolute

Phase gates defined in `PHASES.md` are not suggestions. No capability enters a later phase until all "DONE WHEN" criteria of the current phase are met. This rule cannot be overridden by any other governance document.

## Version Boundary Enforcement

### What V6 Inherits from Prior Versions

| Inherited | How | Authority |
|---|---|---|
| Constitutional principles | Bulk-imported into `V6_CONSTITUTION.md` | Guiding, not governing |
| Capability inventory | Classified in `CAPABILITY_MATRIX.json` | Heritage reference |
| Agent roster | Migrated into `agents.canonical.json` | V6-contracted after promotion |
| NAS execution hierarchy | Preserved in `AGENTS.md` | Operational continuity |
| Sovereignty stance (Forgejo, NAS-first) | Reinforced in `SYSTEM_CONTRACT.md` | Core principle |

### What V6 Does NOT Inherit

| Not Inherited | Reason |
|---|---|
| V5 file layout | Replaced by `FILESYSTEM_POLICY.md` |
| V5 ad-hoc configuration patterns | Replaced by contract-first schemas |
| V5 unschematized wiki content | Replaced by projection model in `MEMORY_SPINE.md` |
| V5 scattered route declarations | Centralized in route manifests |
| V5 runtime assumptions | V6 runtime contracts are independent |

## Amendment Process

To modify V6 governance:

1. Draft proposed change in the target document.
2. Verify no conflict with higher-precedence documents.
3. Update `GOVERNANCE_PRECEDENCE.md` if the change affects conflict resolution.
4. Run contract validation suite to ensure no schema violations.
5. Document the change rationale as a memory record (`kind: decision`).

## Status

**COMPLETE** — Full governance reconciliation established 2026-04-21.
