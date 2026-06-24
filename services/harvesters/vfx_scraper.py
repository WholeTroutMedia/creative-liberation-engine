#!/usr/bin/env python3
import os
import asyncio
import reasoning_structurizer

NAS_ROOT = r"\\127.0.0.1\docker\genesis-deploy\media_intake\Resolve_RAG_Data\VFX"

async def harvest_fusion_docs():
    print("[*] VFX Harvester: Fetching WeSuckLess and Fusion Node logic...")
    await asyncio.sleep(2)
    
    simulated_vfx_text = "Problem: Keying a greenscreen with heavy spill on blond hair. Approach A: Use Delta Keyer and generic despill. Approach B: Build a custom despill matrix using Channel Booleans before the Delta Keyer. Solution: Custom despill matrix preserves fine hair detail without eroding the edge matte."
    
    os.makedirs(NAS_ROOT, exist_ok=True)
    target_json = os.path.join(NAS_ROOT, "fusion_reasoning_chains.json")
    
    structured = reasoning_structurizer.structurize_text_to_reasoning_chains(simulated_vfx_text)
    reasoning_structurizer.save_structured_data(structured, target_json)

if __name__ == "__main__":
    asyncio.run(harvest_fusion_docs())
