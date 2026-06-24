#!/usr/bin/env python3
"""
CORTEX Ingestion & Teach-Back Processor
=======================================
Processes incoming Obsidian mobile clippings from the vault's 00_Inbox.
Extracts frontmatter, enforces the V6 MEMORY_CONTRACT schema, parses inline #dispatch commands,
runs technical notes through the GPU-Aware Reasoning Structurizer, and registers records
in both the central memory index and Obsidian vault.

Author: Antigravity / Creative Liberation Engine V6
"""

import os
import sys
import re
import json
import uuid
import urllib.request
import urllib.error
from datetime import datetime, timezone

# Resolve directories dynamically relative to script location
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

# Resolve canonical paths
MEMORY_DIR = os.path.join(ROOT_DIR, "runtime", "memory")
OBSIDIAN_DIR = os.path.join(ROOT_DIR, "wiki", "obsidian")
SESSIONS_INDEX = os.path.join(MEMORY_DIR, "sessions.index.json")
OBSIDIAN_SESSIONS_DIR = os.path.join(OBSIDIAN_DIR, "sessions")

# Add current directory to path to load reasoning_structurizer
sys.path.append(SCRIPT_DIR)
try:
    import reasoning_structurizer
except ImportError:
    reasoning_structurizer = None
    print("[!] Warning: reasoning_structurizer.py not found in same directory.")

def parse_frontmatter(content):
    """
    Parses YAML-style frontmatter and separates it from the markdown body.
    Handles standard key-value pairs and bulleted list values.
    """
    frontmatter = {}
    body = content
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
    if match:
        yaml_block = match.group(1)
        body = content[match.end():]
        current_key = None
        for line in yaml_block.split("\n"):
            line_strip = line.strip()
            if not line_strip or line_strip.startswith("#"):
                continue
            
            # Match list elements: "- tag_name"
            if line_strip.startswith("- ") and current_key:
                val = line_strip[2:].strip().strip('"').strip("'")
                if not isinstance(frontmatter.get(current_key), list):
                    frontmatter[current_key] = []
                frontmatter[current_key].append(val)
                continue
            
            if ":" in line_strip:
                k, v = line_strip.split(":", 1)
                k = k.strip()
                v = v.strip()
                if v == "":
                    # Empty value suggests start of a bullet list
                    frontmatter[k] = []
                    current_key = k
                else:
                    current_key = k
                    if v.startswith("[") and v.endswith("]"):
                        # Single-line list array: [v6, memory]
                        v = [item.strip().strip('"').strip("'") for item in v[1:-1].split(",") if item.strip()]
                    else:
                        v = v.strip('"').strip("'")
                    frontmatter[k] = v
    return frontmatter, body

def serialize_frontmatter(frontmatter):
    """Serializes a dictionary into a clean YAML frontmatter block."""
    lines = ["---"]
    for k, v in frontmatter.items():
        if isinstance(v, list):
            lines.append(f"{k}:")
            for item in v:
                lines.append(f"  - {item}")
        elif isinstance(v, dict):
            lines.append(f"{k}:")
            for sub_k, sub_v in v.items():
                if isinstance(sub_v, list):
                    lines.append(f"  {sub_k}:")
                    for item in sub_v:
                        lines.append(f"    - {item}")
                else:
                    lines.append(f"  {sub_k}: {sub_v}")
        else:
            lines.append(f"{k}: {v}")
    lines.append("---")
    return "\n".join(lines)

def generate_summary(body_content):
    """Generates a clean summary from the note body (first few sentences)."""
    clean_body = re.sub(r"[#*_`\[\]\-]", "", body_content).strip()
    sentences = re.split(r"(?<=[.!?])\s+", clean_body)
    summary = " ".join(sentences[:3])
    if len(summary) < 10:
        summary = "Mobile capture: " + clean_body[:100]
    return summary[:4000]

def dispatch_task(intent):
    """Sends a POST request to dispatch the task to the Creative Liberation Engine dispatcher."""
    task_payload = {
        "queue": "mobile_dispatch",
        "type": "obsidian_dispatch",
        "priority": "normal",
        "status": "pending",
        "payload": {
            "intent": intent,
            "source": "obsidian_mobile",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    }
    
    ports = [5150, 5160, 5050]
    success = False
    for port in ports:
        url = f"http://127.0.0.1:{port}/api/tasks"
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(task_payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status in (200, 201):
                    print(f"[+] Task successfully dispatched to port {port}: {intent}")
                    success = True
                    break
        except Exception:
            continue
            
    if not success:
        print(f"[!] Warning: Dispatch server unreachable on ports {ports}. Task cached.")

def update_sessions_index(new_item):
    """Registers the new session record into the central sessions index file."""
    os.makedirs(MEMORY_DIR, exist_ok=True)
    if not os.path.exists(SESSIONS_INDEX):
        print(f"[*] Creating new sessions index at {SESSIONS_INDEX}")
        data = {
            "version": "v6.0",
            "collection": "sessions",
            "items": []
        }
    else:
        try:
            with open(SESSIONS_INDEX, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"[!] Error reading sessions.index.json: {e}")
            return
            
    # Check if this memoryId already exists to avoid duplicates
    item_exists = False
    items_list = data.setdefault("items", [])
    for i, item in enumerate(items_list):
        if item.get("memoryId") == new_item["memoryId"]:
            items_list[i] = new_item
            item_exists = True
            break
            
    if not item_exists:
        items_list.append(new_item)
        
    try:
        with open(SESSIONS_INDEX, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"[+] Memory index updated successfully for {new_item['memoryId']}.")
    except Exception as e:
        print(f"[!] Error writing to sessions.index.json: {e}")

def process_file(filepath):
    """Ingests a single mobile note, processes it, and syncs it back to the Vault."""
    if not os.path.exists(filepath):
        print(f"[!] File not found: {filepath}")
        return False
        
    print(f"\n==================================================")
    print(f"[*] Ingestion Started for: {os.path.basename(filepath)}")
    print(f"==================================================")
    
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            raw_content = f.read()
    except Exception as e:
        print(f"[!] Error reading source file: {e}")
        return False
        
    # Parse frontmatter and body content
    frontmatter, body = parse_frontmatter(raw_content)
    
    # ── Step 1: Resolve and Validate Memory ID ──
    memory_id = frontmatter.get("memoryId")
    if not memory_id or not re.match(r"^mem_[a-z0-9_\-]{6,80}$", str(memory_id)):
        basename = os.path.splitext(os.path.basename(filepath))[0]
        clean_base = re.sub(r"[^a-z0-9_\-]", "_", basename.lower())
        clean_base = re.sub(r"_+", "_", clean_base).strip("_")
        memory_id = f"mem_clipper_{clean_base[:50]}"
        if len(memory_id) < 12:
            memory_id = f"mem_clipper_{uuid.uuid4().hex[:8]}"
            
    # ── Step 2: Extract Checklists with #dispatch ──
    dispatch_intents = re.findall(r"-\s*\[\s*\]\s*#dispatch\s+(.*)", body)
    if dispatch_intents:
        print(f"[*] Detected {len(dispatch_intents)} tasks marked for automatic dispatch:")
        for intent in dispatch_intents:
            dispatch_task(intent.strip())
            
    # ── Step 3: Check and Run GPU-Aware Reasoning Structurizer ──
    if reasoning_structurizer and len(body.strip()) > 100:
        technical_indicators = ["code", "function", "api", "docker", "service", "script", "yaml", "json", "python", "import", "class", "npm", "run", "deploy"]
        is_technical = any(indicator in body.lower() for indicator in technical_indicators) or "```" in body
        
        if is_technical:
            print("[*] Technical text detected. Launching GPU-Aware Structurizer...")
            try:
                structured_chains = reasoning_structurizer.structurize_text_to_reasoning_chains(body)
                if structured_chains:
                    print(f"[+] Extracted {len(structured_chains)} Expert Reasoning Chains!")
                    chains_md = ["\n\n## Structured Reasoning Chains (Cortex)", ""]
                    for chain in structured_chains:
                        chains_md.append(f"### Problem: {chain.get('problem', '')}")
                        chains_md.append(f"- **Standard Approach**: {chain.get('approach_a', '')}")
                        chains_md.append(f"- **Expert Approach**: {chain.get('approach_b', '')}")
                        chains_md.append(f"- **Solution/Implementation**:\n```\n{chain.get('solution', '')}\n```\n")
                    body += "\n".join(chains_md)
                    
                    # Save structured JSON to NAS Resolve_RAG_Data
                    rag_learning_dir = os.path.normpath(os.path.join(ROOT_DIR, "media_intake", "Resolve_RAG_Data", "Learning"))
                    os.makedirs(rag_learning_dir, exist_ok=True)
                    rag_filepath = os.path.join(rag_learning_dir, f"{memory_id}_reasoning.json")
                    reasoning_structurizer.save_structured_data(structured_chains, rag_filepath)
            except Exception as struct_err:
                print(f"[!] Reasoning structurization skipped: {struct_err}")
                
    # ── Step 4: Build Canonical Memory Contract Record ──
    iso_now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    memory_contract_record = {
        "memoryId": memory_id,
        "kind": frontmatter.get("kind", "session"),
        "title": frontmatter.get("title", os.path.splitext(os.path.basename(filepath))[0]),
        "summary": frontmatter.get("summary", generate_summary(body)),
        "bodyRef": f"../../wiki/obsidian/sessions/{memory_id}.md",
        "source": "MANUAL",
        "provenance": {
            "recordedBy": frontmatter.get("provenance", {}).get("recordedBy", "MANUAL"),
            "recordedAt": frontmatter.get("provenance", {}).get("recordedAt", iso_now)
        },
        "confidence": float(frontmatter.get("confidence", 1.0)),
        "retentionClass": frontmatter.get("retentionClass", "working"),
        "tags": frontmatter.get("tags", ["clipper", "mobile"]),
        "relations": frontmatter.get("relations", []),
        "createdAt": frontmatter.get("createdAt", iso_now),
        "updatedAt": iso_now,
        "lifecycleState": frontmatter.get("lifecycleState", "draft")
    }
    
    # ── Step 5: Save Structured Note to Vault 00_STATE / sessions ──
    os.makedirs(OBSIDIAN_SESSIONS_DIR, exist_ok=True)
    target_note_path = os.path.join(OBSIDIAN_SESSIONS_DIR, f"{memory_id}.md")
    
    # Populate Obsidian Frontmatter representing the Memory Contract
    obsidian_frontmatter = {
        "memoryId": memory_contract_record["memoryId"],
        "kind": memory_contract_record["kind"],
        "title": memory_contract_record["title"],
        "source": memory_contract_record["source"],
        "retentionClass": memory_contract_record["retentionClass"],
        "lifecycleState": memory_contract_record["lifecycleState"],
        "confidence": memory_contract_record["confidence"],
        "tags": memory_contract_record["tags"],
        "createdAt": memory_contract_record["createdAt"],
        "updatedAt": memory_contract_record["updatedAt"],
        "provenance": memory_contract_record["provenance"]
    }
    if memory_contract_record["relations"]:
        obsidian_frontmatter["relations"] = memory_contract_record["relations"]
        
    full_output_content = serialize_frontmatter(obsidian_frontmatter) + "\n\n" + body.strip() + "\n"
    
    try:
        with open(target_note_path, "w", encoding="utf-8") as f:
            f.write(full_output_content)
        print(f"[+] Formatted Obsidian note saved to vault: {target_note_path}")
    except Exception as e:
        print(f"[!] Error writing Obsidian note to vault: {e}")
        return False
        
    # ── Step 6: Update Central Memory Index ──
    update_sessions_index(memory_contract_record)
    
    # ── Step 7: Archive processed file from Inbox to prevent loops ──
    inbox_dir = os.path.dirname(filepath)
    archive_dir = os.path.join(inbox_dir, "archive")
    os.makedirs(archive_dir, exist_ok=True)
    archive_filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{os.path.basename(filepath)}"
    archive_path = os.path.join(archive_dir, archive_filename)
    
    try:
        os.rename(filepath, archive_path)
        print(f"[+] Moved processed inbox clipping to archive: {archive_filename}")
    except Exception as e:
        print(f"[!] Warning: Could not archive inbox clipping: {e}")
        
    print(f"==================================================")
    print(f"[+] Ingestion Fully Complete for: {memory_id}")
    print(f"==================================================\n")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("[!] Error: No input file specified.")
        print("Usage: python teach_back_processor.py <path_to_markdown_file>")
        sys.exit(1)
        
    target_file = sys.argv[1]
    success = process_file(target_file)
    sys.exit(0 if success else 1)
