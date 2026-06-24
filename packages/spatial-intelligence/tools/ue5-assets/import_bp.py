"""
Auto-generated UE5 Python import script for BP_MetaHuman_OSC_Receiver
Run from Unreal Editor's Python console: exec(open('import_bp.py').read())
"""
import unreal
import json
from pathlib import Path

asset_json = Path(r'D:\\Google Creative Liberation Engine\\Infusion Engine Brainchild\\creative-liberation-engine-v5\\packages\\spatial-intelligence\\tools\\ue5-assets\\BP_MetaHuman_OSC_Receiver.json').read_text()
descriptor = json.loads(asset_json)

# Create Blueprint asset in UE5 content browser
factory = unreal.BlueprintFactory()
factory.parent_class = unreal.load_class(None, descriptor['parent_class'])
asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
bp = asset_tools.create_asset(
    descriptor['name'],
    '/Game/CLE/MetaHuman/Blueprints',
    unreal.Blueprint,
    factory
)
print(f"Blueprint '{descriptor['name']}' imported successfully.")
print(f"OSC port: {descriptor['osc_config']['listen_port']}")
print(f"Blendshapes: {len(descriptor['blendshape_mapping'])} mappings loaded")
