import os
import json
import glob
from datetime import datetime

QUEUE_DIR = "/app/creative-liberation-engine/runtime/ideation-queue"
REGISTRY_FILE = "/app/creative-liberation-engine/runtime/registry/ideations.canonical.json"

def parallel_execute_helices():
    if not os.path.exists(REGISTRY_FILE):
        print("Registry not found.")
        return

    with open(REGISTRY_FILE, 'r', encoding='utf-8') as f:
        registry = json.load(f)

    count = 0
    # Clear the board: transition all from ACTIVATED to IMPLEMENTING
    for idx, item in enumerate(registry.get("ideations", [])):
        if item.get("status") == "ACTIVATED":
            filepath = os.path.join("/app/creative-liberation-engine", item["file_path"])
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Migrate and lock state
                if "lifecycle" not in data:
                    data["lifecycle"] = {}
                data["lifecycle"]["status"] = "IMPLEMENTING"
                data["lifecycle"]["execution_started_at"] = datetime.utcnow().isoformat() + "Z"
                
                # Cleanup deprecated root status if it exists
                if "status" in data:
                    data["status"] = "IMPLEMENTING" 
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2)
                
                registry["ideations"][idx]["status"] = "IMPLEMENTING"
                count += 1

            except Exception as e:
                print(f"Error processing {item['id']}: {e}")

    # Rebuild metadata counts
    if count > 0:
        registry["_manifest"]["status_counts"] = {"IMPLEMENTING": registry["_manifest"]["total_items"]}
        registry["_manifest"]["last_synced"] = datetime.utcnow().isoformat() + "Z"
        
        with open(REGISTRY_FILE, 'w', encoding='utf-8') as f:
            json.dump(registry, f, indent=2)

    print(f"Board Cleared. {count} Ideations successfully transitioned to IMPLEMENTING across all Helices.")

if __name__ == "__main__":
    parallel_execute_helices()
