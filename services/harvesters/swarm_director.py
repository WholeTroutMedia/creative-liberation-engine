#!/usr/bin/env python3
"""
Creative Liberation Engine V6: Sovereign Media Mesh - Swarm Director
Orchestrates parallel data ingestion across all studio disciplines.
Runs specialized scrapers concurrently to build the expert data lakes.
"""

import os
import asyncio
import subprocess
import time

import sys

def get_nas_path(win_path):
    if sys.platform.startswith("win"):
        return win_path
    local_path = win_path.replace(r"\\127.0.0.1\docker", "/app")
    return local_path.replace("\\", "/")

NAS_ROOT = get_nas_path(r"\\127.0.0.1\docker\creative-liberation-engine\media_intake\Resolve_RAG_Data")
DISCIPLINES = ["VFX", "COLOR", "SOUND", "EDITING", "PHOTO", "PATREON/AI_CREATION", "MUSIC", "LAW_ETHICS", "BUSINESS_ECONOMICS", "CYBERSECURITY_SYSTEMS"]

def ensure_nas_directories():
    print("[*] Verifying NAS target directories for full studio ingestion...")
    for d in DISCIPLINES:
        path = os.path.join(NAS_ROOT, d)
        os.makedirs(path, exist_ok=True)
        print(f"  [+] {path}")


async def run_scraper(name, command):
    print(f"[*] Starting {name} Harvester...")
    try:
        # We run the command asynchronously
        process = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            print(f"[+] {name} Harvester completed successfully.")
            # For brevity in logging, we only show last few lines or success msg.
            print(stdout.decode('utf-8')[-200:])
        else:
            print(f"[!] {name} Harvester failed with code {process.returncode}")
            print(stderr.decode('utf-8'))
            
    except Exception as e:
        print(f"[!] Exception running {name}: {e}")

async def launch_parallel_swarm():
    ensure_nas_directories()
    
    print("\n=====================================================")
    print(" V6 SOVEREIGN MEDIA MESH - SWARM DIRECTOR [PARALLEL] ")
    print("=====================================================")
    print("[*] Launching all discipline harvesters simultaneously...\n")
    
    start_time = time.time()
    
    # Define our parallel tasks - Scaling up to Top 50 YouTube assets per discipline
    tasks = [
        # VFX
        run_scraper("YOUTUBE/VFX", 'python youtube_scraper.py --url "ytsearch50:DaVinci Resolve Fusion advanced VFX tutorial breakdown"'),
        
        # COLOR
        run_scraper("YOUTUBE/COLOR", 'python youtube_scraper.py --url "ytsearch50:DaVinci Resolve color grading professional node tree breakdown"'),
        
        # SOUND
        run_scraper("YOUTUBE/SOUND", 'python youtube_scraper.py --url "ytsearch50:DaVinci Resolve Fairlight audio mastering dialogue mixing"'),

        # EDITING
        run_scraper("YOUTUBE/EDITING", 'python youtube_scraper.py --url "ytsearch50:DaVinci Resolve kinetic editing narrative pacing tutorial"'),

        # PHOTO
        run_scraper("YOUTUBE/PHOTO", 'python youtube_scraper.py --url "ytsearch50:DaVinci Resolve photo editing RAW stills grading tutorial"'),

        # MUSIC
        run_scraper("YOUTUBE/MUSIC", 'python youtube_scraper.py --url "ytsearch50:Music theory production FL Studio Ableton distribution"'),

        # PATREON (AI_CREATION)
        run_scraper("PATREON/AI_CREATION", 'python patreon_scraper.py --url "https://www.patreon.com/cw/jboogxcreative/posts"'),
        
        # PATREON (MICK_MUMPITZ)
        run_scraper("PATREON/MICK_MUMPITZ", 'python patreon_scraper.py --url "https://www.patreon.com/Mickmumpitz"'),
        
        # LEARNING PATHS (IBM, Coursera, Fast.ai, NVIDIA, DeepLearning.AI)
        run_scraper("LEARNING/CORTEX", 'python cortex_learning_harvester.py'),
        
        # AGENTIC ENTERPRISE: LAW & ETHICS
        run_scraper("YOUTUBE/LAW_ETHICS", 'python youtube_scraper.py --url "ytsearch50:Law and ethics legal framework corporate compliance AI regulations"'),
        
        # AGENTIC ENTERPRISE: BUSINESS & ECONOMICS
        run_scraper("YOUTUBE/BUSINESS_ECONOMICS", 'python youtube_scraper.py --url "ytsearch50:Macroeconomics market logic corporate finance business strategy"'),
        
        # AGENTIC ENTERPRISE: CYBERSECURITY & SYSTEMS
        run_scraper("YOUTUBE/CYBERSECURITY_SYSTEMS", 'python youtube_scraper.py --url "ytsearch50:Cybersecurity devops systems architecture zero trust network"')
    ]
    
    # Run all harvesters concurrently
    await asyncio.gather(*tasks)
    
    elapsed = time.time() - start_time
    print(f"\n[+] Swarm execution completed in {elapsed:.2f} seconds.")
    print("[+] All discipline data lakes updated on NAS.")

if __name__ == "__main__":
    asyncio.run(launch_parallel_swarm())
