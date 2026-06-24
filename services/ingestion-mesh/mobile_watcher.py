#!/usr/bin/env python3
import os
import sys
import time
import sqlite3
import shutil
import json
from datetime import datetime

# Absolute path resolutions for Synology NAS and workstation
BASE_DIR = "/app/creative-liberation-engine" if os.path.exists("/app/creative-liberation-engine") else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MOBILE_INTAKE_DIR = os.path.join(BASE_DIR, "runtime", "session", "media_intake", "mobile")
OBSIDIAN_VAULT_DIR = os.path.join(BASE_DIR, "wiki", "obsidian")
DATABASE_PATH = os.path.join(BASE_DIR, "runtime", "session", "mobile_ingest_ledger.sqlite")

def setup_environment():
    """Ensure directories and sqlite tracking database exist."""
    os.makedirs(MOBILE_INTAKE_DIR, exist_ok=True)
    os.makedirs(OBSIDIAN_VAULT_DIR, exist_ok=True)
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS mobile_ingest_ledger (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT UNIQUE,
            file_type TEXT,
            size_bytes INTEGER,
            received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            obsidian_note_path TEXT,
            processed INTEGER DEFAULT 0
        )
    """)
    conn.commit()
    conn.close()
    print(f"[*] Environment configured. Monitoring intake at: {MOBILE_INTAKE_DIR}")
    print(f"[*] LEDGER DB: {DATABASE_PATH}")

def process_image(filepath, filename):
    """Processes image uploads, moves to obsidian asset folder and generates note."""
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    note_name = f"sensory-image-{datetime.now().strftime('%Y%m%d-%H%M%S')}.md"
    note_path = os.path.join(OBSIDIAN_VAULT_DIR, note_name)
    
    # Destination inside Obsidian assets or vault root
    dest_img_path = os.path.join(OBSIDIAN_VAULT_DIR, filename)
    shutil.copy2(filepath, dest_img_path)
    
    note_content = f"""---
type: sensory_capture
captured_at: {timestamp_str}
source: iphone15-promax
file_type: image
tags:
  - sensory
  - mobile-mesh
  - intake
---

# Sensory Image Capture: {filename}

Captured on **{timestamp_str}** via sovereign mobile gateway node.

![[{filename}]]

## Analysis Diagnostics
- **Filename:** {filename}
- **Local Storage Path:** `{dest_img_path}`
- **Ingestion Status:** Completed (Sovereign Ingestion Mesh)
"""
    with open(note_path, "w") as f:
        f.write(note_content)
        
    print(f"[+] Image processed. Created Obsidian note: {note_path}")
    return note_path

def process_audio(filepath, filename):
    """Processes audio voice memos, logs metadata and generates note."""
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    note_name = f"sensory-voice-{datetime.now().strftime('%Y%m%d-%H%M%S')}.md"
    note_path = os.path.join(OBSIDIAN_VAULT_DIR, note_name)
    
    dest_audio_path = os.path.join(OBSIDIAN_VAULT_DIR, filename)
    shutil.copy2(filepath, dest_audio_path)
    
    note_content = f"""---
type: sensory_capture
captured_at: {timestamp_str}
source: iphone15-promax
file_type: audio
tags:
  - sensory
  - voice-memo
  - mobile-mesh
---

# Voice Sensory Memo: {filename}

Captured on **{timestamp_str}** via sovereign mobile voice node.

![[{filename}]]

## Meta Properties
- **Audio File:** `{filename}`
- **Ingested Path:** `{dest_audio_path}`
- **Pending Transcription:** Yes (Ready for Scribe Daemon / Whisper-NIM)
"""
    with open(note_path, "w") as f:
        f.write(note_content)
        
    print(f"[+] Audio voice note processed. Created Obsidian note: {note_path}")
    return note_path

def process_json_packet(filepath, filename):
    """Processes structured telemetry/log packets from mobile sensors."""
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    note_name = f"sensory-packet-{datetime.now().strftime('%Y%m%d-%H%M%S')}.md"
    note_path = os.path.join(OBSIDIAN_VAULT_DIR, note_name)
    
    try:
        with open(filepath, "r") as f:
            data = json.load(f)
    except Exception as e:
        data = {"raw_content_error": str(e)}

    formatted_json = json.dumps(data, indent=2)
    
    note_content = f"""---
type: sensory_capture
captured_at: {timestamp_str}
source: iphone15-promax
file_type: telemetry
tags:
  - sensory
  - telemetry-packet
  - mesh-data
---

# Telemetry Sensory Packet: {filename}

Captured on **{timestamp_str}** via mobile gateway node.

## Data Payload
```json
{formatted_json}
```

## System Properties
- **Packet Name:** {filename}
- **Ingestion Schema:** V6.Sovereign.Telemetry
"""
    with open(note_path, "w") as f:
        f.write(note_content)
        
    print(f"[+] JSON packet processed. Created Obsidian note: {note_path}")
    return note_path

def poll_and_ingest():
    """Main execution loop checking for new mobile media drops."""
    setup_environment()
    
    while True:
        try:
            files = [f for f in os.listdir(MOBILE_INTAKE_DIR) if os.path.isfile(os.path.join(MOBILE_INTAKE_DIR, f))]
            if not files:
                time.sleep(3)
                continue
                
            conn = sqlite3.connect(DATABASE_PATH)
            cursor = conn.cursor()
            
            for file in files:
                # Bypass hidden / temp files
                if file.startswith(".") or file.endswith(".tmp"):
                    continue
                    
                filepath = os.path.join(MOBILE_INTAKE_DIR, file)
                
                # Check ledger to avoid double processing
                cursor.execute("SELECT processed FROM mobile_ingest_ledger WHERE filename = ?", (file,))
                row = cursor.fetchone()
                if row and row[0] == 1:
                    continue
                    
                print(f"[*] Ingesting new mobile asset: {file}")
                ext = os.path.splitext(file)[1].lower()
                note_path = None
                
                size = os.path.getsize(filepath)
                
                if ext in ['.jpg', '.jpeg', '.png', '.heic']:
                    note_path = process_image(filepath, file)
                elif ext in ['.mp3', '.m4a', '.wav', '.caf']:
                    note_path = process_audio(filepath, file)
                elif ext in ['.json']:
                    note_path = process_json_packet(filepath, file)
                else:
                    print(f"[!] Unsupported file extension: {ext} for file {file}. Skipping.")
                    continue
                    
                # Mark as processed in SQLite ledger
                cursor.execute("""
                    INSERT OR REPLACE INTO mobile_ingest_ledger (filename, file_type, size_bytes, obsidian_note_path, processed)
                    VALUES (?, ?, ?, ?, 1)
                """, (file, ext[1:], size, note_path))
                conn.commit()
                
                # Safely delete processed source file in dropzone (or archive it if needed)
                try:
                    os.remove(filepath)
                except Exception as e:
                    print(f"[!] Warning: Could not delete dropzone file {file}: {e}")
                    
            conn.close()
        except KeyboardInterrupt:
            print("\n[-] Mobile watcher terminated by operator.")
            sys.exit(0)
        except Exception as e:
            print(f"[ERROR] Watcher encountered exception: {str(e)}", file=sys.stderr)
            time.sleep(5)

if __name__ == "__main__":
    poll_and_ingest()
