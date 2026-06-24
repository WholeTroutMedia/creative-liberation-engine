#!/usr/bin/env python3
"""
Creative Liberation Engine V6: Git Repository Harvester

This script clones key expert-level DaVinci Resolve community repositories
(ResolveCafe DCTL and WSL Reactor) directly to the NAS intake folder.
"""

import os
import subprocess
import sys

NAS_ROOT = r"\\127.0.0.1\docker\genesis-deploy"
TARGET_BASE_DIR = os.path.join(NAS_ROOT, "media_intake", "Resolve_RAG_Data")

REPOSITORIES = {
    "ResolveCafe": "https://github.com/CommandPost/ResolveCafe.git",
    "Reactor": "https://gitlab.com/WeSuckLess/Reactor.git"
}

def harvest_repositories():
    print("=====================================================")
    print(" V6 SOVEREIGN MEDIA MESH - GIT REPO HARVESTER        ")
    print("=====================================================")
    
    os.makedirs(TARGET_BASE_DIR, exist_ok=True)
    
    for name, url in REPOSITORIES.items():
        target_dir = os.path.join(TARGET_BASE_DIR, name)
        
        print(f"\n[*] Harvesting {name} from {url}...")
        
        if os.path.exists(target_dir):
            print(f"[-] Directory {target_dir} already exists. Pulling latest changes...")
            try:
                subprocess.run(["git", "-C", target_dir, "pull"], check=True)
                print(f"[+] Successfully updated {name}.")
            except subprocess.CalledProcessError as e:
                print(f"[!] Failed to update {name}: {e}")
        else:
            print(f"[*] Cloning repository to {target_dir}...")
            try:
                subprocess.run(["git", "clone", url, target_dir], check=True)
                print(f"[+] Successfully cloned {name}.")
            except subprocess.CalledProcessError as e:
                print(f"[!] Failed to clone {name}: {e}")

if __name__ == "__main__":
    harvest_repositories()
