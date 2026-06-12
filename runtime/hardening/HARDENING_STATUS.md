# Hardening Status

> **Honest assessment as of 2026-05-24T12:04:44-04:00.**
> Previous status falsely claimed all helices "hardened" with no evidence.
> Corrected to "declared" — controls exist in contract but lack validated test evidence.

## Status Legend

| Status | Meaning |
|---|---|
| `declared` | Controls defined in contracts/schemas but not yet tested or validated |
| `implementing` | Controls actively being built with partial test coverage |
| `validated` | Controls tested with passing evidence artifacts |
| `hardened` | Controls validated, regression-tested, and monitored in production |

## Current State: 6/6 Validated, 0/6 Hardened

| Helix | ID | Status | Controls (declared / validated) |
|---|---|---|---|
| Execution | `helix-a-execution` | `validated` | 5 / 5 |
| ModelOps | `helix-b-modelops` | `validated` | 5 / 5 |
| Memory | `helix-c-memory` | `validated` | 5 / 5 |
| Security | `helix-d-security` | `validated` | 5 / 5 |
| Release | `helix-e-release` | `validated` | 5 / 5 |
| Reliability | `helix-f-reliability` | `validated` | 5 / 5 |

## Control Details

### Helix A — Execution
- `dispatchContract` — validated (2026-05-27 via `node tests/e2e-validation.test.mjs`)
- `idempotency` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)
- `retryPolicy` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)
- `backpressure` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)
- `resumeRecovery` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)

### Helix B — ModelOps
- `modelRegistry` — validated (2026-05-27 via `node tests/contract-validation.test.mjs`)
- `tierRouting` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)
- `costTracking` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)
- `sovereignFallback` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)
- `healthMonitoring` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)

### Helix C — Memory
- `sessionPersistence` — validated (2026-05-27 via `node tests/e2e-validation.test.mjs`)
- `crossSessionKnowledge` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)
- `checkpointRecovery` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)
- `auditTrail` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)
- `tieredStorage` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)

### Helix D — Security
- `apiKeyAuth` — validated (2026-05-27 via `tests/integration/auth-md-hub.test.ts`)
- `mtlsGateway` — validated (2026-05-27 via `tests/mobile_mtls_validation.py`)
- `secretsVault` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)
- `rateLimiting` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)
- `inputValidation` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)

### Helix E — Release
- `contractValidation` — validated (2026-05-27 via `node tests/contract-validation.test.mjs`)
- `schemaEnforcement` — validated (2026-05-27 via `node tests/contract-validation.test.mjs`)
- `ciGate` — validated (2026-05-27 via `node tests/e2e-validation.test.mjs`)
- `rollbackPlan` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)
- `changeLog` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)

### Helix F — Reliability
- `circuitBreaker` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)
- `healthChecks` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)
- `gracefulShutdown` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)
- `retryWithBackoff` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)
- `deadLetterQueue` — validated (2026-05-27 via `node tests/integration-hardening.test.mjs`)

## Promotion Path

To promote a helix from `declared` → `validated`:
1. Implement the control in the relevant service
2. Write a test that exercises the control (unit, integration, or e2e)
3. Run the test and capture evidence (test output, timestamp, commit SHA)
4. Update the control's `validated` field to `true` and populate `lastTestedAt` and `testCommand`
5. Add an entry to the `evidence[]` array with the test artifact reference
6. Update this status file

To promote from `validated` → `hardened`:
1. All 5 controls in the helix must be `validated`
2. Regression test suite must pass on CI
3. Production monitoring must confirm control is active for ≥72 hours
4. Add validation history entry with promotion justification
