#!/usr/bin/env python3
"""
Creative Liberation Engine V6: Sovereign Academy - Director
Orchestrates parallel execution of Phase 2 (Autonomous Discovery) 
and Phase 3 (Multi-Modal Vision Ingestion).
"""

import os
import asyncio
import time

async def run_service(name: str, command: str, cwd: str = None):
    print(f"[*] Starting {name} Service...")
    try:
        # Run the command asynchronously
        process = await asyncio.create_subprocess_shell(
            command,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            print(f"[+] {name} Service completed successfully.")
            # For brevity in logging, we only show last few lines or success msg.
            output = stdout.decode('utf-8').strip()
            if output:
                print(output[-500:])
        else:
            print(f"[!] {name} Service failed with code {process.returncode}")
            print(stderr.decode('utf-8'))
            
    except Exception as e:
        print(f"[!] Exception running {name}: {e}")

async def launch_academy_swarm():
    print("\n=========================================================")
    print(" V6 SOVEREIGN ACADEMY - DIRECTOR [PHASE 2 & 3 PARALLEL] ")
    print("=========================================================")
    print("[*] Launching autonomous discovery and vision ingestion simultaneously...\n")
    
    start_time = time.time()
    
    # Get the directory of the current script (services/harvesters)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Define our parallel tasks
    tasks = [
        # Phase 2: Autonomous Discovery (TS file using tsx)
        run_service("PHASE 2: Discovery Agent", 'npx tsx phase2_autonomous/discovery_agent.ts', cwd=current_dir),
        
        # Phase 3: Multi-Modal Vision Ingestion (JS file using node)
        run_service("PHASE 3: Vision Ingestor", 'node phase3_multimodal/vision_ingestor.js', cwd=current_dir)
    ]
    
    # Run all harvesters concurrently
    await asyncio.gather(*tasks)
    
    elapsed = time.time() - start_time
    print(f"\n[+] Academy swarm execution completed in {elapsed:.2f} seconds.")
    print("[+] Discovery and Vision pipelines are active on the NAS.")

if __name__ == "__main__":
    asyncio.run(launch_academy_swarm())
