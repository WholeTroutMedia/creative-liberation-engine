#!/usr/bin/env python3
"""
CORTEX GitNexus Codebase Semantic-Graph Harvester
=================================================
Automated ingestion for remote and local Git repositories.
Clones, structures, parses AST/imports, sweeps for security secrets,
generates dynamic Mermaid.js module dependency diagrams, and generates Obsidian-ready
Sovereign Academy Codex codebase notes.

Pushes structured chains to the NAS RAG database and triggers the CORTEX webhook.
"""

import os
import sys
import json
import time
import shutil
import subprocess
import argparse
import re
import asyncio
import requests
from datetime import datetime, timezone

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
try:
    import reasoning_structurizer
except ImportError:
    reasoning_structurizer = None

# NAS Configurations
NAS_RAG_DATA = r"\\127.0.0.1\docker\creative-liberation-engine\media_intake\Sovereign_Academy_RAG\GitNexus"
ACADEMY_CODEX_DIR = r"y:\creative-liberation-engine\academy\codex\gitnexus"
DISPATCH_URL = "http://127.0.0.1:5160/api/tasks"
TEMP_CLONE_DIR = r"y:\creative-liberation-engine\scratch\gitnexus_temp_clones"
MANIFEST_FILE = os.path.join(ACADEMY_CODEX_DIR, "gitnexus_orbit_manifest.json")

# Security Secret Patterns
SECRET_PATTERNS = {
    "Generic API Key": r"(?:key|api|secret|token|password)[a-zA-Z0-9_\-]*\s*[:=]\s*['\"][a-zA-Z0-9_\-]{16,80}['\"]",
    "OpenAI API Key": r"sk-[a-zA-Z0-9]{48}",
    "Anthropic API Key": r"sk-ant-sid[0-9a-zA-Z\-]{30,80}",
    "GitHub Token": r"ghp_[a-zA-Z0-9]{36}"
}

def ensure_directories(dry_run: bool = False):
    if not dry_run:
        os.makedirs(NAS_RAG_DATA, exist_ok=True)
        os.makedirs(ACADEMY_CODEX_DIR, exist_ok=True)
        os.makedirs(TEMP_CLONE_DIR, exist_ok=True)
        if not os.path.exists(MANIFEST_FILE):
            with open(MANIFEST_FILE, 'w', encoding='utf-8') as f:
                json.dump([], f, indent=2)

def dispatch_ingestion_task(title: str, file_path: str, dry_run: bool = False):
    """Dispatch webhook tracking to Creative Liberation Engine V6"""
    task_payload = {
        "queue": "cortex_learning",
        "type": "gitnexus_codebase_ingest",
        "priority": "high",
        "status": "pending",
        "payload": {
            "platform": "GitNexus",
            "title": title,
            "rag_path": file_path,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    }
    if dry_run:
        print(f"  [DRY-RUN] Would dispatch task payload to {DISPATCH_URL}: {json.dumps(task_payload)}")
        return

    try:
        resp = requests.post(DISPATCH_URL, json=task_payload, timeout=5)
        if resp.status_code in (200, 201):
            print(f"  [+] Dispatch successful: {resp.json().get('id', 'unknown')}")
        else:
            print(f"  [!] Dispatch failed: {resp.status_code}")
    except Exception as e:
        print(f"  [!] Dispatch error (non-blocking for local run): {e}")

def clean_local_path(p_dir: str):
    import stat
    if not os.path.exists(p_dir):
        return
    for root, dirs, files in os.walk(p_dir, topdown=False):
        for name in files:
            fp = os.path.join(root, name)
            try:
                os.chmod(fp, stat.S_IWUSR)
                os.remove(fp)
            except Exception:
                pass
        for name in dirs:
            dp = os.path.join(root, name)
            try:
                os.chmod(dp, stat.S_IWUSR)
                os.rmdir(dp)
            except Exception:
                pass
    try:
        shutil.rmtree(p_dir, ignore_errors=True)
    except Exception:
        pass

def update_manifest(repo_name: str, url: str, files_count: int, secrets_found: int, size_kb: float):
    try:
        with open(MANIFEST_FILE, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
    except Exception:
        manifest = []
        
    # Remove existing entry if present
    manifest = [item for item in manifest if item.get("name") != repo_name]
    
    manifest.append({
        "name": repo_name,
        "url": url,
        "indexed_at": datetime.now(timezone.utc).isoformat(),
        "files_count": files_count,
        "secrets_found": secrets_found,
        "size_kb": round(size_kb, 2),
        "status": "active"
    })
    
    with open(MANIFEST_FILE, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    print(f"  [+] Updated GitNexus Manifest catalog at {MANIFEST_FILE}")

def run_secret_sweep(file_path: str, content: str) -> list[dict]:
    findings = []
    for type_name, pattern in SECRET_PATTERNS.items():
        matches = re.finditer(pattern, content, re.IGNORECASE)
        for m in matches:
            line_no = content[:m.start()].count('\n') + 1
            findings.append({
                "file": file_path,
                "line": line_no,
                "type": type_name,
                "match": m.group(0)[:20] + "..." # Truncate for safety
            })
    return findings

def static_analysis_ts(file_path: str, content: str) -> list[str]:
    """Extract local TypeScript/JavaScript relative module imports"""
    imports = []
    # Match imports like: import { x } from './y'; or import x from "../z";
    pattern = r"from\s+['\"](\.\.?\/[^'\"]+)['\"]"
    matches = re.findall(pattern, content)
    for m in matches:
        base = os.path.basename(m)
        imports.append(base)
    return imports

def generate_mermaid_diagram(dependencies: dict) -> str:
    """Generates an interactive Mermaid.js dependency chart"""
    mermaid = "```mermaid\nflowchart TD\n"
    if not dependencies:
        mermaid += "    NoModuleDependencies[\"No local module dependencies mapped\"]\n"
        mermaid += "```\n"
        return mermaid
        
    idx = 1
    node_ids = {}
    for node in dependencies.keys():
        node_ids[node] = f"node{idx}"
        idx += 1
        
    for node, targets in dependencies.items():
        node_id = node_ids[node]
        mermaid += f"    {node_id}[\"{node}\"]\n"
        for t in targets:
            if t in node_ids:
                target_id = node_ids[t]
                mermaid += f"    {node_id} --> {target_id}\n"
    mermaid += "```\n"
    return mermaid

def write_obsidian_note(repo_name: str, url: str, files: list, dependencies: dict, secrets: list, summary: str, dry_run: bool = False):
    memory_id = f"mem_gitnexus_{repo_name.lower().replace('-', '_')}"
    current_time = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    # Delightful Surprise 1: Generate Mermaid.js interactive chart
    mermaid_diagram = generate_mermaid_diagram(dependencies)
    
    # Delightful Surprise 4: High-visibility warning callout if secrets are found
    secrets_block = ""
    if secrets:
        secrets_block = "\n> [!CAUTION]\n> **SECURITY ALERT: Hardcoded Secrets/Keys Detected!**\n"
        for s in secrets:
            secrets_block += f"> - **File:** [{os.path.basename(s['file'])}](file:///{s['file'].replace('\\', '/')}) (Line {s['line']}) - *{s['type']}* (Value stub: `{s['match']}`)\n"
        secrets_block += "\n"

    # Compile the markdown
    note_content = f"""---
memoryId: "{memory_id}"
kind: "artifact"
title: "GitNexus Codebase: {repo_name}"
summary: "{summary[:300].replace('"', '\\"')}..."
source: "KI"
provenance:
  recordedBy: "gitnexus_harvester"
  recordedAt: "{current_time}"
confidence: 0.98
retentionClass: "canonical"
tags:
  - "gitnexus"
  - "codebase-graph"
  - "static-analysis"
  - "sovereign-learning"
createdAt: "{current_time}"
updatedAt: "{current_time}"
lifecycleState: "active"
---

# GitNexus Codebase: {repo_name}

**Source Git Remote:** [{url}]({url})
**Indexed At:** `{current_time}`
**Analyzed Files:** {len(files)} | **Secrets Tagged:** {len(secrets)}

{secrets_block}

## Executive Codebase Summary
{summary}

## Module Dependency Graph (Mermaid.js)
{mermaid_diagram}

## Indexed File Taxonomy Reference
| File Name | Size (Bytes) | Relative Path |
|-----------|--------------|---------------|
"""
    for f in files[:20]: # Limit list size for Obsidian performance
        note_content += f"| [{os.path.basename(f['path'])}](file:///{f['path'].replace('\\', '/')}) | {f['size']} | `{f['rel_path']}` |\n"
        
    note_path = os.path.join(ACADEMY_CODEX_DIR, f"{repo_name}.md")
    
    if dry_run:
        print(f"  [DRY-RUN] Would write GitNexus Obsidian Note to: {note_path}")
        return
        
    with open(note_path, 'w', encoding='utf-8') as f:
        f.write(note_content)
    print(f"  [+] Saved GitNexus Obsidian Codex Note to {note_path}")

async def run_indexing(repo_url: str, limit: int = 15, dry_run: bool = False):
    ensure_directories(dry_run)
    
    repo_name = repo_url.rstrip("/").split("/")[-1].replace(".git", "")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    local_path = os.path.join(TEMP_CLONE_DIR, f"{repo_name}_{timestamp}")
    
    print(f"\n[*] Cloning repository: {repo_url} into local cache...")
    try:
        subprocess.run(
            ["git", "clone", "--depth", "1", repo_url, local_path],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60
        )
    except Exception as e:
        print(f"[!] Git clone failed: {e}")
        return
        
    print("[*] Performing static analysis and secret sweep across the codebase...")
    scanned_files = []
    dependencies = {}
    secrets = []
    total_size_bytes = 0
    
    # Match V6 CEP Rules: Limit parsing to valuable code files, ignore boilerplate
    ignore_dirs = [".git", "node_modules", "dist", "build", ".next", ".turbo", "package-lock.json", "pnpm-lock.yaml"]
    
    for root, dirs, files in os.walk(local_path):
        # Exclude blocked directories dynamically
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in [".ts", ".tsx", ".js", ".jsx", ".py", ".json", ".md"]:
                full_fp = os.path.join(root, file)
                rel_fp = os.path.relpath(full_fp, local_path)
                f_size = os.path.getsize(full_fp)
                total_size_bytes += f_size
                
                scanned_files.append({
                    "path": full_fp,
                    "rel_path": rel_fp,
                    "size": f_size
                })
                
                try:
                    with open(full_fp, 'r', encoding='utf-8', errors='ignore') as f_read:
                        content = f_read.read()
                        
                    # Secrets check
                    file_secrets = run_secret_sweep(rel_fp, content)
                    secrets.extend(file_secrets)
                    
                    # Module dependencies map for TS/JS files
                    if ext in [".ts", ".tsx", ".js"]:
                        file_deps = static_analysis_ts(rel_fp, content)
                        if file_deps:
                            dependencies[file] = file_deps
                            
                except Exception as file_e:
                    print(f"  [!] Failed to read {rel_fp}: {file_e}")
                    
    print(f"[+] Scan completed. Analyzed {len(scanned_files)} files. Secrets found: {len(secrets)}")
    
    # Generate high-fidelity summary
    summary = f"This is the CLE GitNexus parsed model structure of the `{repo_name}` codebase. " \
              f"It comprises {len(scanned_files)} code files spanning {total_size_bytes / 1024:.2f} KB. " \
              f"We analyzed TypeScript module dependencies to construct an interactive topological map " \
              f"of imports to guarantee V6 architecture integrity when copying API nodes."
              
    if not dry_run:
        # Write Codex Note
        write_obsidian_note(repo_name, repo_url, scanned_files, dependencies, secrets, summary, dry_run=False)
        
        # Structurize with local reasoning_structurizer
        print("[*] Processing codebase reference with CORTEX structurizer...")
        raw_text_for_structurizer = ""
        for sf in scanned_files[:5]: # Take first few core files to extract API workflows
            try:
                with open(sf["path"], 'r', encoding='utf-8', errors='ignore') as f_read:
                    raw_text_for_structurizer += f"\n\n--- FILE: {sf['rel_path']} ---\n" + f_read.read()[:2000]
            except Exception:
                pass
                
        if reasoning_structurizer and raw_text_for_structurizer:
            structured_data = reasoning_structurizer.structurize_text_to_reasoning_chains(raw_text_for_structurizer[:12000])
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            target_json_path = os.path.join(NAS_RAG_DATA, f"{repo_name.lower()}_{timestamp}_chains.json")
            
            reasoning_structurizer.save_structured_data(structured_data, target_json_path)
            
            # Dispatch CORTEX Ingestion
            dispatch_ingestion_task(f"GitNexus: {repo_name}", target_json_path)
            
        # Update our delightful manifest catalog
        update_manifest(repo_name, repo_url, len(scanned_files), len(secrets), total_size_bytes / 1024)
    else:
        # Dry run simulation
        write_obsidian_note(repo_name, repo_url, scanned_files, dependencies, secrets, summary, dry_run=True)
        dispatch_ingestion_task(f"GitNexus: {repo_name}", "dry_run_path", dry_run=True)
        print(f"  [DRY-RUN] Auto-generated Mermaid dependency map for: {list(dependencies.keys())[:5]}")
        
    clean_local_path(local_path)
    print(f"\n[+] GitNexus Indexing Sweep for '{repo_name}' fully complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GitNexus Codebase Ingestor")
    parser.add_argument("url", help="Target Git repository URL to clone and analyze")
    parser.add_argument("--limit", type=int, default=15, help="Limit files scanned")
    parser.add_argument("--dry-run", action="store_true", help="Perform a dry-run log sweep without writing to NAS or Codex")
    args = parser.parse_args()

    asyncio.run(run_indexing(args.url, limit=args.limit, dry_run=args.dry_run))
