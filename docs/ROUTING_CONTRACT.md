# V6 Routing Contract

## Purpose

Define how HTTP and internal routes are declared, owned, and validated in V6. Every route in the system must be declared in a manifest before code, gateway configs, or reverse proxy rules can reference it.

## Canonical Units

| Schema | Purpose |
|---|---|
| `schemas/ROUTE_CONTRACT.schema.json` | Single route declaration with ownership, auth, and observability |
| `schemas/ROUTE_MANIFEST.schema.json` | Collection of routes belonging to one service |

## Manifest Structure

Each service provides a route manifest at `runtime/routes/<service>.manifest.json`:

```json
{
  "version": "v6.0",
  "service": "<service-name>",
  "routes": [
    {
      "routeId": "route_<service>_<action>",
      "path": "/<api-path>",
      "method": "GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD|ANY",
      "owner": "<AGENT_NAME>",
      "upstreamService": "<service-name>",
      "upstreamPath": "/<internal-path>",
      "authPolicy": "public|api_key|session|service_token|internal_only",
      "timeoutMs": 5000,
      "criticality": "tier0|tier1|tier2|tier3|tier4|tier5",
      "observability": {
        "trace": true,
        "metrics": true,
        "logFields": ["routeId", "statusCode", "latencyMs"]
      },
      "lifecycle": "active|legacy|deprecated|planned"
    }
  ]
}
```

## Service Manifest Registry

| Manifest | Service | Owner | Routes | Status |
|---|---|---|---|---|
| `dispatch.manifest.json` | dispatch | ATHENA | 5 | active |
| `genkit.manifest.json` | genkit | GENKI | 3 | active |
| `pulse.manifest.json` | pulse | SYSTEMS | 3 | active |
| `memory-api.manifest.json` | memory-api | STRATA | 5 | active |
| `reasoning-core.manifest.json` | reasoning-core | ATHENA | 4 | active |
| `workspace-autonomy.manifest.json` | workspace-autonomy | ATHENA | 4 | active |
| `cle-ai-runtime.manifest.json` | cle-ai-runtime | SYSTEMS | 5 | active |
| `video-agency.manifest.json` | video-agency | SYSTEMS | 9 | active |
| `ROUTE_MANIFEST.example.json` | example-service | SYSTEMS | 1 | example |

**Total declared routes: 38** (across 8 live services + 1 example)

## Route-to-Service Mapping

### How Manifests Map to Services

```
                    ┌──────────────────────────────────┐
                    │        ROUTE MANIFEST            │
                    │   runtime/routes/<svc>.manifest   │
                    └──────────┬───────────────────────┘
                               │
                    declares routes for
                               │
                    ┌──────────▼───────────────────────┐
                    │     UPSTREAM SERVICE              │
                    │  Docker container / process       │
                    │  Identified by "service" field    │
                    └──────────┬───────────────────────┘
                               │
                    routes consumed by
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼──────┐ ┌──────▼───────┐ ┌──────▼───────┐
    │   API Gateway  │ │  Reverse     │ │  Internal    │
    │   (Traefik)    │ │  Proxy       │ │  Service     │
    │                │ │  (Caddy)     │ │  Mesh        │
    └────────────────┘ └──────────────┘ └──────────────┘
```

### Mapping Rules

1. **`service`** field identifies the Docker Compose service name or process ID.
2. **`upstreamService`** + **`upstreamPath`** define the internal routing target.
3. **`path`** is the external-facing route exposed through the gateway.
4. Gateway configs (Traefik, Caddy, Cloudflare Tunnel) are **derived from** manifests, never authored independently.

## Route Properties

### Route ID Convention

Pattern: `route_<service>_<action>`

Examples:
- `route_dispatch_task_create`
- `route_genkit_inference`
- `route_pulse_heartbeat`
- `route_memory_write`

### Auth Policies

| Policy | Description | Use Case |
|---|---|---|
| `public` | No authentication required | Public health checks, marketing pages |
| `api_key` | Static API key in header | External integrations, webhooks |
| `session` | Session-based auth (cookie/JWT) | UI dashboards, user-facing apps |
| `service_token` | Service-to-service token | Internal API calls between services |
| `internal_only` | Network-level restriction (localhost/VPN) | Admin endpoints, debugging |

### Criticality Tiers

| Tier | Response SLA | Description |
|---|---|---|
| `tier0` | < 100ms p99 | Core execution path — system stops without this |
| `tier1` | < 500ms p99 | Important operational — degraded experience without this |
| `tier2` | < 2s p99 | Standard — user-visible but not blocking |
| `tier3` | < 5s p99 | Background — async processing, batch jobs |
| `tier4` | < 30s p99 | Low priority — reports, exports |
| `tier5` | Best effort | Experimental — may fail without consequence |

### Lifecycle States

| State | Meaning |
|---|---|
| `active` | Route is live and serving traffic |
| `legacy` | Route works but has a planned successor |
| `deprecated` | Route is scheduled for removal — `deprecation` object required |
| `planned` | Route is designed but not yet implemented |

## Optional Fields

| Field | Type | Purpose |
|---|---|---|
| `upstreamPath` | string | Internal path when different from external `path` |
| `rateLimit` | object | Rate limiting config `{enabled, requests, windowSeconds}` |
| `idempotency` | enum | Whether requests must be idempotent (`required`, `optional`, `not_applicable`) |
| `observability` | object | Trace, metrics, and log field configuration |
| `deprecation` | object | Removal plan with `plannedRemoval` date and `replacementRouteId` |

## Validation Rules

1. Every manifest must validate against `ROUTE_MANIFEST.schema.json`.
2. Every route within a manifest must validate against `ROUTE_CONTRACT.schema.json`.
3. No route exists in code or gateway config that is not declared in a manifest.
4. `routeId` values must be globally unique across all manifests.
5. Deprecation timeline must be documented for any route in `deprecated` lifecycle.
6. Manifests are validated by the contract validation test suite (`tests/contract-validation.test.mjs`, Section 7).

## Adding New Routes

1. Create or update the service manifest at `runtime/routes/<service>.manifest.json`.
2. Ensure all required fields are present per `ROUTE_CONTRACT.schema.json`.
3. Run `node tests/contract-validation.test.mjs` to validate.
4. Update gateway config (derived from manifest, not vice versa).
5. Deploy service with new route.

## State Persistence Guarantees

### Purpose

Define how the dispatch system maintains state across task invocations, agent restarts, and session boundaries. This section establishes the contract between the routing layer and long-horizon task execution.

### Persistence Layers

| Layer | Storage | Durability | TTL | Use Case |
|---|---|---|---|---|
| **Task State** | PostgreSQL (dispatch DB) | Durable | Indefinite | Task lifecycle, outcome, metadata |
| **Agent Context** | Redis | Volatile | 24h default | Active session state, conversation context |
| **Checkpoint Data** | PostgreSQL + filesystem | Durable | 30d | Long-horizon task resume points |
| **Memory Spine** | ChromaDB + filesystem | Durable | Indefinite | Cross-session knowledge, embeddings |
| **Audit Trail** | PostgreSQL | Durable (append-only) | Indefinite | Governance compliance, decision log |

### State Guarantees

1. **Task outcomes are never lost.** Every task that enters the dispatch queue will have a terminal state recorded (completed, failed, or dead_letter), regardless of agent availability.

2. **Agent restarts do not lose active task state.** Task state is persisted to PostgreSQL before any agent-side processing begins. If an agent crashes, the task reverts to DISPATCHED and is re-assignable.

3. **Cross-session knowledge persists.** The Memory Spine (ChromaDB + STRATA) survives container restarts, NAS reboots, and workstation power cycles. Data is on durable storage, not in-memory only.

4. **Checkpoint data survives agent reassignment.** When a long-horizon task is reassigned to a different agent (see `LONG_HORIZON_DISPATCH.md`), the new agent receives the full checkpoint state from the previous execution.

5. **Audit trails are append-only.** No operation can modify or delete audit records. This is enforced at the database level (no UPDATE/DELETE permissions on audit tables).

### State Loss Scenarios (Known Gaps)

| Scenario | Impact | Mitigation |
|---|---|---|
| Redis flush | Active session context lost | Agents re-initialize from Memory Spine; graceful degradation |
| NAS storage failure | All durable state at risk | RAID6 on UGREEN DXP6800; backup schedule TBD |
| Model swap during active task | Context window resets | Checkpoint before model swap; resume with new model |
| Concurrent agent writes | Race condition on shared state | Redis WATCH/MULTI for atomic operations |

### Routing State Contract

When a request arrives at any route:
1. The route handler MUST read current task state from PostgreSQL (not cache) for state-dependent decisions.
2. The route handler MUST write state changes within a database transaction.
3. State changes MUST be logged to the audit trail before the response is sent.
4. If the upstream service is unavailable, the route MUST return a retriable error (503) with `Retry-After` header, NOT silently drop state.

