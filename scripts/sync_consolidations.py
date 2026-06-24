#!/usr/bin/env python3
import os
import json
import re
import glob
import hashlib
import subprocess

# Define workspace directories dynamically based on platform
import sys
if sys.platform == "win32":
    BASE_DIR = r"y:\creative-liberation-engine"
else:
    BASE_DIR = "/app/creative-liberation-engine"

QUEUE_DIR = os.path.join(BASE_DIR, "runtime", "ideation-queue")
DUPES_DIR = os.path.join(QUEUE_DIR, "duplicates")
CONSOLIDATIONS_FILE = os.path.join(BASE_DIR, "docs", "consolidations.md")
INDEX_FILE = os.path.join(BASE_DIR, "runtime", "registry", "ideations", "_index.json")

def extract_consolidated_ids(md_path):
    """Extract all Job IDs like IE-IDX-XXXX from the consolidations markdown file."""
    if not os.path.exists(md_path):
        print(f"Error: consolidations file not found at {md_path}")
        return []
    
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Match IE-IDX-XXXX patterns
    job_ids = re.findall(r"IE-IDX-\d+", content)
    # De-duplicate while preserving order
    seen = set()
    unique_ids = []
    for jid in job_ids:
        if jid not in seen:
            seen.add(jid)
            unique_ids.append(jid)
    return unique_ids

def get_dedup_key(data):
    """Generate the same dedup key used by rebuild-ideation-index.py."""
    source_article = data.get("sourceArticle", {})
    title = source_article.get("title", data.get("title", ""))
    source_url = source_article.get("url", "")
    source_guid = source_article.get("guid", "")
    
    if source_guid:
        return source_guid
    elif source_url:
        return hashlib.sha256(source_url.encode()).hexdigest()[:16]
    elif title:
        return hashlib.sha256(title.encode()).hexdigest()[:16]
    return ""

def load_all_queue_files():
    """Load all JSON files from both main queue and duplicates directories."""
    all_files = {}
    
    # Main queue
    for fp in glob.glob(os.path.join(QUEUE_DIR, "IE-IDX-*.json")):
        all_files[os.path.basename(fp)] = {"path": fp, "dir": "main"}
        
    # Duplicates
    for fp in glob.glob(os.path.join(DUPES_DIR, "IE-IDX-*.json")):
        all_files[os.path.basename(fp)] = {"path": fp, "dir": "duplicates"}
        
    return all_files

def sync_consolidations():
    print("═══ Creative Liberation Engine — Consolidation Status Sync ═══")
    
    # 1. Extract consolidated IDs from md
    consolidated_ids = extract_consolidated_ids(CONSOLIDATIONS_FILE)
    print(f"Found {len(consolidated_ids)} Job IDs in {os.path.basename(CONSOLIDATIONS_FILE)}")
    if not consolidated_ids:
        return
        
    # 2. Load all queue files
    all_files = load_all_queue_files()
    print(f"Loaded {len(all_files)} total files from queue & duplicates folders.")
    
    # Parse all files to construct a mapping of dedup_key -> list of file records
    key_to_files = {}
    id_to_file = {}
    
    for filename, info in all_files.items():
        try:
            with open(info["path"], "r", encoding="utf-8") as f:
                data = json.load(f)
                
            job_id = data.get("jobId", data.get("id", ""))
            if not job_id:
                # Extract from filename
                job_id = filename.split("_")[0]
            if not job_id.startswith("IE-IDX-"):
                job_id = f"IE-IDX-{job_id}"
                
            key = get_dedup_key(data)
            
            record = {
                "filepath": info["path"],
                "filename": filename,
                "jobId": job_id,
                "data": data,
                "dedup_key": key
            }
            
            id_to_file[job_id] = record
            
            if key:
                if key not in key_to_files:
                    key_to_files[key] = []
                key_to_files[key].append(record)
        except Exception as e:
            print(f"  ⚠ Error reading {filename}: {e}")
            
    # 3. Process each consolidated ID
    modified_count = 0
    updated_files = set()
    
    for cid in consolidated_ids:
        if cid not in id_to_file:
            print(f"  ⚠ Job ID {cid} mentioned in consolidations.md is not found in the file system.")
            continue
            
        record = id_to_file[cid]
        key = record["dedup_key"]
        
        # We want to find ALL files matching this dedup key (both unique and duplicates)
        related_records = []
        if key:
            related_records = key_to_files.get(key, [record])
        else:
            related_records = [record]
            
        print(f"  🔄 Syncing {cid} ('{record['data'].get('sourceArticle', {}).get('title', record['data'].get('title', ''))[:40]}...'):")
        for r in related_records:
            current_status = r["data"].get("status")
            if current_status != "VERIFIED":
                print(f"     -> Updating status of {r['jobId']} ({r['filename']}) from {current_status} to VERIFIED")
                r["data"]["status"] = "VERIFIED"
                
                # Update lifecycle block if it exists
                if "lifecycle" in r["data"] and isinstance(r["data"]["lifecycle"], dict):
                    r["data"]["lifecycle"]["status"] = "VERIFIED"
                
                # Write back to file
                with open(r["filepath"], "w", encoding="utf-8") as f:
                    json.dump(r["data"], f, indent=2)
                
                modified_count += 1
                updated_files.add(r["filepath"])
            else:
                print(f"     -> {r['jobId']} ({r['filename']}) is already VERIFIED")
                
    print(f"\n✅ Updated {modified_count} files to VERIFIED status.")
    
    # 4. Rebuild the index so changes propagate
    if modified_count > 0:
        print("\nRebuilding sharded registry index to seal the updates...")
        script_path = os.path.join(BASE_DIR, "scripts", "rebuild-ideation-index.py")
        try:
            python_bin = "python" if sys.platform == "win32" else "python3"
            result = subprocess.run([python_bin, script_path, "--dedup"], capture_output=True, text=True, check=True)
            print(result.stdout)
        except Exception as e:
            print(f"Error rebuilding index: {e}")

if __name__ == "__main__":
    sync_consolidations()
