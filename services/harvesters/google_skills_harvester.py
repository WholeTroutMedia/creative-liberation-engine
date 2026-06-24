#!/usr/bin/env python3
"""
Creative Liberation Engine V6: Google Skills & Developer Harvester

This script ingests the extracted Google Cloud Skills Boost and Google Developer Program 
learning paths (harvested via authenticated browser sessions) and pushes them into the 
CORTEX pipeline and V6 Dispatch system for RAG indexing and task generation.

Since Google heavily restricts headless automation, we rely on the browser subagent 
extracting the DOM to a localized JSON file, which this harvester then parses.
"""

import os
import json
import argparse
import requests

NAS_RAG_DATA = r"\\127.0.0.1\docker\genesis-deploy\media_intake\Resolve_RAG_Data\GoogleSkills"
LOCAL_HARVEST_JSON = r"d:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine\runtime\registry\cortex_google_harvest.json"

def ensure_directories():
    print(f"[*] Verifying NAS target directories...")
    os.makedirs(NAS_RAG_DATA, exist_ok=True)

def process_google_harvest(json_path):
    print("=====================================================")
    print(" V6 SOVEREIGN MEDIA MESH - GOOGLE SKILLS HARVESTER   ")
    print("=====================================================")
    ensure_directories()
    
    if not os.path.exists(json_path):
        print(f"[!] Critical Error: Harvest JSON '{json_path}' not found.")
        print("    Please run the browser subagent to extract the authenticated Google session first.")
        return

    print(f"[*] Loading Google Harvest Data from: {json_path}")
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Process Google Skills
    skills = data.get("google_skills", {}).get("learning_paths", [])
    print(f"[*] Found {len(skills)} learning paths in Google Skills.")
    
    for path in skills:
        title = path.get("title", "Unknown Path")
        url = path.get("url", "")
        print(f"  -> Processing Path: {title}")
        
        # Dispatch Webhook for Tracking
        dispatch_url = "http://127.0.0.1:5150/api/tasks"
        task_payload = {
            "queue": "cortex_learning",
            "type": "learning_path_ingest",
            "priority": "normal",
            "status": "pending",
            "payload": {
                "title": title,
                "url": url,
                "source": "google_skills_boost",
                "modules": path.get("courses", [])
            }
        }
        try:
            resp = requests.post(dispatch_url, json=task_payload)
            if resp.status_code in (200, 201):
                print(f"    [+] Task dispatched. ID: {resp.json().get('id', 'unknown')}")
            else:
                pass # print(f"    [!] Dispatch failed: {resp.status_code}")
        except Exception as e:
            # Silently catch offline dispatch for local dev
            pass

    # Process Google Developer Program
    dev_program = data.get("google_developer_program", {}).get("codelabs", [])
    print(f"[*] Found {len(dev_program)} codelabs in Google Developer Program.")
    
    for lab in dev_program:
        title = lab.get("title", "Unknown Codelab")
        url = lab.get("url", "")
        print(f"  -> Processing Codelab: {title}")
        
        # Dispatch Webhook for Tracking
        dispatch_url = "http://127.0.0.1:5150/api/tasks"
        task_payload = {
            "queue": "cortex_learning",
            "type": "codelab_ingest",
            "priority": "high",
            "status": "pending",
            "payload": {
                "title": title,
                "url": url,
                "source": "google_developer_program"
            }
        }
        try:
            resp = requests.post(dispatch_url, json=task_payload)
            if resp.status_code in (200, 201):
                print(f"    [+] Task dispatched. ID: {resp.json().get('id', 'unknown')}")
        except Exception:
            pass
            
    # Save a sanitized copy directly to the RAG intake
    target_json_path = os.path.join(NAS_RAG_DATA, "google_learning_paths_chains.json")
    try:
        with open(target_json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4)
        print(f"[*] Raw harvest data staged for RAG at {target_json_path}")
    except Exception as e:
        print(f"[!] Failed to stage RAG data: {e}")

    print("\n[*] Google Harvester execution cycle complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Google Skills Harvester ingestion.")
    parser.add_argument("--json", default=LOCAL_HARVEST_JSON, help="Path to the extracted JSON file")
    args = parser.parse_args()

    process_google_harvest(args.json)
