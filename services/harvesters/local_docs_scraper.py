#!/usr/bin/env python3
"""
Creative Liberation Engine V6: Local DaVinci Resolve Documentation Harvester

This script recursively copies the local DaVinci Resolve Developer documentation
directly to the NAS intake folder, avoiding V6 local root pollution.
"""

import os
import shutil
import sys

# NAS Intake Target
NAS_ROOT = r"\\127.0.0.1\docker\genesis-deploy"
TARGET_DIR = os.path.join(NAS_ROOT, "media_intake", "Resolve_RAG_Data", "Local_Docs")

# Source Local Directory
SOURCE_DIR = r"C:\ProgramData\Blackmagic Design\DaVinci Resolve\Support\Developer"

def harvest_local_docs():
    print("=====================================================")
    print(" V6 SOVEREIGN MEDIA MESH - LOCAL DOCS HARVESTER      ")
    print("=====================================================")
    
    if not os.path.exists(SOURCE_DIR):
        print(f"[!] Source directory not found: {SOURCE_DIR}")
        print("    Ensure DaVinci Resolve is installed on this machine.")
        sys.exit(1)
        
    print(f"[*] Found local Developer docs at: {SOURCE_DIR}")
    print(f"[*] Target NAS staging area: {TARGET_DIR}")
    
    # Ensure target directory exists
    os.makedirs(TARGET_DIR, exist_ok=True)
    
    # Copy directory tree
    try:
        # We use dirs_exist_ok=True (Python 3.8+) to merge if it already exists
        shutil.copytree(SOURCE_DIR, TARGET_DIR, dirs_exist_ok=True)
        print("[+] Successfully mirrored local Developer documentation to the NAS.")
    except Exception as e:
        print(f"[!] Error copying files: {e}")
        sys.exit(1)
        
if __name__ == "__main__":
    harvest_local_docs()
