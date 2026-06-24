#!/usr/bin/env python3
"""
Alpon X5 Edge Node High-Resolution Video Sync
Scans processed high-res video files on the edge node and replicates them to the NAS RAW vault
over high-speed LAN when connected.
"""

import os
import sys
import socket
import time
import subprocess
from pathlib import Path
from datetime import datetime

# Configuration
PROCESSED_DIR = "/opt/camera-ingest/dropzone/processed"
NAS_HOST = "127.0.0.1"
NAS_SSH_PORT = 2000
NAS_USER = "jaharoni"
NAS_SSH_KEY = "/home/alpon/.ssh/id_ed25519"
NAS_VIDEOS_VAULT = "/app/vault/Videos"

def is_on_local_lan(host, port, timeout_ms=30):
    """
    Checks if we are on the local LAN by checking TCP connection latency to the NAS SSH port.
    If connection takes longer than timeout_ms, we assume we are not on high-speed LAN.
    """
    start = time.perf_counter()
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout_ms / 1000.0)
        sock.connect((host, port))
        sock.close()
        latency_ms = (time.perf_counter() - start) * 1000.0
        print(f"Connected to NAS SSH. Latency: {latency_ms:.2f}ms")
        return latency_ms < timeout_ms
    except Exception as e:
        print(f"Connection check failed: {e}")
        return False

def sync_high_res_files():
    processed_path = Path(PROCESSED_DIR)
    if not processed_path.exists():
        print(f"Processed directory does not exist: {processed_path}")
        return

    # Look for video files
    video_extensions = {".mp4", ".mov", ".mxf"}
    video_files = []
    for file_path in processed_path.glob("*"):
        if file_path.suffix.lower() in video_extensions:
            # Skip proxy files
            if file_path.stem.endswith("_proxy"):
                continue
            video_files.append(file_path)

    if not video_files:
        print("No high-res video files found to sync.")
        return

    print(f"Found {len(video_files)} high-res video files to process.")

    for file_path in video_files:
        # Get modification time to organize by date
        stat_info = file_path.stat()
        mtime = datetime.fromtimestamp(stat_info.st_mtime)
        year = str(mtime.year)
        yyyymmdd = mtime.strftime("%Y%m%d")
        
        # Build target path
        dest_dir = f"{NAS_VIDEOS_VAULT}/{year}/{yyyymmdd}_Ingest/RAW"
        print(f"\nProcessing sync for: {file_path.name}")
        print(f"Target NAS Directory: {dest_dir}")

        # 1. Pre-create the directory on the NAS
        mkdir_cmd = [
            "ssh",
            "-p", str(NAS_SSH_PORT),
            "-i", NAS_SSH_KEY,
            "-o", "StrictHostKeyChecking=no",
            f"{NAS_USER}@{NAS_HOST}",
            f"mkdir -p '{dest_dir}'"
        ]
        
        print(f"Creating directory on NAS...")
        try:
            subprocess.run(mkdir_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to create remote directory: {e.stderr.decode().strip()}")
            continue

        # 2. Run rsync to sync the high-res file
        rsync_cmd = [
            "rsync",
            "-av",
            "--ignore-existing",
            "--progress",
            "-e", f"ssh -p {NAS_SSH_PORT} -i {NAS_SSH_KEY} -o StrictHostKeyChecking=no",
            str(file_path),
            f"{NAS_USER}@{NAS_HOST}:{dest_dir}/"
        ]

        print(f"Syncing file via rsync...")
        try:
            subprocess.run(rsync_cmd, check=True)
            print(f"✅ Sync complete for: {file_path.name}")
        except subprocess.CalledProcessError as e:
            print(f"❌ Rsync failed for {file_path.name}")

if __name__ == "__main__":
    print("=== Alpon X5 High-Resolution Video LAN Sync ===")
    
    # Verify we are on the local LAN to prevent huge cell-data bills
    if not is_on_local_lan(NAS_HOST, NAS_SSH_PORT, timeout_ms=30):
        print("❌ Latency too high or NAS unreachable. Assumed OFFLINE/WAN/LTE. Sync aborted.")
        sys.exit(0)
        
    print("✅ Verified local high-speed LAN connection.")
    sync_high_res_files()
