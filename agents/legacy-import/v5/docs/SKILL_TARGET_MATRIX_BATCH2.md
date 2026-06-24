# V6 Skill Target Matrix (Batch-35-B2)

Second expansion batch for V6 skill coverage.

Rule: 7 families x top 5 skills each = 35 total.

## 1) Runtime Ops (5)

| Skill ID | Owner Hive | Priority | Purpose |
|---|---|---|---|
| `runtime-chaos-drill` | `systems` | P0 | Run controlled chaos drills and score resilience outcomes. |
| `state-recovery-orchestrator` | `ram-crew` | P0 | Recover partial failures using deterministic recovery trees. |
| `release-health-gate` | `forge` | P0 | Block promotion when runtime health thresholds fail. |
| `orphan-resource-cleaner` | `systems` | P1 | Detect and clean orphaned containers/volumes/jobs safely. |
| `runtime-cost-observer` | `atlas` | P1 | Track infra run-cost anomalies and optimization opportunities. |

## 2) Security (5)

| Skill ID | Owner Hive | Priority | Purpose |
|---|---|---|---|
| `threat-model-updater` | `archon` | P0 | Keep threat models current with architecture and exposure changes. |
| `attack-surface-mapper` | `sentinel` | P0 | Map externally reachable interfaces and risk posture. |
| `permission-boundary-checker` | `lex` | P0 | Verify identity and permission boundary correctness. |
| `security-regression-sentinel` | `proof` | P1 | Catch security regressions during iteration and releases. |
| `compliance-evidence-packager` | `harbor` | P1 | Assemble compliance evidence bundles for audits. |

## 3) Memory & Knowledge (5)

| Skill ID | Owner Hive | Priority | Purpose |
|---|---|---|---|
| `memory-lineage-auditor` | `scribe` | P0 | Audit end-to-end lineage integrity across memory records. |
| `knowledge-consistency-checker` | `codex` | P0 | Detect contradictory canon and propose reconciliations. |
| `archive-compaction-operator` | `keeper` | P1 | Compact stale memory layers while preserving retrieval quality. |
| `decision-journal-curator` | `echo` | P1 | Maintain high-signal decision journals linked to outcomes. |
| `context-window-optimizer` | `memory-curator` | P1 | Optimize context packing for quality and token efficiency. |

## 4) Model & Agent Quality (5)

| Skill ID | Owner Hive | Priority | Purpose |
|---|---|---|---|
| `benchmark-suite-runner` | `eval-harness` | P0 | Run repeatable benchmark suites across model routes. |
| `tool-call-reliability-checker` | `agent-observability` | P0 | Measure tool-call success, retries, and failure modes. |
| `response-grounding-verifier` | `vera` | P0 | Verify output grounding against evidence and memory sources. |
| `multi-model-consensus` | `cost-arbitrage` | P1 | Use consensus strategies for high-risk decision quality. |
| `agent-goal-drift-detector` | `skills-linter` | P1 | Detect drift between declared goals and observed behavior. |

## 5) Delivery & Governance (5)

| Skill ID | Owner Hive | Priority | Purpose |
|---|---|---|---|
| `policy-change-propagator` | `validate` | P0 | Propagate policy changes safely across contracts/workflows. |
| `merge-readiness-gate` | `switchboard` | P0 | Enforce merge readiness based on quality and compliance gates. |
| `rollback-readiness-auditor` | `migration-operator` | P1 | Verify rollback readiness before high-impact changes. |
| `change-approval-synthesizer` | `athena` | P1 | Summarize change impact for operator approval context. |
| `governance-exception-tracker` | `logd` | P1 | Track and close governance exceptions with ownership. |

## 6) Design & Product OS (5)

| Skill ID | Owner Hive | Priority | Purpose |
|---|---|---|---|
| `design-drift-auditor` | `iris` | P0 | Detect visual/system drift versus canonical design contracts. |
| `interaction-pattern-linter` | `bolt` | P0 | Lint interaction consistency across applications and surfaces. |
| `a11y-regression-tracker` | `studio` | P0 | Track accessibility regressions and remediation status. |
| `design-asset-provenance` | `design-ingest` | P1 | Preserve provenance and licensing context for design assets. |
| `experience-telemetry-correlator` | `sight` | P1 | Correlate user-experience telemetry with release changes. |

## 7) Data & Integration (5)

| Skill ID | Owner Hive | Priority | Purpose |
|---|---|---|---|
| `schema-evolution-guard` | `route-governor` | P0 | Guard schema evolution and backward compatibility. |
| `connector-circuit-breaker` | `relay` | P0 | Apply circuit-breaker policy to unstable integrations. |
| `event-replay-validator` | `proof` | P1 | Validate replay safety for event-driven recovery paths. |
| `cross-system-reconciliation` | `muxd` | P1 | Reconcile divergent states across integrated systems. |
| `integration-observability-hub` | `signal` | P1 | Centralize integration health and SLA observability. |

## Execution Notes

- This batch is implemented after Batch-35 baseline.
- Implementation order: P0 first, then P1.
- Every skill must include:
  - `agents/skills-next/<skill-id>/SKILL.md`
  - canonical registration via `skills.canonical.json`
  - graph linkage in `wiki/obsidian/SKILL_GRAPH.md`
