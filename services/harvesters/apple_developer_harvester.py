#!/usr/bin/env python3
"""
CORTEX Apple Developer Harvester
================================
Automated Playwright ingestion for the public Apple Developer portal.
Extracts SwiftUI tutorials, Human Interface Guidelines (HIG), and CoreML/Combine docs,
structurizes them into reasoning chains, and generates Obsidian-ready Sovereign Academy Codex notes.

Pushes structured chains to the NAS RAG database and triggers the CORTEX webhook.
"""

import asyncio
import os
import json
import time
import requests
import argparse
import re
from datetime import datetime, timezone
from playwright.async_api import async_playwright, Page, BrowserContext, TimeoutError as PlaywrightTimeoutError
from playwright_stealth import Stealth

import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
try:
    import reasoning_structurizer
except ImportError:
    print("[!] Warning: reasoning_structurizer not found in local path.")
    reasoning_structurizer = None

# NAS Configuration
NAS_RAG_DATA = r"\\127.0.0.1\docker\creative-liberation-engine\media_intake\Sovereign_Academy_RAG\AppleDeveloper"
ACADEMY_CODEX_DIR = r"y:\creative-liberation-engine\academy\codex\apple-developer"
DISPATCH_URL = "http://127.0.0.1:5160/api/tasks"

DEFAULT_TARGETS = {
    "SwiftUI Tutorials": "https://developer.apple.com/tutorials/swiftui",
    "Human Interface Guidelines": "https://developer.apple.com/design/human-interface-guidelines",
    "CoreML": "https://developer.apple.com/documentation/coreml",
    "Combine": "https://developer.apple.com/documentation/combine"
}

def ensure_directories(dry_run: bool = False):
    print(f"[*] Verifying target directories...")
    if not dry_run:
        os.makedirs(NAS_RAG_DATA, exist_ok=True)
        os.makedirs(ACADEMY_CODEX_DIR, exist_ok=True)
    else:
        print(f"  [DRY-RUN] Would create directory: {NAS_RAG_DATA}")
        print(f"  [DRY-RUN] Would create directory: {ACADEMY_CODEX_DIR}")

def dispatch_ingestion_task(title: str, file_path: str, dry_run: bool = False):
    """Dispatch webhook tracking to Creative Liberation Engine V6"""
    task_payload = {
        "queue": "cortex_learning",
        "type": "apple_developer_ingest",
        "priority": "normal",
        "status": "pending",
        "payload": {
            "platform": "Apple Developer",
            "title": title,
            "rag_path": file_path,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    }
    if dry_run:
        print(f"  [DRY-RUN] Would dispatch task payload to {DISPATCH_URL}: {json.dumps(task_payload)}")
        return

    try:
        resp = requests.post(DISPATCH_URL, json=task_payload, timeout=5)
        if resp.status_code in (200, 201):
            print(f"  [+] Dispatch successful: {resp.json().get('id', 'unknown')}")
        else:
            print(f"  [!] Dispatch failed: {resp.status_code}")
    except Exception as e:
        print(f"  [!] Dispatch error (non-blocking for local run): {e}")

def sanitize_filename(name: str) -> str:
    return re.sub(r'[^a-z0-9_\-]', '', name.lower().replace(" ", "_").replace("/", "_"))

def write_obsidian_note(title: str, url: str, summary: str, raw_content: str, dry_run: bool = False):
    """Writes an Obsidian-compatible Markdown note to the Sovereign Academy Codex with strict V6 Memory Schema compliance"""
    safe_title = sanitize_filename(title)
    memory_id = f"mem_apple_dev_{safe_title}"
    current_time = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    frontmatter = f"""---
memoryId: "{memory_id}"
kind: "artifact"
title: "Apple Developer: {title}"
summary: "{summary[:300].replace('"', '\\"')}..."
source: "KI"
provenance:
  recordedBy: "apple_developer_harvester"
  recordedAt: "{current_time}"
confidence: 0.95
retentionClass: "canonical"
tags:
  - "apple"
  - "swiftui"
  - "ios-dev"
  - "cortex-learning"
createdAt: "{current_time}"
updatedAt: "{current_time}"
lifecycleState: "active"
---

# Apple Developer: {title}

**Source URL:** [{url}]({url})
**Harvest Timestamp:** `{current_time}`

## Executive Summary
{summary}

## Extracted Documentation Reference
{raw_content[:8000]}
"""

    note_path = os.path.join(ACADEMY_CODEX_DIR, f"{safe_title}.md")
    
    if dry_run:
        print(f"  [DRY-RUN] Would write Obsidian note ({len(frontmatter)} bytes) to: {note_path}")
        return

    try:
        with open(note_path, "w", encoding="utf-8") as f:
            f.write(frontmatter)
        print(f"  [+] Saved Obsidian Codex Note to {note_path}")
    except Exception as e:
        print(f"  [!] Failed to save Obsidian note: {e}")

async def harvest_and_structurize(page: Page, title: str, url: str, dry_run: bool = False):
    """Extract raw text, run through GPU-aware structurizer, and save output"""
    print(f"  [*] Harvesting data from {title}...")
    try:
        # Wait for page to fully render
        await page.wait_for_timeout(3000)
        
        # Grab main text of document
        content = await page.evaluate("document.body.innerText")
        
        if not content or len(content.strip()) < 50:
            print(f"  [!] Insufficient content extracted for {title}.")
            return
            
        print(f"  [*] Extracted {len(content)} characters. Structurizing...")
        
        # Generate summary
        words = content.split()
        summary = " ".join(words[:120]) + "..."
        
        if dry_run:
            print(f"  [DRY-RUN] Would process text structurization for {title}.")
            write_obsidian_note(title, url, summary, content, dry_run=True)
            return

        # Write Codex markdown note first
        write_obsidian_note(title, url, summary, content, dry_run=False)

        # Structurize to reasoning chains (JSON RAG staging)
        if reasoning_structurizer:
            structured_data = reasoning_structurizer.structurize_text_to_reasoning_chains(content)
            safe_name = sanitize_filename(title)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            target_json_path = os.path.join(NAS_RAG_DATA, f"{safe_name}_{timestamp}_chains.json")
            
            reasoning_structurizer.save_structured_data(structured_data, target_json_path)
            print(f"  [+] Saved structured RAG chains to {target_json_path}")
            
            # Dispatch task to the ingestion worker
            dispatch_ingestion_task(title, target_json_path)
        else:
            # Fallback if reasoning_structurizer not loaded
            safe_name = sanitize_filename(title)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            target_json_path = os.path.join(NAS_RAG_DATA, f"{safe_name}_{timestamp}_fallback.json")
            
            fallback_payload = {
                "title": title,
                "url": url,
                "summary": summary,
                "raw_text": content,
                "harvested_at": datetime.now(timezone.utc).isoformat()
            }
            with open(target_json_path, "w", encoding="utf-8") as f:
                json.dump(fallback_payload, f, indent=2)
            print(f"  [~] Saved unstructured fallback RAG JSON to {target_json_path}")
            
            dispatch_ingestion_task(title, target_json_path)
            
    except Exception as e:
        print(f"  [!] Harvesting error for {title}: {e}")

async def run_harvester(targets: dict, limit: int = 5, dry_run: bool = False):
    print("\n" + "#"*60)
    print("  CORTEX APPLE DEVELOPER LEARNING HARVESTER")
    print("#"*60 + "\n")
    print(f"  Mode     : {'DRY-RUN' if dry_run else 'ACTIVE WRITES'}")
    print(f"  Targets  : {list(targets.keys())}")
    print(f"  Limit    : {limit} pages")
    print(f"  Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print("#"*60)

    ensure_directories(dry_run)

    async with async_playwright() as p:
        print("  [*] Launching headless Chromium browser...")
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-blink-features=AutomationControlled"
            ]
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )
        context.set_default_timeout(45000)
        
        page = await context.new_page()
        await Stealth().apply_stealth_async(page)

        for name, url in targets.items():
            print(f"\n{'='*50}\n[CORTEX] Accessing: {name} ({url})\n{'='*50}")
            try:
                await page.goto(url, wait_until="domcontentloaded")
                await harvest_and_structurize(page, name, url, dry_run=dry_run)
                
                # Check for sub-links if we are under the limit
                if limit > 1:
                    print("  [*] Searching for related sub-links inside the page...")
                    links = await page.locator("a[href^='/tutorials/'], a[href^='/design/'], a[href*='/documentation/']").all_hrefs()
                    # Deduplicate and filter absolute URLs
                    sub_urls = []
                    for l in links:
                        full_url = l if l.startswith("http") else f"https://developer.apple.com{l}"
                        if full_url not in sub_urls and full_url != url:
                            sub_urls.append(full_url)
                    
                    sub_urls = sub_urls[:limit - 1]
                    print(f"  [+] Found {len(sub_urls)} sub-links to crawl.")
                    
                    for sub_idx, sub_url in enumerate(sub_urls):
                        sub_name = f"{name} - Part {sub_idx + 1}"
                        print(f"\n  [~] Crawling sub-link {sub_idx + 1}/{len(sub_urls)}: {sub_url}")
                        try:
                            await page.goto(sub_url, wait_until="domcontentloaded")
                            await harvest_and_structurize(page, sub_name, sub_url, dry_run=dry_run)
                        except Exception as sub_err:
                            print(f"  [!] Failed to crawl {sub_url}: {sub_err}")
                            
            except Exception as e:
                print(f"  [!] Failed to load target {name}: {e}")

        await context.close()
        await browser.close()
        
    print("\n" + "="*60)
    print("  APPLE DEVELOPER LEARNING HARVEST SWEEP COMPLETE")
    print("="*60)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Apple Developer Learning Harvester")
    parser.add_argument("--url", help="Target a specific Apple Developer URL instead of defaults")
    parser.add_argument("--limit", type=int, default=3, help="Max pages/sub-links to crawl (default 3)")
    parser.add_argument("--dry-run", action="store_true", help="Perform a dry-run crawl logging output without writing to NAS or Codex")
    args = parser.parse_args()

    targets = DEFAULT_TARGETS
    if args.url:
        targets = {"Custom Target": args.url}

    asyncio.run(run_harvester(targets=targets, limit=args.limit, dry_run=args.dry_run))
