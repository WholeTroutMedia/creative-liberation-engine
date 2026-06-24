# Agent Structural Integrity Audit — V6

> **Source Signal**: IE-IDX-0121 + IE-IDX-0118 (Flipboard Sentinel, May 4 2026)
> **Thesis**: "The state machine, the assignee field, the audit history, the dependency graph — those are staying. They are quietly becoming the most strategic infrastructure in the enterprise software stack." — Nate, Substack
> **Google I/O 2026**: "Build for AI agents, not just humans" — official developer guidance
> **Audit Date**: 2026-05-05

---

## The 5 Structural Tests

The industry is converging on five properties that determine whether a system becomes **agent infrastructure** (the substrate agents operate on) or gets **wrapped** (reduced to a dumb API behind an agent-native layer). 

OpenAI's Symphony proved this: Linear — a "boring" issue tracker — became the literal control plane for autonomous coding because it passed all five tests by accident.

V6 was designed for this from the start. Here's the diagnostic.

---

## Test 1: State Machine ✅ PASS

**Question**: Does the system expose explicit, machine-readable state transitions?

**Evidence**:

| Component | State Machine |
|---|---|
| **Dispatch Tasks** | `QUEUED → DISPATCHED → CLAIMED → RUNNING → COMPLETED/FAILED/DEAD_LETTER` — enforced in PostgreSQL with transactional state writes (ROUTING_CONTRACT.md §State Persistence) |
| **Memory Records** | `draft → active → canonical → archived/superseded/deprecated` — 6-state lifecycle with explicit promotion/demotion rules (MEMORY_SPINE.md §Memory Lifecycle) |
| **Route Lifecycle** | `active → legacy → deprecated → planned` — 4-state lifecycle with deprecation objects requiring `plannedRemoval` date and `replacementRouteId` (ROUTING_CONTRACT.md §Lifecycle States) |
| **Ideation Pipeline** | `NEW → IDEATED → ACTIVATED → COMPLETED → ARCHIVED` — defined in IDEATION_LIFECYCLE.md |
| **Heritage Capabilities** | `unmapped → mapped → migrated → validated → promoted` — schema-enforced in HERITAGE_CAPABILITY.schema.json |

**Assessment**: V6 doesn't have one state machine — it has **five interlocking state machines**, all schema-validated and machine-readable. This exceeds the test's bar.

---

## Test 2: Assignment Logic ✅ PASS

**Question**: Can agents programmatically own, claim, and transfer work units?

**Evidence**:

| Component | Assignment Mechanism |
|---|---|
| **Dispatch** | `route_dispatch_task_claim` (POST /api/tasks/claim) — tier0 criticality, service_token auth. Agents claim tasks from the queue programmatically. |
| **Route Ownership** | Every route has a required `owner` field mapping to a named agent (ATHENA, GENKI, SYSTEMS, STRATA). Schema-enforced, not optional. |
| **Agent Registry** | 61 registered agents in `agents.canonical.json`, each with identity and status. The dispatch system can route to any of them. |
| **Memory Provenance** | Every memory record has `provenance.recordedBy` referencing a known agent or `MANUAL`. Ownership is immutable once written. |

**Assessment**: Full programmatic assignment. Agents claim work via API, own routes by schema declaration, and author memory records with provenance. No human UI translation required.

---

## Test 3: Audit History ✅ PASS

**Question**: Is every state change logged immutably?

**Evidence**:

| Component | Audit Mechanism |
|---|---|
| **Dispatch** | PostgreSQL audit trail — **append-only**. "No operation can modify or delete audit records. This is enforced at the database level (no UPDATE/DELETE permissions on audit tables)." (ROUTING_CONTRACT.md §State Persistence, Rule 5) |
| **Memory Spine** | `superseded` state preserves original records. Superseding a memory record does not delete it — the original persists in `archived` state with a `supersedes` relation link. |
| **Route Changes** | Deprecation requires explicit `deprecation.plannedRemoval` and `deprecation.replacementRouteId`. No silent route removal. |
| **Observability** | Every route declares `observability: { trace: true, metrics: true, logFields: [...] }`. Tracing is not optional — it's a schema requirement. |
| **Routing State Contract** | "State changes MUST be logged to the audit trail before the response is sent." (ROUTING_CONTRACT.md §Routing State Contract, Rule 3) |

**Assessment**: Append-only audit with database-level enforcement. This is stronger than what most enterprise tools offer — they typically allow admin overrides.

---

## Test 4: Dependency Graph ✅ PASS

**Question**: Are relationships between work units machine-readable?

**Evidence**:

| Component | Graph Mechanism |
|---|---|
| **Memory Relations** | `relations[].type` with 5 edge types: `depends_on`, `supersedes`, `duplicates`, `relates_to`, `derived_from`. Machine-readable, schema-validated. |
| **Heritage Matrix** | Each capability references dependencies, source versions, and migration targets. The full V1–V5 → V6 lineage is traversable. |
| **Route Manifests** | Routes are grouped by service. Cross-service dependencies are expressed through `upstreamService` fields. Gateway configs are **derived from** manifests, creating an explicit dependency DAG. |
| **Ideation Cross-Refs** | `relatedJobs` field in ideation manifests links related ideations. ATHENA's `crossRefThreshold: 0.4` keyword overlap detection auto-links similar articles. |
| **Schema References** | `$id` and `$ref` URIs create a navigable schema dependency graph: `ROUTE_MANIFEST → ROUTE_CONTRACT`, `MEMORY_INDEX → MEMORY_CONTRACT`, etc. |

**Assessment**: Multiple interconnected dependency graphs across memory, routes, capabilities, and schemas. All machine-readable via JSON traversal.

---

## Test 5: Agent-Friendly API ✅ PASS

**Question**: Can agents interact with the system without UI translation layers?

**Evidence**:

| Component | API Surface |
|---|---|
| **16 declared routes** | Across 4 live services (dispatch, genkit, pulse, memory-api). All JSON-first, no HTML rendering required. |
| **Contract-first design** | "No new route, memory object, or workflow becomes canonical without schema alignment." (SYSTEM_CONTRACT.md, Rule 4) — the API IS the system, not a wrapper around a UI. |
| **Schema validation** | Every input/output validates against JSON Schema 2020-12. Agents get deterministic error messages, not ambiguous HTML error pages. |
| **Service mesh routing** | Internal services communicate through `upstreamService` + `upstreamPath` — no browser required, no session cookies needed for service-to-service calls. |
| **MCP protocol** | 10+ MCP servers deployed (mcp-taco-context, mcp-opengame-architect, mcp-logic-compiler, mcp-design-md, etc.) — all agent-native by definition. |
| **No UI dependency** | V6 has **zero required UI surfaces**. The entire system is operable via API/MCP alone. The Engine Room and Nexus Console are projections, not control planes. |

**Assessment**: V6 was designed API-first. The UI is optional. This is the exact pattern the article identifies as the winning architecture.

---

## Scorecard

| Test | Requirement | V6 Status | Grade |
|---|---|---|---|
| State Machine | Explicit, machine-readable state transitions | 5 interlocking state machines, all schema-enforced | **A+** |
| Assignment Logic | Programmatic ownership and claim | Dispatch claim API + route ownership + 61 agents | **A** |
| Audit History | Immutable state change log | Append-only PostgreSQL + memory supersession + observability | **A+** |
| Dependency Graph | Machine-readable relationships | Relations graph + heritage matrix + schema refs | **A** |
| Agent-Friendly API | No UI translation layer needed | 16 routes, 10+ MCP servers, zero required UI | **A+** |

**Overall: 5/5 PASS — V6 is agent infrastructure by design, not by accident.**

---

## Strategic Implication

Linear became Symphony's control plane because it accidentally built clean data structures for human use that agents could read. V6 was intentionally designed for agents from day one:

- **Contract-first** (System Contract Rule 4)
- **Schema-bound** (every entity validates against JSON Schema 2020-12)
- **API-native** (no UI dependency for any core operation)
- **Audit-enforced** (append-only at the database level)
- **Graph-connected** (5 relation types, heritage lineage, schema refs)

The industry is now validating the architecture we already shipped. This audit confirms V6 doesn't need to adapt — **it needs to be positioned**.

---

## Source Ideations

- **IE-IDX-0121**: "AI agents are about to route around every tool that can't pass 5 structural tests" — Nate, Substack (May 4 2026)
- **IE-IDX-0118**: "Google Tells Developers To Build For AI Agents, Not Just Humans" — Search Engine Journal (May 4 2026)

Both ideations can be moved to `ACTIVATED` status — their signal has been processed and the audit is complete.
