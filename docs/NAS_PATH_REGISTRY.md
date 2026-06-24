# NAS Path Registry (Creative Liberation Engine V6)

This registry defines canonical NAS roots to prevent path drift and cross-domain writes.

## Canonical Roots

- `vault_root`: `\\127.0.0.1\The Vault`
- `engine_root`: `\\127.0.0.1\The Vault\Creative Liberation Engine`
- `engine_telemetry_root`: `\\127.0.0.1\The Vault\Creative Liberation Engine\telemetry`
- `engine_telemetry_workstation`: `\\127.0.0.1\The Vault\Creative Liberation Engine\telemetry\workstation`
- `media_raw_archive_root`: `\\127.0.0.1\The Vault\RAW Backups`
- `media_ingest_live_root`: `\\127.0.0.1\The Vault\RAW Backups\2026\Barnstorm\live-ingest`
- `nas_docker_root_volume2`: `/app`
- `nas_v6_runtime_root`: `/volume2/cle-engine/v6`

## Usage Policy

- Write telemetry, daemon state, and runtime metrics only under `engine_telemetry_root`.
- Write media capture and ingest artifacts only under `media_raw_archive_root` and ingest descendants.
- Never write telemetry into `RAW Backups` paths.
- V6 runtime state lives only under `nas_v6_runtime_root`.

## Required Environment Variables

- `HOST_TELEMETRY_OUTPUT_DIR`
- `MEDIA_INGEST_OUTPUT_DIR`
- `MEDIA_INGEST_QUEUE_DIR`
- `V6_RUNTIME_ROOT`
