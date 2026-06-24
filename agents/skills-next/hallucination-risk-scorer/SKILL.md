---
name: "hallucination-risk-scorer"
description: "Hallucination Risk Scorer skill for model agent quality operations in Creative Liberation Engine V6."
agentCallable: true
---

# Hallucination Risk Scorer

## Purpose

Provide a production-grade hallucination risk scorer capability for the model agent quality family.

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
