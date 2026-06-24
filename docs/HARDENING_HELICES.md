# V6 Hardening Helices

This document defines the six parallel hardening lanes that must remain in a hardened state before final live connectivity and operations testing.

## Helix A: Execution Plane

- Dispatch contract integrity
- Idempotency guarantees
- Retry and backpressure controls
- Resume and recovery path

## Helix B: ModelOps and Routing

- Required model tier coverage
- Health and fallback contracts
- QoS guardrails
- LoRA-to-model compatibility gates

## Helix C: Memory Plane

- Working, summary, artifact, and long-term memory layers
- Provenance and retention metadata enforcement

## Helix D: Security and Policy

- Secrets and policy contracts
- Allow/deny decision boundaries
- Audit trail emission requirements

## Helix E: Release Governance

- Promotion readiness criteria
- Rollout and rollback policy controls
- Compatibility and migration checks

## Helix F: Reliability and Observability

- Golden signals and SLO contracts
- Alert and runbook mapping
- Fault-injection readiness

## Final Remaining Step

When all six helix manifests validate as `hardened`, the only remaining item is live environment connectivity and operational testing.
