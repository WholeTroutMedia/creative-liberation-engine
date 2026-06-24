#!/usr/bin/env python3
"""
Creative Liberation Engine V6: ExtremRaym API Harvester

This script fetches the comprehensive community-maintained DaVinci Resolve
Scripting API documentation from extremraym.com and saves it to the NAS.
"""

import os
import sys
import urllib.request
from urllib.error import URLError

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("[!] Missing required dependency: beautifulsoup4")
    print("    Install via: pip install beautifulsoup4")
    sys.exit(1)

# NAS Intake Target
NAS_ROOT = r"\\127.0.0.1\docker\genesis-deploy"
TARGET_DIR = os.path.join(NAS_ROOT, "media_intake", "Resolve_RAG_Data", "ExtremRaym")
TARGET_FILE = os.path.join(TARGET_DIR, "extremraym_api_docs.txt")

SOURCE_URL = "https://extremraym.com/cloud/resolve-scripting-doc/"

def harvest_extremraym_docs():
    print("=====================================================")
    print(" V6 SOVEREIGN MEDIA MESH - EXTREMRAYM HARVESTER      ")
    print("=====================================================")
    
    os.makedirs(TARGET_DIR, exist_ok=True)
    
    print(f"[*] Fetching API docs from: {SOURCE_URL}")
    
    try:
        req = urllib.request.Request(
            SOURCE_URL, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            html_content = response.read()
            
        print("[*] Parsing HTML content...")
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Extract text while preserving some structure
        text_content = soup.get_text(separator='\n', strip=True)
        
        with open(TARGET_FILE, 'w', encoding='utf-8') as f:
            f.write(text_content)
            
        print(f"[+] Successfully harvested raw text to: {TARGET_FILE}")
        
        print("[*] Initiating reasoning structurizer pipeline...")
        import reasoning_structurizer
        TARGET_STRUCTURED_FILE = os.path.join(TARGET_DIR, "extremraym_api_reasoning_chains.json")
        structured_data = reasoning_structurizer.structurize_text_to_reasoning_chains(text_content)
        reasoning_structurizer.save_structured_data(structured_data, TARGET_STRUCTURED_FILE)
        
    except URLError as e:
        print(f"[!] Failed to fetch URL: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[!] An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    harvest_extremraym_docs()
