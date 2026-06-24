#!/usr/bin/env bash
set -euo pipefail
VENUES_ROOT="${1:-/app/vault/Creative Liberation Engine/Venues}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INGEST_SCRIPT="${SCRIPT_DIR}/ingest.py"
LOG_DIR="${VENUES_ROOT}/_pipeline/logs"
DEBOUNCE_SEC="${WATCH_DEBOUNCE:-5}"
mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/watch-$(date +%Y%m%d).log"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"; }
command -v inotifywait &>/dev/null || { log "ERROR: inotifywait not found"; exit 1; }
command -v python3 &>/dev/null || { log "ERROR: python3 not found"; exit 1; }
log "=== Venue Watch Daemon Started ==="
log "Watching: ${VENUES_ROOT} | Debounce: ${DEBOUNCE_SEC}s"
LAST_TRIGGER=0
inotifywait -m -r \
    --exclude '(_pipeline|_registry|_processed|\.DS_Store)' \
    -e create -e moved_to -e close_write \
    --format '%T %w%f %e' --timefmt '%Y-%m-%d %H:%M:%S' \
    "${VENUES_ROOT}" 2>>"${LOG_FILE}" | while read -r TS FP EV; do
  [[ "${FP}" == *"/_pipeline/"* || "${FP}" == *"/_registry/"* || "${FP}" == *"/_processed/"* ]] && continue
  BN="$(basename "${FP}")"; [[ "${BN}" == .* || "${BN}" == *.tmp ]] && continue
  NOW=$(date +%s); ELAPSED=$((NOW - LAST_TRIGGER))
  if [ "${ELAPSED}" -ge "${DEBOUNCE_SEC}" ]; then
    log "DETECTED: ${EV} -> ${FP} — triggering ingest"
    ( python3 "${INGEST_SCRIPT}" --venues-root "${VENUES_ROOT}" 2>&1 | tee -a "${LOG_FILE}" ) &
    LAST_TRIGGER="${NOW}"
  fi
done
