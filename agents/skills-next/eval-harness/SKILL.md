---
name: eval-harness
version: 1.0.0
description: Build and run trajectory-level evaluations for agents, tools, and workflows using correctness, safety, latency, and cost metrics.
constitutional_articles: [IV, IX, XIV, XX]
lead_agents: [VERA, PROOF, HARBOR]
scribe_on_complete: true
agentCallable: true
---

# Eval Harness Skill

Use this skill when introducing or modifying agent behavior, model routing, workflow orchestration, or tool contracts.

## Core Protocol

1. Define test sets as trajectory assertions, not just final answers.
2. Track dimensions: correctness, safety, latency, and cost.
3. Run regression and capability evals separately.
4. Compare against previous baselines and flag quality regressions.
5. Persist evaluation artifacts and decision summaries for retrieval.
