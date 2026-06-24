---
name: incident-commander
version: 1.0.0
description: Coordinate multi-service incident response with rollback discipline, blast-radius controls, and postmortem artifact generation.
constitutional_articles: [I, IV, IX, XIV, XX]
lead_agents: [SYSTEMS, ARCHON, SENTINEL]
scribe_on_complete: true
agentCallable: true
---

# Incident Commander Skill

Use this skill when runtime degradation, service outages, regression spikes, or cascading agent failures are detected.

## Core Protocol

1. Triage and classify severity (SEV-1 to SEV-4).
2. Identify affected services and dependencies.
3. Stabilize first (rollback, isolate, traffic shed), optimize second.
4. Preserve evidence: logs, traces, failing payloads, route and model decisions.
5. Produce postmortem with root cause, remediation, and prevention checklist.
