# V6 Workflow Target Matrix

Canonical workflow set required for V6 orchestration reliability.

## Core Spine (Mandatory)

| Workflow ID | Purpose |
|---|---|
| `ideate` | Discovery and direction generation |
| `plan` | Architecture and execution planning |
| `ship` | Implementation and delivery |
| `validate` | Quality, policy, and readiness gates |

## Operations & Handoff (Mandatory)

| Workflow ID | Purpose |
|---|---|
| `pickup` | Task acquisition from queue |
| `handoff` | Cross-session continuity |
| `status` | System/workstream status snapshot |
| `sync` | Source-of-truth synchronization |
| `claim` | Workstream ownership lock |
| `blockers` | Blocker filing and escalation |
| `release` | Promotion/release orchestration |
| `commit` | Change checkpointing |

## Helix & Routing (Mandatory)

| Workflow ID | Purpose |
|---|---|
| `ipsv-spine` | Canonical routing architecture |
| `helix-engineering` | Engineering lane |
| `helix-stitch` | UI/design implementation lane |
| `helix-content` | Content production lane |
| `helix-marketing` | GTM/marketing lane |
| `helix-photo` | Visual media lane |
| `helix-creative-direction` | Creative direction lane |

## Reliability & Recovery (Mandatory)

| Workflow ID | Purpose |
|---|---|
| `ram-crew` | Recovery and anti-stall interventions |
| `auto-loop` | Continuous autonomous execution |
| `shadow-qa` | Independent QA validation loop |
| `surgical` | Precision change path |
| `capability-reload` | Mid-session capability refresh |

## Evaluation (Mandatory)

| Workflow ID | Purpose |
|---|---|
| `eval-regression` | Regression evaluation pipeline |
| `eval-capability` | Capability scorecard evaluation |
