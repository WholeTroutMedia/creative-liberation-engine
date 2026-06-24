---
name: route-governor
version: 1.0.0
description: Enforce route manifest integrity, ownership, auth policy consistency, and drift controls across gateway and service APIs.
constitutional_articles: [I, IV, IX, XX]
lead_agents: [RELAY, SWITCHBOARD, ARCHON]
scribe_on_complete: true
agentCallable: true
---

# Route Governor Skill

Use this skill when APIs are added, modified, deprecated, or failing route conformance.

## Core Protocol

1. Validate route entries against route schemas and manifests.
2. Detect drift between manifest declarations and runtime behavior.
3. Enforce ownership, auth policy, timeout, and observability fields.
4. Block rollout if routes are undefined, ambiguous, or policy-noncompliant.
5. Emit actionable fix set with minimal blast radius sequencing.
