import os
import json
import glob
from datetime import datetime

QUEUE_DIR = "/app/creative-liberation-engine/runtime/ideation-queue"
REGISTRY_FILE = "/app/creative-liberation-engine/runtime/registry/ideations.canonical.json"

def build_registry():
    registry = {
        "_manifest": {
            "type": "IDEATION_REGISTRY",
            "version": "v6.0.0",
            "last_synced": datetime.utcnow().isoformat() + "Z",
            "total_items": 0,
            "status_counts": {}
        },
        "ideations": []
    }
    
    for filepath in glob.glob(os.path.join(QUEUE_DIR, "*.json")):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            ideation_id = data.get("id", os.path.basename(filepath).replace(".json", ""))
            
            # Extract status properly prioritizing lifecycle
            status = "UNKNOWN"
            if "lifecycle" in data and "status" in data["lifecycle"]:
                status = data["lifecycle"]["status"]
            elif "status" in data:
                status = data["status"]
                
            source = data.get("source", "unknown")
            if isinstance(source, dict):
                source = source.get("type", "unknown")
                
            title = data.get("title", "")
            directive = data.get("directive", "")
            
            # Map to Strategic Helix (Epic)
            helix = "UNASSIGNED"
            content_str = (title + " " + directive).lower()
            if any(k in content_str for k in ["energy", "orchestration", "parallel", "credit", "subquadratic", "mcp"]):
                helix = "INFRASTRUCTURE"
            elif any(k in content_str for k in ["graph", "data", "web layer", "control plane", "memory"]):
                helix = "COGNITIVE_CORE"
            elif any(k in content_str for k in ["design", "3d", "visual", "dashboard", "cad"]):
                helix = "CREATIVE_DIRECTOR"
            elif any(k in content_str for k in ["video", "multimedia"]):
                helix = "VIDEO_PIPELINE"
            elif any(k in content_str for k in ["security", "pentest", "provenance", "hardware", "mac"]):
                helix = "EDGE_SECURITY"
                
            registry["ideations"].append({
                "id": ideation_id,
                "title": title,
                "status": status,
                "helix": helix,
                "source": source,
                "file_path": filepath.replace("/app/creative-liberation-engine/", "")
            })
            
            registry["_manifest"]["status_counts"][status] = registry["_manifest"]["status_counts"].get(status, 0) + 1
            registry["_manifest"]["total_items"] += 1
            
        except Exception as e:
            print(f"Error parsing {filepath}: {e}")
            
    with open(REGISTRY_FILE, 'w', encoding='utf-8') as f:
        json.dump(registry, f, indent=2)

if __name__ == "__main__":
    build_registry()
    print(f"Registry synced to {REGISTRY_FILE}")
