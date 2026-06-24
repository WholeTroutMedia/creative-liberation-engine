# Ideation Lifecycle System

> **Status:** Contracted  
> **Schema:** `schemas/IDEATION_INDEX.schema.json`, `schemas/IDEATION_SHARD.schema.json`  
> **Owner:** ATHENA (strategic), Flipboard Sentinel (ingestion), Sentinel Command (UI)  
> **Phase:** WS-02 → WS-03

---

## Problem Statement

Ideations are currently loose JSON files on disk with no lifecycle management, no central index, no review cadence, and no tracking of what happens after ATHENA analysis. They are artifacts, not entities. This means:

- No way to know which ideations were acted upon vs. ignored
- No historical analysis of what was ideated, activated, or completed
- No monthly review cycle to resurface stale opportunities
- No source-level analytics (which feeds produce the best ideas?)
- No connection between an ideation and the work it eventually spawned
- Email delivery is fire-and-forget with no tracking

## Design Principles

1. **First-class OS objects** — Ideations are entities in the Creative Liberation Engine, not files
2. **Full lifecycle tracking** — Every status transition is audited with who, when, why
3. **Source provenance** — Every ideation traces back to its origin with full metadata
4. **Review cadence** — Monthly cycles ensure nothing falls through the cracks
5. **Dual-layer storage** — Individual files for full data, registry index for fast queries
6. **Backward compatible** — Existing 105 ideations migrate cleanly into the new schema

---

## State Machine

```
                    ┌──────────┐
                    │ INGESTED │ ← RSS poll, manual entry, chat, agent
                    └────┬─────┘
                         │ (save to queue)
                    ┌────▼─────┐
                    │BRAINSTORM│ ← Source saved, no ATHENA analysis yet
                    └────┬─────┘
                         │ (ATHENA processes)
                    ┌────▼─────┐
                    │ IDEATED  │ ← ATHENA output attached, email sent
                    └────┬─────┘
                         │ (operator reads email / reviews in Sentinel Command)
                    ┌────▼─────┐
                    │ REVIEWED │ ← Human decision recorded
                    └────┬─────┘
                         │ (operator says "do this")
                    ┌────▼──────┐
                    │ ACTIVATED │ ← Assigned to agent/project, work begins
                    └────┬──────┘
                         │ (implementation in progress)
                  ┌──────▼───────┐
                  │ IN_PROGRESS  │ ← Active development/research
                  └──────┬───────┘
                         │ (code/design/doc produced)
                    ┌────▼─────┐
                    │ SHIPPED  │ ← Deliverable deployed or published
                    └────┬─────┘
                         │ (verification)
                    ┌────▼──────┐
                    │ VALIDATED │ ← Confirmed working/impactful
                    └────┬──────┘
                         │ (final close)
                    ┌────▼──────┐
                    │ COMPLETED │ ← Done. Historical record.
                    └───────────┘

  Side exits (from any active state):
    → PARKED     : Revisit later (auto-surfaces in monthly review)
    → ARCHIVED   : Closed, no further action (stale timeout or manual)
    → DISCARDED  : Explicitly rejected (with reason logged)
```

### Transition Rules

| From | To | Trigger | Required |
|---|---|---|---|
| — | INGESTED | RSS poll, manual entry | source.url, source.title |
| INGESTED | BRAINSTORM | Source text scraped, queued | source.excerpt or fullText |
| BRAINSTORM | IDEATED | ATHENA analysis complete | athena.directive |
| IDEATED | REVIEWED | Operator reviews in UI or email | review verdict |
| REVIEWED | ACTIVATED | Operator approves for execution | lifecycle.owner |
| ACTIVATED | IN_PROGRESS | Work begins | — |
| IN_PROGRESS | SHIPPED | Deliverable produced | deliverables.artifacts[0] |
| SHIPPED | VALIDATED | Verification passes | — |
| VALIDATED | COMPLETED | Final sign-off | — |
| Any active | PARKED | Paused for later | reason |
| Any active | ARCHIVED | Stale or superseded | reason |
| Any active | DISCARDED | Rejected | reason |

---

## Storage Architecture

### Layer 1: Individual Ideation Files

```
/app/genesis-deploy/runtime/ideation-queue/
  IE-IDX-0001_untitled.json
  IE-IDX-0002_how-i-made-gemma-4-10x-faster.json
  ...
  IE-IDX-0105_speeding-up-agentic-workflows.json
```

Each file conforms to `IDEATION_LIFECYCLE.schema.json`. These are the **source of truth** for full ideation data.

### Layer 2: Sharded Registry Index

```
/app/creative-liberation-engine/runtime/registry/ideations/
  ├── _index.json        ← Master stats, dedup sets, and shard manifest
  ├── 2026-05.json       ← Monthly shard with lightweight index entries
  ├── 2026-06.json
  └── archived.json      ← Archived/discarded entries (all months)
```

Conforms to `schemas/IDEATION_INDEX.schema.json` (for `_index.json`) and `schemas/IDEATION_SHARD.schema.json` (for monthly shards). Contains:
- Lightweight projections of every active active ideation partitioned by calendar month
- Master index statistics (by status, domain, source, relevance)
- `seenGuids` and `seenUrls` sets to prevent duplicate ingestion at the source
- Review schedule and overdue tracking

The sharded registry is **rebuilt from Layer 1** on demand via the rebuild-ideation-index script. It is a derived projection, not a primary store.

### Layer 3: Obsidian Vault (Human-Readable)

```
/app/genesis-deploy/runtime/nexus-vault/Sentinel/
  IE-IDX-0001_untitled.md
  ...
```

Obsidian notes for reading in the knowledge vault. Generated from Layer 1 data.

---

## Review Cycle

### Monthly Review Protocol

On the 1st of each month, the Sentinel service generates a **Review Digest**:

1. **Surface all IDEATED** ideations older than 30 days without operator action
2. **Surface all PARKED** ideations for re-evaluation
3. **Surface all ACTIVATED** ideations without progress for >30 days
4. **Generate source analytics** — which feeds produced high-relevance ideations?
5. **Email the digest** with a link to Sentinel Command filtered view

### Review Verdicts

| Verdict | Meaning | Effect |
|---|---|---|
| `still_relevant` | Keep in current state | Next review in 30 days |
| `needs_update` | Re-analyze with current context | Re-queue for ATHENA |
| `superseded` | Another ideation covers this | Transition to ARCHIVED |
| `deprioritized` | Not important right now | Transition to PARKED |
| `activate_now` | Do this immediately | Transition to ACTIVATED |

---

## Source Provenance

Every ideation tracks exactly how it entered the system:

| Source Type | Description | Ingestion Service |
|---|---|---|
| `flipboard_rss` | Auto-ingested from Flipboard RSS feeds | flipboard-sentinel |
| `manual` | Manually entered via Sentinel Command UI | sentinel-command |
| `chat` | Captured from Google Chat conversations | cortex-chat-bridge |
| `email` | Forwarded from email | email-ingestion (future) |
| `research` | From deep research sessions | deep-research agent |
| `agent_generated` | Spawned by another agent during execution | Any agent |
| `cross_reference` | Generated from cross-referencing existing ideations | flipboard-sentinel |

---

## API Contract (Sentinel Command + Future Services)

### Read Operations

```
GET  /api/ideations                    → List with filters (status, domain, source, relevance range)
GET  /api/ideations/:id                → Full ideation entity
GET  /api/ideations/:id/timeline       → Lifecycle transition history
GET  /api/ideations/stats              → Aggregated registry stats
GET  /api/ideations/review/upcoming    → Ideations due for review
GET  /api/ideations/search?q=          → Full-text search across titles + directives
```

### Write Operations

```
POST   /api/ideations                  → Create new ideation (manual entry)
PATCH  /api/ideations/:id/status       → Transition status (with reason)
PATCH  /api/ideations/:id/review       → Submit review verdict
PATCH  /api/ideations/:id/classify     → Update classification (tags, domain, urgency)
PATCH  /api/ideations/:id/assign       → Assign owner
POST   /api/ideations/:id/deliverables → Attach a deliverable artifact
POST   /api/ideations/:id/notes        → Add annotation
DELETE /api/ideations/:id              → Soft-delete (transitions to DISCARDED)
```

### Batch Operations

```
POST /api/ideations/rebuild-registry   → Regenerate registry from individual files
POST /api/ideations/review/generate    → Generate monthly review digest
POST /api/ideations/migrate            → Run V1→V2 migration on existing files
```

---

## Migration Plan (V1 → V2)

The existing 105 ideation files use the V1 flat schema. Migration is deterministic:

| V1 Field | V2 Location |
|---|---|
| `jobId` | `id` |
| `slug` | `slug` |
| `status` (PENDING) | `status` = BRAINSTORM |
| `status` (IDEATED) | `status` = IDEATED |
| `sourceArticle.guid` | `source.guid` |
| `sourceArticle.title` | `source.title` |
| `sourceArticle.url` | `source.url` |
| `sourceArticle.author` | `source.author` |
| `sourceArticle.pubDate` | `source.publishedAt` |
| `sourceArticle.imageUrl` | `source.imageUrl` |
| `sourceArticle.categories` | `classification.categories` |
| `categories` | `classification.categories` (merge) |
| `cleRelevance` | `classification.cleRelevance` |
| `athenaOutput` | `athena` |
| `relatedJobs` | `relations.crossRefs` (as similarity entries) |
| `obsidianPath` | `deliverables.obsidianPath` |
| `comments` | `lifecycle.notes` |
| `createdAt` | `timestamps.createdAt` |
| `ideatedAt` | `timestamps.ideatedAt` |
| `activatedAt` | `timestamps.activatedAt` |
| `completedAt` | `timestamps.completedAt` |
| `digestBatchId` | `notifications.digestBatchId` |
| — (new) | `version` = 2 |
| — (new) | `lifecycle.transitions` = reconstructed from timestamps |
| — (new) | `source.type` = "flipboard_rss" |
| — (new) | `source.ingestedAt` = `createdAt` |
| — (new) | `notifications.emailSentAt` = `ideatedAt` (inferred) |
| — (new) | `review.reviewCadence` = "monthly" |
| — (new) | `timestamps.nextReviewDue` = createdAt + 30 days |

### Registry Rebuild (Sharded)

```bash
ssh -p 2000 jaharoni@127.0.0.1 "cd /app/creative-liberation-engine && python3 scripts/rebuild-ideation-index.py --dedup --validate"
```

- Scans `runtime/ideation-queue/` for all `IE-IDX-*.json` files
- Deduplicates using GUIDs and URLs (moves duplicates to `runtime/ideation-queue/duplicates/`)
- Partitions the remaining unique entries by month of creation (`createdAt`)
- Shunts any entries with `ARCHIVED` or `DISCARDED` status to a special `archived.json` shard
- Generates a master `_index.json` containing aggregate metrics and dedup seen lists

---

## Integration Points

### Flipboard Sentinel (Ingestion)
- Creates ideations at INGESTED → BRAINSTORM → IDEATED
- Tracks email delivery in `notifications.emailSentAt`
- Records all status transitions in `lifecycle.transitions`

### Sentinel Command (UI)
- Displays ideations with full lifecycle state
- Provides review workflow (verdict submission)
- Shows analytics dashboards from registry stats
- Enables manual ideation creation

### Monthly Review Cron
- Runs on 1st of month via NAS cron
- Surfaces overdue reviews, stale activations
- Generates email digest with source analytics
- Updates `reviewSchedule` in registry

### Future: CORTEX Chat Bridge
- Forwards chat-captured ideas as `source.type = "chat"`
- Same lifecycle from that point forward

---

## Constitutional Alignment

| Principle | How This System Serves It |
|---|---|
| **Article IX (No MVPs)** | Complete lifecycle from ingestion to completion — not just "save and forget" |
| **Article XX (No wait time)** | Automated ingestion, analysis, email, review surfacing |
| **Sovereignty** | All data on NAS, no external dependencies |
| **Anti-scatter** | Single canonical home for all ideation data |
| **Heritage-aware** | V1 data migrates cleanly with full audit trail |

---

## Implementation Phases

### Phase 1: Schema + Migration ✅
- [x] `IDEATION_LIFECYCLE.schema.json` — Entity schema
- [x] `docs/IDEATION_LIFECYCLE.md` — This document
- [x] V1→V2 migration — 105 sentinel ideations migrated in-place
- [x] Heritage migration — 65 V1-V6 ideations consolidated
- [x] `runtime/registry/ideations.deprecated.json` — Old monolith archived

### Phase 2: Sentinel Integration (Partial)
- [ ] Update `job-registry.ts` to emit V2 entities natively on new ingestions
- [ ] Add `notifications.emailSentAt` tracking to email dispatcher
- [x] `lifecycle.transitions` audit trail on every status change (via Sentinel Command API)
- [x] Sharded registry index builder (`scripts/rebuild-ideation-index.py`)
- [x] Pre-ingestion deduplication guard (`scripts/ideation-dedup-guard.py`)
- [ ] server.js updated with sharded registry reader

### Phase 3: Sentinel Command UI ✅
- [x] Lifecycle state filter in sidebar (all 12 states)
- [x] Review workflow panel (6 verdict options)
- [x] Source analytics dashboard (status distribution, domain distribution, relevance tiers, source breakdown)
- [x] Command palette search (⌘K) with instant results
- [x] Lifecycle transition buttons
- [x] Toast notification system for action feedback
- [ ] Manual ideation creation form

### Phase 4: Review Automation
- [ ] Monthly review cron job (surface IDEATED entries >30d without review)
- [ ] Review digest email template
- [ ] Source feed performance analytics
- [ ] Stale detection and auto-surfacing

### Phase 5: Sharded Registry System ✅
- [x] Split monolithic registry index into monthly shards + `archived.json`
- [x] Dedup pipeline execution to quarantine duplicate files
- [x] Implement schema validation for index and monthly shards
- [x] Deprecate old monolithic index system-wide
