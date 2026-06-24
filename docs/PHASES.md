# V6 Phases (Execution Contract)

This file defines the strict, non-MVP execution phases for Creative Liberation Engine V6. This document acts as a rigid execution contract: **each phase must be fully satisfied, validated, and verifiable before the next is considered active.**

## Phase 0 — Root & Contracts (DONE)

- [x] The current operational directory is established as the absolute root for V6 (no nested version containers).
- [x] Root topology is fully scaffolded in the current directory: `docs/`, `schemas/`, `inventory/`, `wiki/`, `packages/`, `apps/`, `services/`, `runtime/`, `tests/`, `tools/`.
- [x] System contract is authored at `docs/SYSTEM_CONTRACT.md`, establishing core V6 boundaries and invariants.
- [x] Canonical schema stubs are established for: heritage, route, and memory.
- [x] Heritage inventory lane and salvage backlog lane are initialized.
- [x] Wiki projection lane is established with architecture documentation, sync rules, and a baseline note template.

## Phase 1 — Canon Schema Hardening (DONE)

- [x] `schemas/README.md` exhaustively documents the purpose, scope, and usage of each schema.
- [x] All schemas strictly pass validation against the standard JSON Schema meta-specification.
- [x] `inventory/CAPABILITY_MATRIX.seed.json` is confirmed to strictly conform to `HERITAGE_CAPABILITY.schema.json`.
- [x] `schemas/ROUTE_MANIFEST.schema.json` is fully defined to govern a complete manifest structure (an array of route contracts).
- [x] `schemas/MEMORY_INDEX.schema.json` is fully defined to govern memory index collections.

## Phase 2 — Heritage Census (DONE)

- [x] `inventory/HERITAGE_BASELINE.md` exhaustively catalogs all major legacy capability categories and dictates the V6 collection strategy.
- [x] `inventory/CAPABILITY_MATRIX.json` (live state) is generated and established as the active canonical matrix (the seed file is demoted to reference-only).
- [x] Every entry in the canonical matrix strictly validates against `HERITAGE_CAPABILITY.schema.json`.
- [x] `inventory/SALVAGE_BACKLOG.md` is populated, enforcing strict references to specific capability IDs mapped from the matrix (zero orphaned or free-text capability definitions allowed).

## Phase 3 — Memory & Wiki Spine (DONE)

- [x] `docs/MEMORY_SPINE.md` explicitly defines memory providers, persistence layers, data boundaries, and operational flows exclusively for V6.
- [x] `wiki/` documentation, sync rules, and templates structurally align with and validate against `schemas/MEMORY_CONTRACT.schema.json`.
- [x] Demonstrable example memory records prove a successful, lossless round-trip synchronization between structured JSON memory records and Markdown wiki notes.

## Phase 4 — Route & Service Contract Layer (DONE)

- [x] `schemas/ROUTE_MANIFEST.schema.json` actively governs and validates at least one operational manifest file under `runtime/routes/`.
- [x] `runtime/routes/ROUTE_MANIFEST.example.json` is provided as a structurally sound, working example of a service topology.
- [x] `docs/ROUTING_CONTRACT.md` dictates the exact mapping mechanisms between route manifests, API gateways, and underlying backend services.

## Phase 5 — Filesystem & Governance (DONE)

- [x] `docs/FILESYSTEM_POLICY.md` establishes definitive boundaries (allowed/forbidden locations) for source code, generated assets, temporal state, archives, and migrations.
- [x] An automated linting or structural checking script exists to actively enforce the rules defined in `FILESYSTEM_POLICY.md`.
- [x] `docs/GOVERNANCE_PRECEDENCE.md` explicitly resolves governance conflicts and asserts absolute V6 precedence over legacy versions (V1–V5).

## Phase 6 — Migration Readiness (DONE)

- [x] `docs/MIGRATION_PLAN.md` articulates the exact pipeline for transitioning V1–V5 capabilities into V6 via the heritage matrix.
- [x] `docs/MIGRATION_READINESS.md` establishes hard, binary Go/No-Go acceptance criteria required to authorize the initiation of legacy code migration.
- [x] `tests/` contains automated contract-validation tests for all schema types (heritage, route, memory, manifest) to guarantee corrupt data cannot enter V6.

## Phase 7 — Runtime Foundation (DONE)

- [x] `packages/`, `apps/`, and `services/` contain the initialized UIs and backend interfaces for the core runtime surfaces dictated by the system contract.
- [x] `runtime/` provides valid composition manifests (e.g., Docker Compose, runner scripts) to enable full standalone local workstation operation.
- [x] `tests/` includes automated end-to-end (E2E) validation suites confirming expected core routing resolution and memory state operations.

## Phase 8 — Automation & CI/CD (DONE)

- [x] A continuous integration (CI) pipeline is established to guarantee automated schema validation runs on every change.
- [x] Contract-validation and E2E test suites (from Phases 6 & 7) execute reliably in the automated CI environment.
- [x] Filesystem policy enforcement scripts (from Phase 5) are integrated into the pipeline to prevent structural regressions over time.

## Phase 9 — Post-Migration Sovereignty & Operational Health (DONE)

- [x] All obsolete migration, sunset, and baseline spreadsheets are moved to the `archive/migration/` directory.
- [x] Active path registries (`nas-path-registry.json` and `NAS_PATH_REGISTRY.md`) contain zero references to decommissioned `genesis-deploy` volumes.
- [x] Active boot configurations (`AGENTS.md`) point exclusively to the V6 root `\\127.0.0.1\docker\creative-liberation-engine`.
- [x] Stale Docker networks and port mappings are corrected: all UIs and watchers connect to the host-exposed dispatch broker via `127.0.0.1:5160`.
