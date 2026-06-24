# Creative Liberation Engine — BLOCKERS

> Any agent that cannot proceed due to a terminal/password/sudo requirement writes here.
> Any IDE window picks this up on boot or heartbeat and resolves it.

<!-- Format: one row per blocker. Mark status as OPEN | CLAIMED | RESOLVED -->

| ID | Severity | Type | Agent | Task | Description | Claimed By | Status |
|----|----------|------|-------|------|-------------|------------|--------|

<!-- SEVERITY: P0 = blocking-deploy | P1 = terminal/sudo | P2 = human-input -->
<!-- TYPE: terminal | password | sudo | human | blocking-deploy -->
<!-- Add rows below this line — IDE agents will scan this file on every heartbeat -->
| BLK-20260317-001 | P0 | blocking-deploy | ANTIGRAVITY | NAS-Runner-Restore | NAS forgejo-runner container is unregistered/offline. 0 runners in API. Needs manual NAS SSH restart of infra/forgejo-runner with fresh token. | ANTIGRAVITY | RESOLVED |

| BLK-20260318-001 | P0 | password | CREATIVE-LIBERATION-ENGINE | zero-to-spec push | SSH bypassed via forgejo HTTP remote | - | RESOLVED |

| BLK-20260319-001 | P1 | blocking-deploy | ANTIGRAVITY | morning-sync | Dispatch server offline on :5050 (both localhost and 127.0.0.1). Root cause: forge + sovereign-home-mesh Dockerfiles used npm instead of pnpm — workspace:* EUNSUPPORTEDPROTOCOL blocked every deploy-genesis run. | CLAUDE-CURSOR | RESOLVED |
| BLK-20260319-002 | P2 | human | CLAUDE-CURSOR | dispatch-offline | Dispatch server :5050 confirmed unreachable from IDE — resolved by docker pnpm fix + deploy-genesis run #590 success. | CLAUDE-CURSOR | RESOLVED |
|| BLK-20260320-001 | P1 | human | ANTIGRAVITY | nas-docker-dsm | NAS Docker service needs DSM Container Manager restart � dispatch :5050 and genesis stack offline. `wireDispatchWebhooks` EventEmitter wiring is blocked until NAS is back. Requires manual DSM UI or SSH restart. | - | OPEN |
