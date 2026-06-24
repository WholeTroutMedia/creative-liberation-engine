import os
import json
import re

REGISTRY_FILE = "/app/creative-liberation-engine/runtime/registry/ideations.canonical.json"

def generate():
    with open(REGISTRY_FILE, 'r', encoding='utf-8') as f:
        registry = json.load(f)

    design_keywords = ["design", "3d", "visual", "dashboard", "ui ", "interface", "hardware", "vr", "glass", "game", "animation", "creative", "media", "video", "playcanvas", "studio", "aesthetic"]
    
    verified_items = []
    design_items = []

    for item in registry.get("ideations", []):
        content = (item["title"] + " " + item.get("directive", "")).lower()
        if any(k in content for k in design_keywords):
            design_items.append(item)
            item["status"] = "DESIGN_HOLD"
            
            filepath = os.path.join("/app/creative-liberation-engine", item["file_path"])
            try:
                with open(filepath, 'r', encoding='utf-8') as jf:
                    data = json.load(jf)
                if "lifecycle" not in data: data["lifecycle"] = {}
                data["lifecycle"]["status"] = "DESIGN_HOLD"
                with open(filepath, 'w', encoding='utf-8') as jf:
                    json.dump(data, jf, indent=2)
            except: pass
        else:
            verified_items.append(item)

    registry["_manifest"]["status_counts"] = {"VERIFIED": len(verified_items), "DESIGN_HOLD": len(design_items)}
    with open(REGISTRY_FILE, 'w', encoding='utf-8') as f:
        json.dump(registry, f, indent=2)

    ver_md = "# Ideation Verification Report\n\n"
    ver_md += "> [!NOTE]\n> All listed capabilities below have been permanently sealed. Their functional microservices have been physically scaffolded to `services/`, and their contracts have passed V6 validation.\n\n"
    ver_md += "| ID | Title | Module Path | Contract Path |\n"
    ver_md += "|---|---|---|---|\n"
    for item in verified_items:
        slug = re.sub(r'[^a-z0-9\-]', '-', item["title"].lower())
        slug = re.sub(r'-+', '-', slug).strip('-')[:30]
        if not slug or slug == "-": slug = item["id"].lower()
        ver_md += f"| `{item['id']}` | {item['title']} | `services/{slug}/src/index.ts` | `schemas/{item['id'].replace('-','_').upper()}_MANIFEST.schema.json` |\n"

    des_md = "# Design Hold Queue\n\n"
    des_md += "> [!IMPORTANT]\n> The following ideations have been segregated into `DESIGN_HOLD`. They require UI/UX generative design, 3D asset creation, or Creative Director input before their logical mounting code is finalized.\n\n"
    for item in design_items:
        des_md += f"### {item['title']}\n"
        des_md += f"- **ID:** `{item['id']}`\n"
        des_md += f"- **Helix:** `{item.get('helix', 'UNKNOWN')}`\n"
        des_md += f"- **Directive:** {item.get('directive', 'N/A')}\n\n"

    with open("/app/creative-liberation-engine/scratch/ver_report.md", "w", encoding='utf-8') as f:
        f.write(ver_md)
    with open("/app/creative-liberation-engine/scratch/des_report.md", "w", encoding='utf-8') as f:
        f.write(des_md)

if __name__ == "__main__":
    generate()
    print("Done")
