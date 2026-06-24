# V6 Inventory

The inventory lane captures legacy capabilities and their status relative to V6.

## Files

- `CAPABILITY_MATRIX.seed.json` — initial seed examples for the heritage capability matrix.
- `HERITAGE_BASELINE.md` — narrative overview of heritage coverage and collection strategy.
- `SALVAGE_BACKLOG.md` — high-level salvage backlog grouped by PROMOTE / MERGE / PARK / RETIRE.

## Rules

- Future canonical matrix file: `CAPABILITY_MATRIX.json` must validate against `schemas/HERITAGE_CAPABILITY.schema.json`.
- Backlog entries should reference `capabilityId` values from the matrix.

