# WORKFLOWS_ENRICHMENT.md — Design Document

> **Version:** 1.0.0  
> **Status:** DESIGN  
> **Owner:** AVERI Collective (ATHENA · VERA · IRIS)  
> **Depends on:** `docs/INTENT_ROUTING_CONTRACT.md`, `runtime/registry/workflows.canonical.json`  
> **Last Updated:** 2026-05-22

---

## 1. Purpose

This document defines the **target state** for enriching `workflows.canonical.json` with explicit step compositions, skill bindings, agent assignments, and failure handling. It is the design blueprint for transforming workflows from named references into fully executable, composable pipelines.

**Current state:** 7 workflows registered with `workflowId`, `name`, `kind`, `status`, and `path` — no step definitions, no skill bindings, no failure semantics.

**Target state:** Each workflow entry includes a `steps[]` array where every step binds to a skill, declares inputs/outputs, names a responsible agent, and defines failure behavior.

---

## 2. Enrichment Schema

### 2.1 Target Workflow Entry Structure

```json
{
  "workflowId": "incident-response",
  "name": "incident-response",
  "kind": "ops",
  "status": "active",
  "source": "v6",
  "path": "agents/workflows-next/incident-response.md",
  "summary": "End-to-end incident response from detection through postmortem.",
  "triggers": ["incident", "outage", "service down", "production issue"],
  "domain": "runtime-ops",
  "steps": [
    {
      "stepId": "detect",
      "order": 1,
      "skillId": "service-health-triage",
      "agentId": "systems",
      "inputs": ["alert_payload", "service_id"],
      "outputs": ["triage_report", "severity_level"],
      "onFailure": "escalate",
      "timeout": "5m"
    },
    {
      "stepId": "investigate",
      "order": 2,
      "skillId": "incident-forensics",
      "agentId": "sentinel",
      "inputs": ["triage_report"],
      "outputs": ["root_cause_analysis", "blast_radius"],
      "onFailure": "retry(3)",
      "timeout": "15m"
    }
  ],
  "aliases": ["incident-response"]
}
```

### 2.2 Step Schema Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `stepId` | string | ✅ | Unique identifier within the workflow |
| `order` | integer | ✅ | Execution sequence (1-based) |
| `skillId` | string | ✅ | Reference to `skills.canonical.json` entry |
| `agentId` | string | ✅ | Reference to `agents.canonical.json` entry |
| `inputs` | string[] | ✅ | Named data inputs this step consumes |
| `outputs` | string[] | ✅ | Named data outputs this step produces |
| `onFailure` | string | ✅ | Failure strategy: `halt`, `skip`, `retry(N)`, `escalate`, `rollback` |
| `timeout` | string | ❌ | Maximum execution time (e.g., `"5m"`, `"1h"`) |
| `condition` | string | ❌ | Conditional execution expression (e.g., `"severity >= critical"`) |
| `parallel` | boolean | ❌ | Can run concurrently with previous step (default: false) |

---

## 3. Workflow Compositions — All 7 Workflows

### 3.1 `incident-response` (ops)

**Purpose:** End-to-end incident lifecycle from detection through postmortem generation.

```
┌─────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐    ┌───────────┐
│ DETECT  │───▶│ INVESTIGATE  │───▶│  MITIGATE   │───▶│  STABILIZE   │───▶│ POSTMORTEM│
│ service │    │ incident-    │    │  rollback-  │    │  service-    │    │ audit-    │
│ health  │    │ forensics    │    │  operator   │    │  health-     │    │ trail-    │
│ triage  │    │              │    │             │    │  triage      │    │ compiler  │
└─────────┘    └──────────────┘    └─────────────┘    └──────────────┘    └───────────┘
  SYSTEMS         SENTINEL           SYSTEMS           SYSTEMS            SCRIBE
```

| Step | Skill | Agent | Inputs | Outputs | On Failure |
|---|---|---|---|---|---|
| 1. Detect | `service-health-triage` | SYSTEMS | alert_payload | triage_report, severity | escalate |
| 2. Investigate | `incident-forensics` | SENTINEL | triage_report | root_cause, blast_radius | retry(3) |
| 3. Mitigate | `rollback-operator` | SYSTEMS | root_cause, blast_radius | rollback_result | escalate |
| 4. Stabilize | `service-health-triage` | SYSTEMS | rollback_result | health_check | retry(2) |
| 5. Postmortem | `audit-trail-compiler` | SCRIBE | all_outputs | postmortem_doc | skip |

---

### 3.2 `eval-capability` (evaluation)

**Purpose:** Evaluate an agent or skill's capability across correctness, safety, latency, and cost metrics.

```
┌───────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────────┐
│ CURATE    │───▶│ EXECUTE      │───▶│  BENCHMARK    │───▶│  REPORT      │
│ eval-     │    │ eval-        │    │  benchmark-   │    │  agent-      │
│ dataset   │    │ harness      │    │  suite-runner │    │  performance │
│ curator   │    │              │    │               │    │  profiler    │
└───────────┘    └──────────────┘    └───────────────┘    └──────────────┘
  SAGE              SAGE                SAGE                SAGE
```

| Step | Skill | Agent | Inputs | Outputs | On Failure |
|---|---|---|---|---|---|
| 1. Curate | `eval-dataset-curator` | SAGE | eval_target, eval_scope | eval_dataset | halt |
| 2. Execute | `eval-harness` | SAGE | eval_dataset | eval_results | retry(2) |
| 3. Benchmark | `benchmark-suite-runner` | SAGE | eval_results | benchmark_scores | skip |
| 4. Report | `agent-performance-profiler` | SAGE | benchmark_scores, eval_results | capability_report | halt |

---

### 3.3 `eval-regression` (evaluation)

**Purpose:** Detect quality regressions in agent behavior, prompts, accessibility, and security after changes.

```
┌───────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────────┐    ┌──────────┐
│ BASELINE  │───▶│ EXECUTE      │───▶│  CHECK A11Y   │───▶│  CHECK       │───▶│ VERDICT  │
│ eval-     │    │ eval-        │    │  a11y-        │    │  PROMPTS     │    │ merge-   │
│ dataset   │    │ harness      │    │  regression-  │    │  prompt-     │    │ readiness│
│ curator   │    │              │    │  tracker      │    │  regression  │    │ gate     │
└───────────┘    └──────────────┘    └───────────────┘    └──────────────┘    └──────────┘
  SAGE              SAGE                SAGE                SAGE              PROOF
```

| Step | Skill | Agent | Inputs | Outputs | On Failure |
|---|---|---|---|---|---|
| 1. Baseline | `eval-dataset-curator` | SAGE | regression_scope | baseline_dataset | halt |
| 2. Execute | `eval-harness` | SAGE | baseline_dataset | regression_results | retry(2) |
| 3. A11y Check | `a11y-regression-tracker` | SAGE | regression_results | a11y_report | skip |
| 4. Prompt Check | `prompt-regression-guard` | SAGE | regression_results | prompt_report | skip |
| 5. Verdict | `merge-readiness-gate` | PROOF | all_reports | merge_decision | halt |

---

### 3.4 `content-delivery` (ops)

**Purpose:** End-to-end content production from design to delivery, ensuring design system compliance.

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────────┐
│ SYNC DESIGN │───▶│ PRODUCE      │───▶│  VERIFY       │───▶│  DELIVER     │
│ design-     │    │ davinci-     │    │  component-   │    │  release-    │
│ system-     │    │ resolve-     │    │  contract-    │    │  train-      │
│ sync        │    │ automation   │    │  checker      │    │  coordinator │
└─────────────┘    └──────────────┘    └───────────────┘    └──────────────┘
  GRAPHICS          SHOWRUNNER          PROOF                SCRIBE
```

| Step | Skill | Agent | Inputs | Outputs | On Failure |
|---|---|---|---|---|---|
| 1. Sync Design | `design-system-sync` | GRAPHICS | design_spec | synced_assets | halt |
| 2. Produce | `davinci-resolve-automation` | SHOWRUNNER | synced_assets | produced_content | retry(2) |
| 3. Verify | `component-contract-checker` | PROOF | produced_content | contract_report | halt |
| 4. Deliver | `release-train-coordinator` | SCRIBE | contract_report, produced_content | delivery_manifest | escalate |

---

### 3.5 `client-feedback` (ops)

**Purpose:** Collect, analyze, and act on client/user feedback for continuous improvement.

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────────┐
│ COLLECT     │───▶│ ANALYZE      │───▶│  CORRELATE    │───▶│  ACTION      │
│ experience- │    │ interaction- │    │  experience-  │    │  change-     │
│ telemetry-  │    │ pattern-     │    │  telemetry-   │    │  impact-     │
│ correlator  │    │ linter       │    │  correlator   │    │  estimator   │
└─────────────┘    └──────────────┘    └───────────────┘    └──────────────┘
  ECHO              SAGE                ECHO                SCRIBE
```

| Step | Skill | Agent | Inputs | Outputs | On Failure |
|---|---|---|---|---|---|
| 1. Collect | `experience-telemetry-correlator` | ECHO | feedback_source | raw_telemetry | retry(3) |
| 2. Analyze | `interaction-pattern-linter` | SAGE | raw_telemetry | pattern_analysis | skip |
| 3. Correlate | `experience-telemetry-correlator` | ECHO | pattern_analysis | correlation_report | skip |
| 4. Action | `change-impact-estimator` | SCRIBE | correlation_report | action_plan | halt |

---

### 3.6 `media-production` (ops)

**Purpose:** Sovereign media pipeline from asset ingestion through final render with provenance tracking.

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────────┐
│ PROVENANCE  │───▶│ PRODUCE      │───▶│  VERIFY       │───▶│  ARCHIVE     │
│ design-     │    │ davinci-     │    │  design-drift │    │  archive-    │
│ asset-      │    │ resolve-     │    │  auditor      │    │  compaction- │
│ provenance  │    │ automation   │    │               │    │  operator    │
└─────────────┘    └──────────────┘    └───────────────┘    └──────────────┘
  LEONARDO          SHOWRUNNER          PROOF                KEEPER
```

| Step | Skill | Agent | Inputs | Outputs | On Failure |
|---|---|---|---|---|---|
| 1. Provenance | `design-asset-provenance` | LEONARDO | asset_manifest | provenance_chain | halt |
| 2. Produce | `davinci-resolve-automation` | SHOWRUNNER | provenance_chain, source_media | rendered_output | retry(2) |
| 3. Verify | `design-drift-auditor` | PROOF | rendered_output | drift_report | skip |
| 4. Archive | `archive-compaction-operator` | KEEPER | rendered_output, drift_report | archive_manifest | escalate |

---

### 3.7 `vendor-approval` (ops)

**Purpose:** Evaluate vendor/dependency sovereignty posture before approval for production use.

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────────┐
│ ASSESS      │───▶│ EVIDENCE     │───▶│  REVIEW       │───▶│  DECISION    │
│ attack-     │    │ compliance-  │    │  change-      │    │  change-     │
│ surface-    │    │ evidence-    │    │  approval-    │    │  approval-   │
│ mapper      │    │ packager     │    │  synthesizer  │    │  synthesizer │
└─────────────┘    └──────────────┘    └───────────────┘    └──────────────┘
  SENTINEL          LEX                 ATHENA               ATHENA
```

| Step | Skill | Agent | Inputs | Outputs | On Failure |
|---|---|---|---|---|---|
| 1. Assess | `attack-surface-mapper` | SENTINEL | vendor_id, vendor_artifacts | surface_report | halt |
| 2. Evidence | `compliance-evidence-packager` | LEX | surface_report | evidence_pack | halt |
| 3. Review | `change-approval-synthesizer` | ATHENA | evidence_pack | review_summary | retry(2) |
| 4. Decision | `change-approval-synthesizer` | ATHENA | review_summary | approval_decision | escalate |

---

## 4. How Workflows Chain Skills

### 4.1 Data Flow Model

Workflows use a **pipeline data-flow model**. Each step:
1. Receives named inputs (from prior steps' outputs or workflow-level inputs)
2. Invokes a skill via its lead agent
3. Produces named outputs available to subsequent steps

```
                    ┌─ workflow-level inputs ─┐
                    │                         │
                    ▼                         ▼
              ┌──────────┐             ┌──────────┐
              │  Step 1  │────outputs──▶│  Step 2  │────outputs──▶ ...
              │ (skill A)│             │ (skill B)│
              └──────────┘             └──────────┘
                    │                         │
                    └── telemetry ────────────-┘──── telemetry ──▶ observability
```

### 4.2 Execution Modes

| Mode | Description | Use When |
|---|---|---|
| **Sequential** | Steps execute in order, each waits for the previous | Default. Data dependencies exist. |
| **Parallel** | Steps with `parallel: true` run concurrently | Independent data gathering. |
| **Conditional** | Steps with `condition` only execute if condition is met | Branching on severity, tier, etc. |

### 4.3 Failure Semantics

| Strategy | Behavior |
|---|---|
| `halt` | Stop the entire workflow. Report failure. |
| `skip` | Mark step as skipped, continue to next step. |
| `retry(N)` | Retry the step up to N times with exponential backoff. |
| `escalate` | Halt and notify operator with full context. |
| `rollback` | Execute rollback steps in reverse order. |

### 4.4 Cross-Workflow Invocation

A workflow step CAN invoke another workflow (nesting), but:
- Maximum nesting depth: **2**
- Circular references are FORBIDDEN
- The inner workflow inherits the outer workflow's timeout budget

---

## 5. Composing New Workflows from Existing Skills

### 5.1 Composition Rules

1. **Skill prerequisites:** Every `skillId` in a step MUST exist in `skills.canonical.json` with `status: "active"` and `agentCallable: true`
2. **Agent binding:** Every `agentId` MUST exist in `agents.canonical.json` with `status: "active"`
3. **Input/output contract:** Every step input MUST be produced by either a prior step's output or a workflow-level input
4. **No orphan outputs:** Every step output SHOULD be consumed by a subsequent step or be a workflow-level output
5. **Idempotency:** Steps SHOULD be idempotent — re-running a step with the same inputs produces the same outputs

### 5.2 New Workflow Proposal Template

To propose a new workflow, submit a design entry with:

```markdown
## Workflow: <workflow-id>

**Kind:** ops | evaluation | reliability | core_spine | helix
**Domain:** <domain>
**Triggers:** <natural-language triggers>
**Summary:** <one-line description>

### Steps

| Order | Step ID | Skill | Agent | Inputs | Outputs | On Failure |
|---|---|---|---|---|---|---|
| 1 | ... | ... | ... | ... | ... | ... |

### Justification
- Why can't existing workflows handle this?
- What user intents does this serve?
- Which skills are composed, and why in this order?
```

### 5.3 Example: Proposed `security-posture-review` Workflow

```markdown
## Workflow: security-posture-review

**Kind:** ops
**Domain:** security
**Triggers:** "security review", "posture assessment", "security audit"
**Summary:** Comprehensive security posture assessment with board-ready output.

### Steps

| Order | Step ID | Skill | Agent | Inputs | Outputs | On Failure |
|---|---|---|---|---|---|---|
| 1 | scan | attack-surface-mapper | SENTINEL | target_scope | surface_report | halt |
| 2 | secrets | secret-scanner | SENTINEL | target_scope | secrets_report | skip |
| 3 | authz | authz-policy-verifier | SENTINEL | target_scope | authz_report | skip |
| 4 | sbom | sbom-vulnerability-gate | SENTINEL | target_scope | sbom_report | skip |
| 5 | threats | threat-model-updater | SENTINEL | surface_report | threat_model | retry(2) |
| 6 | harden | security-hardener | SENTINEL | all_reports | hardening_plan | halt |
| 7 | report | audit-trail-compiler | SCRIBE | all_outputs | ciso_brief | halt |

### Justification
- No existing workflow covers end-to-end security posture
- Chains 7 security skills into a single auditable pipeline
- Output maps directly to `ciso-board-brief` report template
```

---

## 6. Migration Path

### 6.1 Enrichment Phases

| Phase | Action | Timeline |
|---|---|---|
| **Phase 1** | Add `triggers[]`, `domain`, `summary` to all 7 workflows | Immediate |
| **Phase 2** | Define `steps[]` for all 7 workflows per §3 specifications | Next sprint |
| **Phase 3** | Validate step skill/agent references against canonical registries | Phase 2 + validation |
| **Phase 4** | Add `composableWith[]` to skills.canonical.json entries | After workflow enrichment |
| **Phase 5** | Implement workflow executor that reads enriched schema | Runtime phase |

### 6.2 Schema Validation

After enrichment, `workflows.canonical.json` MUST validate against:
- All `skillId` references resolve to active skills
- All `agentId` references resolve to active agents
- All `inputs[]` are either workflow-level inputs or prior step outputs
- No circular step dependencies
- `onFailure` values are from the allowed enum: `halt`, `skip`, `retry(N)`, `escalate`, `rollback`

### 6.3 Registry Generator Update

The `scripts/generate-canonical.ps1` script must be updated to:
1. Read workflow markdown files for step definitions
2. Validate skill/agent cross-references
3. Emit enriched `workflows.canonical.json` with `steps[]`
4. Report validation errors in `workflows.canonical.report.json`

---

## 7. Relationship to Intent Routing

Per `docs/INTENT_ROUTING_CONTRACT.md` §3.2 Step 7:

> Before executing individual skills, check if a registered workflow chains the matched skills.

Enriched workflows make this check deterministic:
1. Router matches user intent to skill(s)
2. Router checks if matched skills are a subset of any workflow's `steps[].skillId`
3. If yes → execute the workflow (preserves ordering, failure handling, checkpoints)
4. If no → execute skills individually

This eliminates ad-hoc skill chaining and ensures consistent execution semantics.

---

*End of Workflows Enrichment Design Document.*
