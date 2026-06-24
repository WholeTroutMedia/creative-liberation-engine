# Agent Excellence 2026

This document captures research-backed upgrades for V6 agents, skills, and orchestration.

## Applied Principles

- **Trajectory-level evals** over output-only scoring.
- **Trace-first observability** with run-level diagnostics.
- **Tool contract discipline** (`ok/data/error/meta` style outputs and retry budgets).
- **Memory governance** (working vs durable vs canonical memory boundaries).
- **Routing arbitrage** balancing cost, latency, and quality tiers.

## Sources

- MAESTRO evaluation suite (`arXiv:2601.00481`)
- COCO reliability architecture (`arXiv:2508.13815`)
- 2026 practical agent architecture and eval readiness references.

## V6 Upgrades

1. Add runtime registries for agents, skills, workflows (`runtime/registry`).
2. Add bootstrap import pipeline from historical `.agents`.
3. Add next-gen skill set for incidents, evals, and route governance.
4. Add validation gates for registry schemas and runtime examples.
5. Add API surface (`registry-api`) for visibility and recommendation output.
