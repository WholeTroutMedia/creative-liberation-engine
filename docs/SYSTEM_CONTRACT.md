# V6 System Contract

## Purpose

This document defines the non-negotiable structural rules for Creative Liberation Engine V6.

## Core Rules

1. `creative-liberation-engine` is a sovereign build root, not a subfolder of prior versions.
2. V5 is reference-only during V6 preparation.
3. Every durable capability must map to an explicit contract, inventory record, or runtime surface.
4. No new route, memory object, or workflow becomes canonical without schema alignment.
5. Wiki, graph, and note systems are projections over canonical memory, not parallel truths.
6. Filesystem layout must distinguish active, generated, archival, and migration-only material.

## Contract Surfaces

- Heritage inventory: `schemas/HERITAGE_CAPABILITY.schema.json`
- Routing contract: `schemas/ROUTE_CONTRACT.schema.json`
- Memory contract: `schemas/MEMORY_CONTRACT.schema.json`

## Phase Gate

No implementation phase begins until:

- root layout exists
- schemas exist
- inventory lane exists
- wiki projection lane exists

Phase 0 is complete when those conditions are true.
