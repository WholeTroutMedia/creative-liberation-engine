# Long-Horizon Dispatch — Extension Specification

> **Version:** 1.0.0  
> **Source:** Article #12 — "Kimi K2.6 Runs Agents for Days" (VentureBeat, Apr 2026)  
> **Date:** 2026-04-22

---

## Problem Statement

V6's dispatch architecture currently handles **task-level execution** — individual tasks measured in seconds to minutes. Moonshot AI's Kimi K2.6 demonstrated that production-grade agents can run autonomously for **5+ days**, coordinating up to **300 sub-agents** across **4,000+ coordinated steps**.

Current enterprise orchestration frameworks (including V6's) were designed for bounded-time workflows. Long-horizon operation exposes five fundamental gaps:

1. **State Persistence** — What happens when a long-running agent's host process restarts?
2. **Failure Recovery** — How are sub-tasks reassigned when an agent fails mid-execution?
3. **Resource Budgeting** — How do you prevent a multi-day task from starving other work?
4. **Observability** — How do you monitor an agent that's been running for 72 hours?
5. **Termination Policy** — When should a long-horizon task be forcibly stopped?

---

## Architecture: Checkpoint/Resume Protocol

### Task State Machine (Extended)

```
CREATED → DISPATCHED → RUNNING → [CHECKPOINT] → RUNNING → ... → COMPLETED
                          ↓                                         ↑
                       FAILED → RETRY → DISPATCHED ────────────────┘
                          ↓
                       DEAD_LETTER
```

New states:
- **CHECKPOINT** — Agent persists current state to durable storage, then resumes
- **RETRY** — Failed task is re-dispatched (with checkpoint data) to same or different agent
- **DEAD_LETTER** — Task exceeded max retries; requires human intervention

### Checkpoint Data Contract

```json
{
  "taskId": "string",
  "agentId": "string",
  "checkpointId": "uuid",
  "timestamp": "ISO8601",
  "stepIndex": 0,
  "totalSteps": 0,
  "state": {},
  "artifacts": [],
  "nextAction": "string",
  "resourcesConsumed": {
    "gpuMinutes": 0,
    "apiCalls": 0,
    "tokensProcessed": 0
  }
}
```

### Checkpoint Triggers
- **Time-based:** Every N minutes (configurable, default: 30)
- **Step-based:** Every N completed sub-steps
- **Event-based:** Before any external API call or resource-intensive operation
- **Preemptive:** When system detects low memory or pending restart

---

## Failure Recovery Protocol

### Level 1 — Self-Healing
Agent detects own error, rolls back to last checkpoint, retries with modified approach.

### Level 2 — Dispatch Reassignment
If agent fails completely:
1. Dispatch retrieves last checkpoint
2. Selects available agent with matching skill profile
3. Hydrates new agent with checkpoint state
4. Resumes from checkpoint (not from scratch)

### Level 3 — Human Escalation
If task exceeds `maxRetries` (default: 3):
1. Task moves to DEAD_LETTER queue
2. Alert sent via configured channel (SMS/webhook)
3. Human reviews checkpoint data and decides: resume, modify, or cancel

---

## Heartbeat Monitoring

Long-running agents MUST emit periodic heartbeats:

```json
{
  "agentId": "string",
  "taskId": "string",
  "heartbeatAt": "ISO8601",
  "status": "healthy | degraded | stalled",
  "currentStep": "string",
  "resourceUsage": {
    "gpuUtilization": 0.0,
    "memoryMB": 0,
    "cpuPercent": 0.0
  }
}
```

- **Heartbeat interval:** 60 seconds (configurable)
- **Stale threshold:** 5 missed heartbeats = STALLED
- **STALLED → FAILED** after 15 minutes without recovery

---

## Resource Budgeting

### Per-Task Budgets

Each long-horizon task is assigned resource limits:

| Resource | Default Limit | Configurable |
|----------|-------------|--------------|
| GPU Minutes | 1440 (24h) | Yes |
| API Calls | 10,000 | Yes |
| Tokens Processed | 50M | Yes |
| Wall-Clock Duration | 168h (7d) | Yes |
| Sub-Agent Spawns | 50 | Yes |

When a budget threshold reaches 80%, the agent receives a `BUDGET_WARNING`.  
At 100%, the agent receives a `BUDGET_EXCEEDED` and must checkpoint and yield.

### Priority Lanes

| Lane | Max Concurrent | Max Duration | Use Case |
|------|---------------|-------------|----------|
| `critical` | 2 | Unlimited | System operations, incident response |
| `production` | 5 | 48h | Active production tasks |
| `background` | 10 | 168h | Research, indexing, optimization |
| `speculative` | 3 | 24h | Experimental / R&D tasks |

---

## K2.6 Architectural Lessons

From Moonshot AI's Kimi K2.6 release:

### Agent Swarm Pattern
- Up to 300 sub-agents executing 4,000+ coordinated steps
- Dynamic task decomposition with failure detection
- Automatic task reassignment on sub-agent failure

**V6 Application:** V6's dispatch can already queue multiple tasks, but lacks:
- Explicit parent-child task relationships
- Coordinated multi-agent execution plans
- Dynamic rebalancing when sub-tasks fail

### Claw Groups Pattern
- Multi-agent + multi-device + human-in-the-loop collaboration spaces
- Agents and humans share an operational workspace across devices

**V6 Application:** Maps to AVERI's multi-agent collaboration. Currently each agent operates independently via dispatch. Claw Groups suggest a shared workspace model where agents see each other's state and can coordinate directly.

### Model Architecture Notes
- K2.6: 1T parameter MoE, 32B active per token
- This means only 32B parameters are active at any given time — within range of RTX 4090
- However, the full model weights (1T) require ~500GB+ storage and multi-GPU for loading
- **V6 Decision:** Defer K2.6 evaluation to GPU_GROWTH_PLAN.md milestone

---

## Implementation Priority

| Component | Priority | Effort | Dependencies |
|-----------|---------|--------|-------------|
| Checkpoint/Resume Protocol | HIGH | 3–4 sessions | Dispatch queue schema |
| Heartbeat Monitoring | HIGH | 1–2 sessions | None |
| Resource Budgeting | MEDIUM | 2–3 sessions | Checkpoint protocol |
| Failure Recovery (L1–L2) | MEDIUM | 2–3 sessions | Checkpoint protocol |
| Parent-Child Task Graph | LOW | 3–4 sessions | Core dispatch refactor |
| Claw Groups (shared workspace) | LOW | 5+ sessions | Agent identity system |

> [!NOTE]
> This is a specification document. Implementation is deferred to a future sprint after Tier 1 + Tier 2 validation is complete. The spec ensures architectural readiness when long-horizon workloads become a production requirement.
