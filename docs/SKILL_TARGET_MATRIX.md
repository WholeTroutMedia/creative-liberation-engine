# V6 Skill Target Matrix (Batch-35)

This defines the first expansion batch for V6 skill coverage before workflow canonicalization.

Rule: 7 families x top 5 skills each = 35 total.

## 1) Runtime Ops (5)

| Skill ID | Owner Hive | Priority | Purpose |
|---|---|---|---|
| `service-health-triage` | `systems` | P0 | Detect and isolate failing services quickly with actionable runbooks. |
| `rollback-operator` | `forge` | P0 | Execute deterministic rollback paths for service/config regressions. |
| `config-drift-detector` | `archon` | P0 | Detect config drift between desired/runtime states across environments. |
| `dependency-auditor` | `codex` | P1 | Surface stale/risky deps and recommend safe upgrade windows. |
| `capacity-forecast` | `atlas` | P1 | Forecast resource saturation and queue pressure from operational telemetry. |

## 2) Security (5)

| Skill ID | Owner Hive | Priority | Purpose |
|---|---|---|---|
| `secret-scanner` | `sentinel` | P0 | Identify secret leakage in code/config/artifacts before release. |
| `authz-policy-verifier` | `lex` | P0 | Validate RBAC/ABAC policy consistency and deny-by-default posture. |
| `sbom-vulnerability-gate` | `proof` | P0 | Enforce SBOM + CVE thresholds in release gates. |
| `incident-forensics` | `archon` | P1 | Produce timeline and root-cause evidence packs after incidents. |
| `supply-chain-hardener` | `harbor` | P1 | Harden package provenance, lockfile integrity, and build trust chain. |

## 3) Memory & Knowledge (5)

| Skill ID | Owner Hive | Priority | Purpose |
|---|---|---|---|
| `memory-schema-migrator` | `memory-curator` | P0 | Safely migrate memory records across schema versions. |
| `provenance-reconciler` | `scribe` | P0 | Reconcile conflicting provenance claims into canonical lineage. |
| `retention-policy-enforcer` | `keeper` | P0 | Enforce retention classes, expiration, and legal hold constraints. |
| `semantic-deduper` | `echo` | P1 | Cluster and merge semantically duplicate memory records. |
| `knowledge-gap-mapper` | `codex` | P1 | Identify missing canonical knowledge for active initiatives. |

## 4) Model & Agent Quality (5)

| Skill ID | Owner Hive | Priority | Purpose |
|---|---|---|---|
| `eval-dataset-curator` | `eval-harness` | P0 | Build representative evaluation datasets for regressions and capability checks. |
| `prompt-regression-guard` | `skills-linter` | P0 | Detect prompt-level behavior drift across model/provider changes. |
| `route-quality-optimizer` | `cost-arbitrage` | P0 | Optimize route decisions for quality/latency/cost tradeoffs. |
| `hallucination-risk-scorer` | `vera` | P1 | Score and flag likely hallucination zones in outputs. |
| `agent-performance-profiler` | `agent-observability` | P1 | Profile agent/tool latency, retries, and failure hotspots. |

## 5) Delivery & Governance (5)

| Skill ID | Owner Hive | Priority | Purpose |
|---|---|---|---|
| `release-train-coordinator` | `switchboard` | P0 | Coordinate multi-service release sequencing and freeze windows. |
| `change-impact-estimator` | `athena` | P0 | Estimate blast radius and downstream contract impacts pre-change. |
| `migration-wave-planner` | `migration-operator` | P0 | Plan phased migration waves with checkpoints and fallback plans. |
| `constitutional-policy-linter` | `validate` | P1 | Enforce constitutional policy clauses as machine-checkable rules. |
| `audit-trail-compiler` | `logd` | P1 | Compile end-to-end decision/action audit packets per release wave. |

## 6) Design & Product OS (5)

| Skill ID | Owner Hive | Priority | Purpose |
|---|---|---|---|
| `design-token-steward` | `iris` | P0 | Maintain token integrity and prevent visual drift across surfaces. |
| `component-contract-checker` | `bolt` | P0 | Validate component API contracts and composition boundaries. |
| `ux-regression-detector` | `sight` | P1 | Detect UX behavior regressions from intended flow baselines. |
| `accessibility-conformance` | `studio` | P0 | Enforce accessibility compliance and remediation recommendations. |
| `design-system-sync` | `design-ingest` | P1 | Sync design sources into canonical manifests without divergence. |

## 7) Data & Integration (5)

| Skill ID | Owner Hive | Priority | Purpose |
|---|---|---|---|
| `connector-hardener` | `relay` | P0 | Harden external connectors with retries, backoff, and guardrails. |
| `ingest-contract-validator` | `route-governor` | P0 | Validate inbound payloads against data/route contracts. |
| `event-schema-enforcer` | `proof` | P0 | Enforce event contract compatibility across producers/consumers. |
| `sync-conflict-resolver` | `muxd` | P1 | Resolve cross-system sync collisions deterministically. |
| `integration-sla-monitor` | `signal` | P1 | Monitor connector SLAs and surface breach risks early. |

## Execution Notes

- This matrix is the required skill expansion target before workflow deepening.
- Implementation order: all P0 skills first, then P1.
- Every implemented skill must include:
  - `agents/skills-next/<skill-id>/SKILL.md`
  - canonical registration in `skills.canonical.json`
  - graph linkage in `wiki/obsidian/SKILL_GRAPH.md`
