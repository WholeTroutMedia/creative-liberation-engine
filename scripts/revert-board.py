import os
import json
import glob

QUEUE_DIR = "/app/creative-liberation-engine/runtime/ideation-queue"

def revert():
    for filepath in glob.glob(os.path.join(QUEUE_DIR, "*.json")):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if data.get("lifecycle", {}).get("status") == "IMPLEMENTING":
                data["lifecycle"]["status"] = "ACTIVATED"
                if "status" in data:
                    data["status"] = "ACTIVATED"
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2)
        except Exception:
            pass

if __name__ == "__main__":
    revert()
