# V6 Memory Spine

## Purpose

Define how V6 handles durable memory across all providers using a single canonical contract. The memory spine is the nervous system of Creative Liberation Engine — every decision, pattern, session, and artifact flows through it.

## Canonical Unit

- **Schema**: `schemas/MEMORY_CONTRACT.schema.json`
- **Meta-spec**: JSON Schema draft 2020-12

Every durable memory item, regardless of origin, must be representable as a `MEMORY_CONTRACT` record. Items that cannot conform are non-canonical and exist only as ephemeral working context.

## Collections

- **Schema**: `schemas/MEMORY_INDEX.schema.json`
- **Location**: `runtime/memory/`

Collections group related memory records by topic:

| Collection | Purpose | Example Records |
|---|---|---|
| `decisions` | Architectural and governance decisions | `mem_v6_single_canon_decision` |
| `patterns` | Reusable implementation patterns | Agent boot sequences, schema validation |
| `sessions` | Post-flight session extractions | Conversation summaries, key findings |
| `artifacts` | Durable output references | Documents, designs, configurations |
| `incidents` | Failures, bugs, recovery actions | Service outages, data loss events |
| `experiments` | A/B tests, model evaluations | LoRA comparisons, prompt strategies |
| `workflows` | Workflow definitions and outcomes | Helix runs, pipeline results |

## Memory Providers

### SCRIBE — Post-Flight Extraction

| Property | Value |
|---|---|
| **When** | After each agent conversation ends |
| **What** | Decisions made, patterns discovered, errors encountered, task outcomes |
| **How** | SCRIBE MCP extracts structured records from conversation context |
| **Output** | `MEMORY_CONTRACT` records with `source: "SCRIBE"` |
| **Retention** | `working` → promoted to `durable` after review |

**Flow**:
```
Conversation End → SCRIBE MCP → Extract patterns/decisions
  → Validate against MEMORY_CONTRACT schema
  → Write to MEMORY_INDEX collection
  → Trigger wiki projection (if retentionClass ≥ durable)
```

### VAULT — Committed Session Notes

| Property | Value |
|---|---|
| **When** | Agent explicitly commits a finding or note |
| **What** | High-confidence observations, confirmed patterns, operator directives |
| **How** | Direct write through VAULT API with schema validation |
| **Output** | `MEMORY_CONTRACT` records with `source: "VAULT"` |
| **Retention** | `durable` or `canonical` |

**Flow**:
```
Agent/Operator → VAULT commit API → Schema validation
  → Write to MEMORY_INDEX collection
  → Update wiki projection
  → Update relation graph
```

### KI — Distilled Knowledge Items

| Property | Value |
|---|---|
| **When** | Periodic consolidation of related memories |
| **What** | Curated summaries distilled from multiple sessions/patterns |
| **How** | Consolidation agent merges related records into a single KI |
| **Output** | `MEMORY_CONTRACT` records with `source: "KI"` |
| **Retention** | `canonical` |

**Flow**:
```
Multiple working/durable records → KI consolidation
  → Merge summaries, deduplicate evidence
  → Validate against MEMORY_CONTRACT schema
  → Write as canonical KI record
  → Supersede source records (set lifecycleState: superseded)
```

### HANDOFF — Phase and Task Transitions

| Property | Value |
|---|---|
| **When** | Phase gate crossed, task completed, session handoff |
| **What** | Phase state, in-progress work, blockers, next actions |
| **How** | Structured HANDOFF.md parsed into memory records |
| **Output** | `MEMORY_CONTRACT` records with `source: "HANDOFF"` |
| **Retention** | `working` (current) or `archived` (completed) |

**Flow**:
```
HANDOFF.md update → Parse JSON block
  → Generate/update MEMORY_CONTRACT record
  → Write to sessions collection
  → Archive previous handoff record
```

### DISPATCH — Task Execution Records

| Property | Value |
|---|---|
| **When** | Dispatch task claimed, executed, completed, or failed |
| **What** | Task specs, execution logs, outcomes, metrics |
| **How** | Dispatch server emits structured records on state transitions |
| **Output** | `MEMORY_CONTRACT` records with `source: "DISPATCH"` |
| **Retention** | `working` → `durable` on success, `archived` on completion |

**Flow**:
```
Task state change → Dispatch event
  → Generate MEMORY_CONTRACT record
  → Write to workflows collection
  → Link to parent workflow via relations
```

### MANUAL — Operator-Authored Records

| Property | Value |
|---|---|
| **When** | Operator explicitly creates a memory record |
| **What** | Strategic decisions, project context, external knowledge |
| **How** | Direct JSON write or Obsidian note with valid frontmatter |
| **Output** | `MEMORY_CONTRACT` records with `source: "MANUAL"` |
| **Retention** | As specified by operator |

### RAG — Proxy-Pointer Retrieval

| Property | Value |
|---|---|
| **When** | Academy or CORTEX agents need specific factual knowledge |
| **What** | 100% accurate, exact-document semantic retrieval |
| **How** | Vector search over proxy pointers, which resolve to canonical NAS files |
| **Output** | Raw JSON, Markdown, or PDF text returned directly to context |
| **Retention** | N/A (Retrieval only) |

**Flow**:
```
Agent Query → Embed Query → Vector Search against Proxy Pointers
  → Resolve pointer metadata to NAS URI (e.g., \\127.0.0.1\rag_data\...)
  → Load exact canonical file bypassing LLM hallucination
  → Inject exact file contents into Agent context
```

## Memory Lifecycle

```
                    ┌──────────────────────────────────────┐
                    │          MEMORY LIFECYCLE             │
                    └──────────────────────────────────────┘

  ┌─────────┐    promote     ┌─────────┐    promote     ┌───────────┐
  │  draft  │ ─────────────► │ active  │ ─────────────► │ canonical │
  └─────────┘                └─────────┘                └───────────┘
       │                          │                          │
       │ discard                  │ supersede                │ archive
       ▼                          ▼                          ▼
  ┌─────────┐              ┌───────────┐              ┌──────────┐
  │ (gone)  │              │superseded │              │ archived │
  └─────────┘              └───────────┘              └──────────┘
                                 │
                                 │ deprecate
                                 ▼
                           ┌────────────┐
                           │ deprecated │
                           └────────────┘
```

### Retention Classes

| Class | Durability | Auto-Expire | Example |
|---|---|---|---|
| `ephemeral` | Session-scoped | Yes (end of session) | Working scratchpad, intermediate results |
| `working` | Days | Yes (7 days) | Unreviewed SCRIBE extractions |
| `durable` | Indefinite | No | Confirmed patterns, reviewed decisions |
| `canonical` | Permanent | No | Constitutional principles, architectural decisions |
| `archived` | Permanent (read-only) | No | Superseded or completed records |

## Projection Layer

Memory records are projected into human-readable surfaces:

### Obsidian Notes (Primary Projection)

- **Template**: `wiki/OBSIDIAN_NOTE_TEMPLATE.md`
- **Location**: `wiki/examples/` (development), Obsidian vault (production)
- **Sync**: Bi-directional via `wiki/WIKI_SYNC_RULES.md`
- **Frontmatter**: Maps 1:1 to `MEMORY_CONTRACT` required fields

### Graph Views

- Relations between memory records create navigable knowledge graphs
- `relations[].type` drives edge types: `depends_on`, `supersedes`, `duplicates`, `relates_to`, `derived_from`
- Graph queries resolve through the `MEMORY_INDEX` collection structure

### DokuWiki (Future Backend)

- CODEX wiki on NAS serves as durable web-accessible projection
- Read/write through contract-validated API only
- No direct wiki edits bypass schema validation

## Validation Rules

1. Every memory record must validate against `MEMORY_CONTRACT.schema.json`.
2. Every collection must validate against `MEMORY_INDEX.schema.json`.
3. No provider writes directly to projection surfaces — all writes flow through the canonical contract.
4. Wiki projections must preserve all required frontmatter fields on round-trip.
5. `memoryId` pattern: `^mem_[a-z0-9_\\-]{6,80}$` — globally unique, human-readable.
6. `confidence` range: `0.0` (unverified) to `1.0` (confirmed).
7. `provenance.recordedBy` must reference a known agent or `MANUAL`.

## Round-Trip Guarantee

The memory spine guarantees that any memory record can:

1. **Write** → Validate against schema → Store in `MEMORY_INDEX` collection
2. **Project** → Generate Obsidian note with valid frontmatter from record
3. **Edit** → Modify Obsidian note preserving frontmatter fields
4. **Sync back** → Parse frontmatter → Validate against schema → Update canonical record

This is demonstrated by the example records in `runtime/memory/` and their corresponding wiki notes in `wiki/examples/`.
