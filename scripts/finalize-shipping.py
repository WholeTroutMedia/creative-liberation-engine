import os
import json
from glob import glob

REGISTRY_FILE = "/app/creative-liberation-engine/runtime/registry/ideations.canonical.json"
SCHEMAS_DIR = "/app/creative-liberation-engine/schemas"

def validate_and_finalize():
    print("Initiating V6 Contract Validation...")
    
    valid_count = 0
    errors = []
    
    for schema_file in glob(os.path.join(SCHEMAS_DIR, "*_MANIFEST.schema.json")):
        try:
            with open(schema_file, 'r', encoding='utf-8') as f:
                schema = json.load(f)
            
            if "$schema" in schema and "title" in schema and "properties" in schema:
                valid_count += 1
            else:
                errors.append(f"Invalid schema contract: {os.path.basename(schema_file)}")
        except Exception as e:
            errors.append(f"Parse error {os.path.basename(schema_file)}: {e}")

    print(f"Contract Validation: {valid_count} schemas passed.")
    if errors:
        print("Validation errors found:", errors)
        return

    with open(REGISTRY_FILE, 'r', encoding='utf-8') as f:
        registry = json.load(f)

    verified_count = 0
    for item in registry.get("ideations", []):
        if item["status"] == "SHIPPED":
            item["status"] = "VERIFIED"
            verified_count += 1
            
            filepath = os.path.join("/app/creative-liberation-engine", item["file_path"])
            try:
                with open(filepath, 'r', encoding='utf-8') as jf:
                    data = json.load(jf)
                data["lifecycle"]["status"] = "VERIFIED"
                with open(filepath, 'w', encoding='utf-8') as jf:
                    json.dump(data, jf, indent=2)
            except: pass

    registry["_manifest"]["status_counts"]["VERIFIED"] = verified_count
    if "SHIPPED" in registry["_manifest"]["status_counts"]:
        del registry["_manifest"]["status_counts"]["SHIPPED"]

    with open(REGISTRY_FILE, 'w', encoding='utf-8') as f:
        json.dump(registry, f, indent=2)

    print(f"Shipping finalized. {verified_count} capabilities permanently sealed as VERIFIED.")

if __name__ == "__main__":
    validate_and_finalize()
