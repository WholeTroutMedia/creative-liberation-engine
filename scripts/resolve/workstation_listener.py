#!/usr/bin/env python3
"""
DaVinci Resolve Workstation Ingestion Listener (SSE Client Mode)
Connects outbound to the CLE Dispatch Server SSE stream on the NAS.
Listens for RESOLVE_INGEST tasks, claims them, translates paths, and builds Resolve projects.
Requires no local open ports or firewall modifications.
"""

import os
import sys
import json
import time
import logging
import urllib.request
import urllib.parse
from pathlib import Path

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("WorkstationListener")

# Add parent directory to sys.path to import resolve_project_builder
scripts_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(scripts_dir))

try:
    from resolve_project_builder import build_resolve_project
except ImportError as e:
    logger.error(f"Failed to import resolve_project_builder: {e}")
    sys.exit(1)

DISPATCH_URL = os.environ.get("DISPATCH_URL", "http://127.0.0.1:5160")
logger.info(f"Targeting Dispatch Server: {DISPATCH_URL}")

def translate_path(unix_path: str) -> str:
    r"""
    Translates NAS Unix paths to Windows UNC paths.
    E.g., /app/vault/Videos/... -> \\127.0.0.1\The Vault\Videos\...
    """
    cleaned = unix_path.replace("/", "\\")
    if cleaned.startswith("\\volume1\\The Vault"):
        translated = cleaned.replace("\\volume1\\The Vault", "\\\\127.0.0.1\\The Vault")
    else:
        # Fallback mapping if volume1 prefix is missing or different
        translated = cleaned
        
    logger.info(f"Translated path: '{unix_path}' -> '{translated}'")
    return translated

def update_task_status(task_id: str, status: str) -> bool:
    """
    Updates the status of a task on the dispatch server using PATCH.
    """
    url = f"{DISPATCH_URL}/api/tasks/{task_id}"
    payload = json.dumps({"status": status}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="PATCH"
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            return res_data.get("success", False)
    except Exception as e:
        logger.error(f"Failed to update task {task_id} status to '{status}': {e}")
        return False

def process_status_update(status_data: dict):
    """
    Scans queued tasks for resolve project tasks, claims them, and executes them.
    """
    queued_tasks = status_data.get("queued_tasks", [])
    for task in queued_tasks:
        task_id = task.get("id")
        title = task.get("title", "")
        
        if title.startswith("RESOLVE_INGEST — "):
            project_name = title.replace("RESOLVE_INGEST — ", "").strip()
            logger.info(f"Discovered queued Resolve task {task_id} for project '{project_name}'")
            
            # 1. Attempt to claim the task
            logger.info(f"Attempting to claim task {task_id}...")
            if not update_task_status(task_id, "active"):
                logger.warning(f"Could not claim task {task_id}. It may have been claimed by another agent.")
                continue
                
            logger.info(f"Task {task_id} successfully claimed. Processing...")
            
            # 2. Parse description JSON to extract ingest_path
            description_str = task.get("description", "")
            try:
                desc_data = json.loads(description_str)
                unix_path = desc_data.get("ingest_path")
            except Exception as e:
                logger.error(f"Failed to parse task description JSON: {e}")
                update_task_status(task_id, "failed")
                continue
                
            if not unix_path:
                logger.error(f"Missing 'ingest_path' in task description.")
                update_task_status(task_id, "failed")
                continue
                
            # 3. Translate path and build project
            win_path = translate_path(unix_path)
            try:
                build_resolve_project(win_path, project_name)
                logger.info(f"Resolve project builder finished successfully. Completing task...")
                update_task_status(task_id, "done")
                logger.info(f"✅ Successfully processed and completed task {task_id}")
            except SystemExit as se:
                exit_code = se.code if isinstance(se.code, int) else 0
                if exit_code == 0:
                    logger.info(f"Resolve project builder finished successfully (exit code 0). Completing task...")
                    update_task_status(task_id, "done")
                else:
                    logger.error(f"Resolve project builder exited with code {exit_code}. Marking task as failed.")
                    update_task_status(task_id, "failed")
            except Exception as e:
                logger.error(f"Failed to execute Resolve project builder: {e}. Marking task as failed.")
                update_task_status(task_id, "failed")

def listen_to_events():
    """
    Connects to the CLE Dispatch Server SSE stream and listens for status updates.
    """
    url = f"{DISPATCH_URL}/api/events"
    logger.info(f"Connecting to SSE stream: {url}")
    
    req = urllib.request.Request(url)
    
    # We keep the connection open indefinitely
    with urllib.request.urlopen(req, timeout=None) as response:
        logger.info("Connected to CLE Dispatch SSE stream.")
        event_type = None
        
        for line_bytes in response:
            line = line_bytes.decode("utf-8").strip()
            if not line:
                continue
            
            if line.startswith("event:"):
                event_type = line[6:].strip()
            elif line.startswith("data:"):
                data_str = line[5:].strip()
                if event_type == "status":
                    try:
                        status_data = json.loads(data_str)
                        process_status_update(status_data)
                    except Exception as e:
                        logger.error(f"Error handling status event: {e}")
                # Reset event type
                event_type = None

def main():
    # Force UTF-8 encoding for stdout/stderr to prevent Windows console encoding issues
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

    logger.info("Starting DaVinci Resolve Workstation Ingestion Listener (SSE Client Mode)...")
    
    # Run loop to automatically handle stream drops and reconnects
    while True:
        try:
            listen_to_events()
        except KeyboardInterrupt:
            logger.info("Keyboard interrupt received. Shutting down listener...")
            break
        except Exception as e:
            logger.error(f"Connection lost: {e}. Retrying in 5 seconds...")
            time.sleep(5)

if __name__ == "__main__":
    main()
