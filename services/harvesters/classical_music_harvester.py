import os
import sys
import json
import time
import requests
import zipfile
from pathlib import Path
import subprocess

"""
CORTEX Classical Music Harvester (Sovereign Symphony)
======================================================
Ingests public domain classical music datasets (MAESTRO, etc.)
for taint-free AI music generation training.
"""

# Configuration
if os.name == 'nt':
    NAS_DATA_ROOT = os.environ.get('RAG_DATA_DIR', r'\\127.0.0.1\docker\genesis-deploy\rag_data')
else:
    NAS_DATA_ROOT = os.environ.get('RAG_DATA_DIR', '/app/genesis-deploy/rag_data')
    
MUSIC_DATA_DIR = os.path.join(NAS_DATA_ROOT, 'music', 'classical')
MAESTRO_MIDI_URL = "https://storage.googleapis.com/magentadata/datasets/maestro/v3.0.0/maestro-v3.0.0-midi.zip"
# MAESTRO_AUDIO_URL = "https://storage.googleapis.com/magentadata/datasets/maestro/v3.0.0/maestro-v3.0.0.zip" # 130GB!

def ensure_dirs():
    """Ensure output directories exist."""
    os.makedirs(MUSIC_DATA_DIR, exist_ok=True)
    os.makedirs(os.path.join(MUSIC_DATA_DIR, 'midi'), exist_ok=True)
    os.makedirs(os.path.join(MUSIC_DATA_DIR, 'audio'), exist_ok=True)
    print(f"[CORTEX] Initialized classical music directories at {MUSIC_DATA_DIR}")

def download_file(url, dest_path):
    """Download a file with a progress indicator."""
    if os.path.exists(dest_path):
        print(f"[CORTEX] File already exists: {dest_path}")
        return True
        
    print(f"[CORTEX] Downloading {url} -> {dest_path}")
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        total_size = int(response.headers.get('content-length', 0))
        
        with open(dest_path, 'wb') as f:
            downloaded = 0
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    # Print progress every 10MB
                    if downloaded % (10 * 1024 * 1024) < 8192 and total_size > 0:
                        print(f"  ... {downloaded / (1024*1024):.1f} MB / {total_size / (1024*1024):.1f} MB ({(downloaded/total_size)*100:.1f}%)")
        print(f"[CORTEX] Download complete: {dest_path}")
        return True
    except Exception as e:
        print(f"[CORTEX] ❌ Download failed: {e}")
        if os.path.exists(dest_path):
            os.remove(dest_path)
        return False

def extract_zip(zip_path, extract_to):
    """Extract a zip file to a directory."""
    print(f"[CORTEX] Extracting {zip_path} to {extract_to}")
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_to)
        print(f"[CORTEX] Extraction complete.")
        return True
    except Exception as e:
        print(f"[CORTEX] ❌ Extraction failed: {e}")
        return False

def harvest_maestro_midi():
    """Harvest the MAESTRO MIDI dataset (PoC size)."""
    print("==================================================")
    print("[CORTEX] Harvesting MAESTRO Dataset (MIDI subset)")
    print("==================================================")
    
    zip_dest = os.path.join(MUSIC_DATA_DIR, 'maestro-v3.0.0-midi.zip')
    extract_dest = os.path.join(MUSIC_DATA_DIR, 'midi', 'maestro_v3')
    
    if download_file(MAESTRO_MIDI_URL, zip_dest):
        if not os.path.exists(extract_dest):
            os.makedirs(extract_dest, exist_ok=True)
            extract_zip(zip_dest, extract_dest)
        else:
            print(f"[CORTEX] Dataset already extracted at {extract_dest}")
            
    # Count files
    midi_files = list(Path(extract_dest).rglob("*.midi")) + list(Path(extract_dest).rglob("*.mid"))
    print(f"[CORTEX] Harvested {len(midi_files)} MIDI files from MAESTRO.")
    
    # Save a metadata summary
    metadata = {
        "dataset": "MAESTRO v3.0.0 (MIDI)",
        "source": MAESTRO_MIDI_URL,
        "file_count": len(midi_files),
        "harvest_time": time.time(),
        "status": "READY"
    }
    
    with open(os.path.join(MUSIC_DATA_DIR, 'maestro_midi_metadata.json'), 'w') as f:
        json.dump(metadata, f, indent=2)
        
    print("[CORTEX] MAESTRO MIDI harvest complete.")

MAESTRO_AUDIO_URL = "https://storage.googleapis.com/magentadata/datasets/maestro/v3.0.0/maestro-v3.0.0.zip"

def harvest_maestro_audio():
    """Harvest the full MAESTRO Audio dataset (130GB)."""
    print("==================================================")
    print("[CORTEX] Harvesting MAESTRO Dataset (Full Audio)")
    print("==================================================")
    
    zip_dest = os.path.join(MUSIC_DATA_DIR, 'maestro-v3.0.0-audio.zip')
    extract_dest = os.path.join(MUSIC_DATA_DIR, 'audio', 'maestro_v3')
    
    if download_file(MAESTRO_AUDIO_URL, zip_dest):
        if not os.path.exists(extract_dest):
            os.makedirs(extract_dest, exist_ok=True)
            extract_zip(zip_dest, extract_dest)
        else:
            print(f"[CORTEX] Audio Dataset already extracted at {extract_dest}")
            
    # Count files
    audio_files = list(Path(extract_dest).rglob("*.wav"))
    print(f"[CORTEX] Harvested {len(audio_files)} Audio files from MAESTRO.")
    
    metadata = {
        "dataset": "MAESTRO v3.0.0 (Audio)",
        "source": MAESTRO_AUDIO_URL,
        "file_count": len(audio_files),
        "harvest_time": time.time(),
        "status": "READY"
    }
    
    with open(os.path.join(MUSIC_DATA_DIR, 'maestro_audio_metadata.json'), 'w') as f:
        json.dump(metadata, f, indent=2)
        
    print("[CORTEX] MAESTRO Audio harvest complete.")

def main():
    print("=" * 50)
    print("  CORTEX CLASSICAL MUSIC HARVESTER")
    print(f"  Target: {MUSIC_DATA_DIR}")
    print("=" * 50 + "\\n")
    
    ensure_dirs()
    
    if len(sys.argv) > 1 and sys.argv[1] == '--audio':
        harvest_maestro_audio()
    else:
        harvest_maestro_midi()
    
if __name__ == "__main__":
    main()
