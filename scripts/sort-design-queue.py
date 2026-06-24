import json
import os

REGISTRY_FILE = "/app/creative-liberation-engine/runtime/registry/ideations.canonical.json"
DESIGN_QUEUE_FILE = "/app/creative-liberation-engine/runtime/registry/DESIGN_HOLD_QUEUE.json"

def process_ideations():
    with open(REGISTRY_FILE, 'r', encoding='utf-8') as f:
        registry = json.load(f)
        
    design_hold = []
    design_keywords = ["design", "3d", "visual", "dashboard", "cad", "ui ", "interface", "hardware", "vr", "glass", "game", "animation", "creative", "media"]
    
    for item in registry.get("ideations", []):
        content = (item["title"] + " " + item.get("directive", "")).lower()
        if any(k in content for k in design_keywords):
            if item["status"] != "DESIGN_HOLD":
                item["status"] = "DESIGN_HOLD"
                design_hold.append(item)
                
                filepath = os.path.join("/app/creative-liberation-engine", item["file_path"])
                try:
                    with open(filepath, 'r', encoding='utf-8') as jf:
                        data = json.load(jf)
                    if "lifecycle" not in data:
                        data["lifecycle"] = {}
                    data["lifecycle"]["status"] = "DESIGN_HOLD"
                    with open(filepath, 'w', encoding='utf-8') as jf:
                        json.dump(data, jf, indent=2)
                except Exception: pass

    with open(DESIGN_QUEUE_FILE, 'w', encoding='utf-8') as f:
        json.dump(design_hold, f, indent=2)
        
    with open(REGISTRY_FILE, 'w', encoding='utf-8') as f:
        json.dump(registry, f, indent=2)
        
    print(f"Sorted {len(design_hold)} ideations into DESIGN_HOLD_QUEUE.")

if __name__ == "__main__":
    process_ideations()
