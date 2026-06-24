---
name: "rollback-operator"
description: "Rollback Operator skill for runtime ops operations in Creative Liberation Engine V6."
agentCallable: true
---

# Rollback Operator

## Purpose

Provide a production-grade rollback operator capability for the runtime ops family.

## Inputs

- Structured task context
- Relevant runtime state and registry artifacts
- Constraints (security, cost, latency, constitutional policy)

## Outputs

- Action plan with explicit steps
- Execution artifacts and verification results
- Escalation notes when blocking conditions occur

## Guardrails

- No destructive operations without explicit operator direction
- Maintain constitutional compliance and provenance tracking
- Emit machine-readable outcomes for downstream workflow orchestration
