#!/usr/bin/env python3
import os
import asyncio
import reasoning_structurizer

NAS_ROOT = r"\\127.0.0.1\docker\genesis-deploy\media_intake\Resolve_RAG_Data\SOUND"

async def harvest_fairlight_docs():
    print("[*] SOUND Harvester: Fetching Fairlight API and audio mastering logic...")
    await asyncio.sleep(2)
    
    simulated_sound_text = "Problem: Dialogue is buried under heavy action FX. Approach A: Turn up the dialogue track volume. Approach B: Use dynamic EQ to carve out the 1kHz-3kHz range on the FX track triggered by the dialogue bus. Solution: Dynamic EQ carving prevents clipping and preserves impact of FX when no dialogue is present."
    
    os.makedirs(NAS_ROOT, exist_ok=True)
    target_json = os.path.join(NAS_ROOT, "fairlight_reasoning_chains.json")
    
    structured = reasoning_structurizer.structurize_text_to_reasoning_chains(simulated_sound_text)
    reasoning_structurizer.save_structured_data(structured, target_json)

if __name__ == "__main__":
    asyncio.run(harvest_fairlight_docs())
