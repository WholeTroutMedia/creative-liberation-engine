#!/usr/bin/env python3
"""
Creative Liberation Engine V6: Sovereign Media Garbage Daemon

This script runs in the background to monitor the NAS staging directory.
It looks for raw media files (.mp4, .webm) and deletes them if a corresponding
.taste_ledger.json marker file is found, indicating that the Vision models (LeWM)
have finished their style extraction analysis.

This prevents the NAS from filling up with raw video data while keeping the 
extracted knowledge and RAG data intact.
"""

import os
import time
import argparse

NAS_STAGING = r"\\127.0.0.1\docker\genesis-deploy\media_intake\staging"

def format_bytes(size):
    # 2**10 = 1024
    power = 2**10
    n = 0
    power_labels = {0: 'Bytes', 1: 'KB', 2: 'MB', 3: 'GB', 4: 'TB'}
    while size > power:
        size /= power
        n += 1
    return f"{size:.2f} {power_labels[n]}"

def run_cleanup_cycle(dry_run=False):
    print(f"[*] Starting cleanup cycle at {time.strftime('%Y-%m-%d %H:%M:%S')}")
    if not os.path.exists(NAS_STAGING):
        print(f"[!] Staging directory does not exist: {NAS_STAGING}")
        return

    media_extensions = ('.mp4', '.webm', '.mkv')
    total_freed = 0
    files_deleted = 0

    for root, _, files in os.walk(NAS_STAGING):
        for file in files:
            if file.lower().endswith(media_extensions):
                media_path = os.path.join(root, file)
                
                # Check for the taste_ledger marker
                # e.g., if video is "tutorial.mp4", we check for "tutorial.mp4.taste_ledger.json" 
                # or "tutorial.taste_ledger.json". We'll check both.
                base_name, _ = os.path.splitext(file)
                marker1 = os.path.join(root, f"{file}.taste_ledger.json")
                marker2 = os.path.join(root, f"{base_name}.taste_ledger.json")

                if os.path.exists(marker1) or os.path.exists(marker2):
                    try:
                        file_size = os.path.getsize(media_path)
                        if dry_run:
                            print(f"[DRY-RUN] Would delete: {file} ({format_bytes(file_size)})")
                        else:
                            os.remove(media_path)
                            print(f"[+] Deleted: {file} ({format_bytes(file_size)})")
                        
                        total_freed += file_size
                        files_deleted += 1
                    except Exception as e:
                        print(f"[!] Failed to process {file}: {e}")

    print(f"[*] Cleanup cycle complete. Deleted {files_deleted} files. Space freed: {format_bytes(total_freed)}")

def daemon_loop(interval_minutes=15, dry_run=False):
    print("=====================================================")
    print(" V6 SOVEREIGN MEDIA MESH - GARBAGE COLLECTION DAEMON ")
    print("=====================================================")
    print(f"[*] Monitoring: {NAS_STAGING}")
    print(f"[*] Interval: {interval_minutes} minutes")
    print(f"[*] Mode: {'DRY RUN' if dry_run else 'ACTIVE'}")
    
    try:
        while True:
            run_cleanup_cycle(dry_run)
            if dry_run:
                # In dry run, we don't loop forever unless specified, but for safety
                # we'll just break out after one cycle.
                print("[*] Dry run complete. Exiting daemon.")
                break
            
            print(f"[*] Sleeping for {interval_minutes} minutes...")
            time.sleep(interval_minutes * 60)
    except KeyboardInterrupt:
        print("\n[*] Daemon stopped by user.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the media garbage collection daemon.")
    parser.add_argument("--dry-run", action="store_true", help="Simulate deletion without actually removing files.")
    parser.add_argument("--interval", type=int, default=15, help="Check interval in minutes (default: 15).")
    parser.add_argument("--run-once", action="store_true", help="Run one cycle and exit immediately.")
    args = parser.parse_args()

    if args.run_once:
        run_cleanup_cycle(args.dry_run)
    else:
        daemon_loop(interval_minutes=args.interval, dry_run=args.dry_run)
