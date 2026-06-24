# eval-regression

## Purpose

Run regression evaluations against previously passing trajectories after any routing, skill, or model change.

## Steps

1. Select frozen baseline traces and expected outcomes.
2. Execute current system against identical trajectory set.
3. Compare correctness, latency, and cost deltas.
4. Fail if quality regresses beyond tolerated thresholds.
5. Persist report into memory and migration records.
