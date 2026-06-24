#!/usr/bin/env python3
"""
Creative Liberation Engine — Venue Drop Zone Watcher (Polling)
Watches the Venues directory for new file drops and triggers ingest.
Designed for NAS environments where inotifywait is unavailable.
"""
import os
import sys
import time
import subprocess
from datetime import datetime
from pathlib import Path

VENUES_ROOT = Path(os.environ.get("VENUES_ROOT", "/app/vault/Creative Liberation Engine/Venues"))
PIPELINE_DIR = VENUES_ROOT / "_pipeline"
INGEST_SCRIPT = PIPELINE_DIR / "ingest.py"
LOG_DIR = PIPELINE_DIR / "logs"
POLL_INTERVAL = int(os.environ.get("WATCH_POLL", "10"))
DEBOUNCE_SEC = int(os.environ.get("WATCH_DEBOUNCE", "15"))

LOG_DIR.mkdir(parents=True, exist_ok=True)
log_file = LOG_DIR / f"watch-{datetime.now().strftime('%Y%m%d')}.log"

def log(msg):
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{now}] {msg}"
    print(line, flush=True)
    with open(log_file, "a") as f:
        f.write(line + "\n")

def get_state(root: Path) -> dict:
    """Snapshot the current state of files (path -> mtime)."""
    state = {}
    if not root.exists():
        return state
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        # Skip pipeline and hidden files
        if any(x in p.parts for x in ("_pipeline", "_registry", "_processed", "@eaDir")):
            continue
        if p.name.startswith(".") or p.name.endswith(".tmp"):
            continue
        try:
            state[str(p)] = p.stat().st_mtime
        except FileNotFoundError:
            pass
    return state

def run_ingest():
    log("Triggering ingest pipeline...")
    cmd = [sys.executable, str(INGEST_SCRIPT), "--venues-root", str(VENUES_ROOT)]
    with open(log_file, "a") as f:
        subprocess.Popen(cmd, stdout=f, stderr=subprocess.STDOUT)

def main():
    log("=== Venue Watch Daemon (Python Polling) Started ===")
    log(f"Watching: {VENUES_ROOT}")
    log(f"Interval: {POLL_INTERVAL}s | Debounce: {DEBOUNCE_SEC}s")

    if not INGEST_SCRIPT.exists():
        log(f"ERROR: Ingest script not found at {INGEST_SCRIPT}")
        sys.exit(1)

    last_trigger = 0
    pending_trigger = False
    
    # Initial state
    state = get_state(VENUES_ROOT)
    
    while True:
        time.sleep(POLL_INTERVAL)
        try:
            new_state = get_state(VENUES_ROOT)
        except Exception as e:
            log(f"Error reading state: {e}")
            continue

        changed = False
        for p, mtime in new_state.items():
            if p not in state or state[p] != mtime:
                log(f"DETECTED CHANGE: {p}")
                changed = True
                break
                
        if not changed:
            # Check for deleted files
            if len(new_state) < len(state):
                log("DETECTED: File(s) deleted")
                changed = True
                
        state = new_state

        now = time.time()
        if changed:
            pending_trigger = True
            
        if pending_trigger and (now - last_trigger) >= DEBOUNCE_SEC:
            run_ingest()
            last_trigger = now
            pending_trigger = False

if __name__ == "__main__":
    main()
