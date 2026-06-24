import os
import json
import re

REGISTRY_FILE = "/app/creative-liberation-engine/runtime/registry/ideations.canonical.json"
SCHEMAS_DIR = "/app/creative-liberation-engine/schemas"
SERVICES_DIR = "/app/creative-liberation-engine/services"

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9\-]', '-', text)
    return re.sub(r'-+', '-', text).strip('-')

def scaffold_all():
    with open(REGISTRY_FILE, 'r', encoding='utf-8') as f:
        registry = json.load(f)

    count = 0
    for item in registry.get("ideations", []):
        if item.get("status") == "ACTIVATED":
            count += 1
            # 1. Create Schema Manifest
            schema_name = f"{item['id'].replace('-', '_').upper()}_MANIFEST.schema.json"
            schema_path = os.path.join(SCHEMAS_DIR, schema_name)
            
            schema_data = {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "title": item["title"],
                "type": "object",
                "description": item.get("directive", ""),
                "properties": {
                    "helix": {"type": "string", "const": item.get("helix", "UNKNOWN")},
                    "status": {"type": "string", "const": "IMPLEMENTING"}
                }
            }
            with open(schema_path, 'w', encoding='utf-8') as sf:
                json.dump(schema_data, sf, indent=2)
                
            # 2. Create Service Scaffold
            slug = slugify(item["title"])[:30]
            if not slug or slug == "-":
                slug = item['id'].lower()
            service_path = os.path.join(SERVICES_DIR, slug)
            os.makedirs(os.path.join(service_path, "src"), exist_ok=True)
            
            # package.json
            pkg_path = os.path.join(service_path, "package.json")
            if not os.path.exists(pkg_path):
                pkg_data = {
                    "name": f"@cle/{slug}",
                    "version": "1.0.0",
                    "description": item.get("directive", "")[:150],
                    "main": "src/index.ts",
                    "scripts": {"start": "ts-node src/index.ts"}
                }
                with open(pkg_path, 'w', encoding='utf-8') as pf:
                    json.dump(pkg_data, pf, indent=2)
            
            # index.ts
            idx_path = os.path.join(service_path, "src", "index.ts")
            if not os.path.exists(idx_path):
                with open(idx_path, 'w', encoding='utf-8') as idxf:
                    idxf.write(f"// Implementation for {item['id']}: {item['title']}\n")
                    idxf.write(f"// Directive: {item.get('directive', '')}\n\n")
                    idxf.write("export async function init() {\n")
                    idxf.write("  console.log('Service initialized');\n")
                    idxf.write("}\n")
                    
            # 3. Update the Ideation JSON
            filepath = os.path.join("/app/creative-liberation-engine", item["file_path"])
            try:
                with open(filepath, 'r', encoding='utf-8') as jf:
                    data = json.load(jf)
                if "lifecycle" not in data:
                    data["lifecycle"] = {}
                data["lifecycle"]["status"] = "IMPLEMENTING"
                with open(filepath, 'w', encoding='utf-8') as jf:
                    json.dump(data, jf, indent=2)
            except Exception: pass

    print(f"Parallel execution complete. {count} schemas and services dynamically provisioned.")

if __name__ == "__main__":
    scaffold_all()
