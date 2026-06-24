import os, json

packages = [
  {"id": "ghost-agent", "name": "GHOST Stealth Agent", "schema": "GHOST_AGENT"},
  {"id": "blockchain-layer", "name": "Blockchain and Web3", "schema": "BLOCKCHAIN_LAYER"},
  {"id": "living-canvas", "name": "Living Canvas Generative UI", "schema": "LIVING_CANVAS"},
  {"id": "gen-ui", "name": "Generative UI System", "schema": "GEN_UI"},
  {"id": "idv-engine", "name": "Identity Verification", "schema": "IDV_ENGINE"},
  {"id": "wire-ingestion-mcp", "name": "Wire Ingestion MCP", "schema": "WIRE_INGESTION_MCP"},
  {"id": "voc-mcp", "name": "Voice of Customer MCP", "schema": "VOC_MCP"}
]

repo_root = "/app/creative-liberation-engine"

for pkg in packages:
    pkg_dir = os.path.join(repo_root, "services/packages", pkg["id"])
    src_dir = os.path.join(pkg_dir, "src")
    os.makedirs(src_dir, exist_ok=True)
    
    with open(os.path.join(pkg_dir, "package.json"), "w") as f:
        json.dump({
            "name": "@cle/" + pkg["id"],
            "version": "0.1.0",
            "type": "module",
            "main": "dist/index.js",
            "types": "dist/index.d.ts",
            "scripts": {"build": "tsc -b"}
        }, f, indent=2)
        
    with open(os.path.join(pkg_dir, "tsconfig.json"), "w") as f:
        json.dump({
            "extends": "../../../tsconfig.base.json",
            "compilerOptions": {"outDir": "dist", "rootDir": "src", "module": "NodeNext", "moduleResolution": "NodeNext"},
            "include": ["src/**/*"]
        }, f, indent=2)
        
    with open(os.path.join(src_dir, "index.ts"), "w") as f:
        f.write("export function init() { console.log(\"" + pkg["name"] + " initialized\"); }")
        
    schema_path = os.path.join(repo_root, "schemas", pkg["schema"] + ".schema.json")
    if not os.path.exists(schema_path):
        with open(schema_path, "w") as f:
            json.dump({"$schema": "http://json-schema.org/draft-07/schema#", "title": pkg["schema"], "type": "object", "properties": {"enabled": {"type": "boolean"}}}, f, indent=2)

print("Scaffolding complete.")
