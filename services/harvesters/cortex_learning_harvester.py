#!/usr/bin/env python3
"""
CORTEX Sovereign Learning Harvester
===================================
Automated Playwright ingestion for learning platforms initialized via cortex_signup_agent.py.
Extracts course content and dispatches to the NAS RAG database via the V6 Dispatch API.

Supported platforms:
- IBM SkillsBuild
- Coursera
- DeepLearning.AI
- NVIDIA DLI
- Anthropic
- fast.ai
"""

import asyncio
import os
import json
import time
import requests
import argparse
from datetime import datetime, timezone
from playwright.async_api import async_playwright, Page, BrowserContext, TimeoutError as PlaywrightTimeoutError
# Robust dynamic import for playwright-stealth versions
try:
    from playwright_stealth import stealth_async
    async def apply_stealth(page):
        await stealth_async(page)
except ImportError:
    try:
        from playwright_stealth import Stealth
        async def apply_stealth(page):
            s = Stealth()
            if hasattr(s, "apply_stealth_async"):
                await s.apply_stealth_async(page)
            else:
                s.apply_stealth(page)
    except ImportError:
        try:
            from playwright_stealth import stealth
            async def apply_stealth(page):
                import inspect
                res = stealth(page)
                if inspect.iscoroutine(res):
                    await res
        except ImportError:
            async def apply_stealth(page):
                print("[!] Warning: playwright-stealth not found. Skipping stealth masking.")


import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
try:
    import reasoning_structurizer
except ImportError:
    print("[!] Error: reasoning_structurizer not found.")
    reasoning_structurizer = None

# Identity
CORTEX_EMAIL = "inquiries@creativeliberationengine.org"
CORTEX_PASS = os.getenv("CORTEX_PASSWORD", "WholeTroutMedia!2026")

# NAS Configuration
NAS_RAG_DATA = r"\\127.0.0.1\docker\creative-liberation-engine\media_intake\Resolve_RAG_Data\Learning"
NAS_AUTH_DATA = r"\\127.0.0.1\docker\creative-liberation-engine\media_intake\Resolve_RAG_Data\Auth"
DISPATCH_URL = "http://127.0.0.1:5160/api/tasks"

def ensure_nas_directories():
    print(f"[*] Verifying NAS target directories...")
    os.makedirs(NAS_RAG_DATA, exist_ok=True)
    os.makedirs(NAS_AUTH_DATA, exist_ok=True)

def dispatch_ingestion_task(platform: str, file_path: str):
    """Dispatch webhook tracking to Creative Liberation Engine V6"""
    task_payload = {
        "project": "creative-liberation-engine",
        "workstream": "general",
        "title": f"[CORTEX] Ingest {platform} RAG chains",
        "description": f"Autonomously harvested reasoning chains from {platform} staged at {file_path}",
        "priority": "P1",
        "source": "cortex_learning",
        "metadata": {
            "platform": platform,
            "rag_path": file_path,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    }
    try:
        resp = requests.post(DISPATCH_URL, json=task_payload, timeout=5)
        if resp.status_code in (200, 201):
            print(f"  [+] Dispatch successful: {resp.json().get('task', {}).get('id', 'unknown')}")
        else:
            print(f"  [!] Dispatch failed: {resp.status_code}")
    except Exception as e:
        print(f"  [!] Dispatch error: {e}")

async def harvest_and_structurize(page: Page, platform: str):
    """Extract raw text from the page and run through structurizer"""
    print(f"  [*] Harvesting data from {platform}...")
    try:
        # Wait for potential rendering
        await page.wait_for_timeout(5000)
        
        # Grab all readable text from the body
        content = await page.evaluate("document.body.innerText")
        
        if not content or len(content.strip()) < 50:
            print(f"  [!] Insufficient content extracted for {platform}.")
            return
            
        print(f"  [*] Extracted {len(content)} characters. Structurizing...")
        
        if reasoning_structurizer:
            structured_data = reasoning_structurizer.structurize_text_to_reasoning_chains(content)
            safe_name = platform.lower().replace(" ", "_").replace(".", "")
            
            # Save raw and structured
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            target_json_path = os.path.join(NAS_RAG_DATA, f"{safe_name}_{timestamp}_chains.json")
            
            reasoning_structurizer.save_structured_data(structured_data, target_json_path)
            print(f"  [+] Saved structured RAG chains to {target_json_path}")
            
            # Dispatch task
            dispatch_ingestion_task(platform, target_json_path)
        else:
            print("  [!] Structurizer disabled. Skipping save.")
            
    except Exception as e:
        print(f"  [!] Harvesting error for {platform}: {e}")

async def autonomous_crawl(page: Page, platform: str, max_pages: int = 50):
    """Harvests the current page, finds the 'Next' button, and repeats."""
    print(f"\n  [>>>] Starting autonomous student crawl for {platform}")
    
    # Common text heuristics for Next buttons on learning platforms
    next_selectors = [
        "internal:role=button[name='Next'i]",
        "internal:role=button[name='Continue'i]",
        "internal:role=link[name='Next'i]",
        "internal:role=link[name='Continue'i]",
        "button:has-text('Next')",
        "button:has-text('Continue')",
        "a:has-text('Next')",
        "a:has-text('Continue')",
        "text='Next Lesson'",
        "text='Next Module'",
        "[aria-label*='Next'i]",
        "[aria-label*='Continue'i]",
        "button.next",
        "a.next"
    ]
    
    for i in range(max_pages):
        print(f"\n  [-] Crawl Page {i+1}/{max_pages}")
        await harvest_and_structurize(page, platform)
        
        clicked = False
        for selector in next_selectors:
            try:
                loc = page.locator(selector).first
                if await loc.count() > 0 and await loc.is_visible(timeout=1000):
                    print(f"  [>] Found next button via '{selector}'. Clicking...")
                    try:
                        # Sometimes regular click fails if an overlay is present
                        await loc.click(timeout=5000, force=True)
                        clicked = True
                    except Exception as click_err:
                        print(f"  [!] Click failed on '{selector}': {click_err}")
                        continue # Try the next selector if this one couldn't be clicked
                        
                    # Wait for navigation / video loading / DOM changes
                    await page.wait_for_timeout(5000)
                    try:
                        await page.wait_for_load_state("domcontentloaded", timeout=10000)
                    except:
                        pass # Ignore if it timed out, the DOM might just be heavy
                    break
            except Exception as e:
                # locator error (e.g. timeout on is_visible)
                pass
                
        if not clicked:
            print(f"  [!] No 'Next' or 'Continue' buttons found. Ending autonomous crawl for {platform}.")
            break

# --- Harvesting Modules ---

async def check_already_logged_in(page: Page, test_selector: str) -> bool:
    """Check if we're already logged in by looking for a dashboard element."""
    try:
        if await page.locator(test_selector).count() > 0:
            return True
        # Wait a brief moment to see if it renders
        await page.wait_for_selector(test_selector, timeout=3000)
        return True
    except PlaywrightTimeoutError:
        return False

async def handle_login_failure(page: Page, platform: str, e: Exception):
    """Save a screenshot for debugging headless login failures."""
    safe_name = platform.lower().replace(" ", "_").replace(".", "")
    err_img = os.path.join(NAS_AUTH_DATA, f"{safe_name}_failed_login.png")
    try:
        await page.screenshot(path=err_img)
        print(f"  [!] Saved error screenshot to: {err_img}")
    except Exception as img_e:
        print(f"  [!] Failed to save screenshot: {img_e}")
    print(f"  [!] Failed to harvest {platform}: {e}")

async def harvest_ibm(page: Page):
    platform = "IBM SkillsBuild"
    print(f"\n{'='*50}\n[CORTEX] Harvesting {platform}\n{'='*50}")
    try:
        await page.goto("https://skillsbuild.org/login", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        
        # Heuristic: if catalog link exists, we might be logged in
        if not await check_already_logged_in(page, "a[href*='catalog']"):
            print("  [*] Performing login sequence...")
            # Navigate directly to the IBMid sign-in URL to bypass the landing selector screen
            await page.goto("https://www.ibm.com/account/reg/us-en/login?formid=urx-54369", wait_until="domcontentloaded")
            await page.wait_for_timeout(3000)
            
            # IBMid uses username / text field instead of email type (ensure visible)
            email_loc = page.locator("input#username:visible, input[name='username']:visible, input[type='email']:visible, input[name*='mail']:visible").first
            await email_loc.fill(CORTEX_EMAIL)
            
            # Click Continue
            continue_btn = page.locator("button#continue-button, button:has-text('Continue')").first
            await continue_btn.click()
            await page.wait_for_timeout(2000)
            
            # Wait for password input field
            await page.wait_for_selector("input#password, input[type='password']", timeout=10000)
            pw_loc = page.locator("input#password, input[type='password']").first
            await pw_loc.fill(CORTEX_PASS)
                
            # Click Log in specifically
            submit_btn = page.locator("button#signinbutton, button:has-text('Log in'), button[type='submit']").first
            await submit_btn.click()
            await page.wait_for_timeout(8000) # Wait for dashboard load
            print("  [+] Login submitted.")
        else:
            print("  [+] Already authenticated via persistent context.")
        
        # Navigate to catalog
        await page.goto("https://skillsbuild.org/catalog", wait_until="domcontentloaded")
        await harvest_and_structurize(page, platform)
    except Exception as e:
        await handle_login_failure(page, platform, e)

async def harvest_coursera(page: Page):
    platform = "Coursera"
    print(f"\n{'='*50}\n[CORTEX] Harvesting {platform}\n{'='*50}")
    try:
        await page.goto("https://www.coursera.org/?authMode=login", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        
        if not await check_already_logged_in(page, "a[data-e2e='nav-user-profile']"):
            print("  [*] Performing login sequence...")
            email_loc = page.locator("input[type='email'], input[name*='mail']").first
            await email_loc.fill(CORTEX_EMAIL)
            
            # Click Continue
            continue_btn = page.locator("button:has-text('Continue')").first
            await continue_btn.click()
            
            # Wait for password input field
            await page.wait_for_selector("input[type='password']", timeout=10000)
            pw_loc = page.locator("input[type='password']").first
            await pw_loc.fill(CORTEX_PASS)
            
            submit_btn = page.locator("button:has-text('Next'), button:has-text('Log in'), button[data-e2e='login-submit']").first
            await submit_btn.click(force=True)
            await page.wait_for_timeout(8000)
            print("  [+] Login submitted.")
        else:
            print("  [+] Already authenticated via persistent context.")
 
        # Dashboard harvest
        await harvest_and_structurize(page, f"{platform} Dashboard")
    except Exception as e:
        await handle_login_failure(page, platform, e)

async def harvest_deeplearning_ai(page: Page):
    platform = "DeepLearning.AI"
    print(f"\n{'='*50}\n[CORTEX] Harvesting {platform}\n{'='*50}")
    try:
        await page.goto("https://learn.deeplearning.ai/login", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        
        if not await check_already_logged_in(page, "a[href*='logout'], button:has-text('Log Out')"):
            print("  [*] Performing login sequence...")
            # Wait for redirect to auth.deeplearning.ai
            try:
                await page.wait_for_selector("input[type='email'], input[id='email']", timeout=10000)
            except:
                pass
                
            email_loc = page.locator("input[type='email'], input[id='email'], input[name*='mail']").first
            await email_loc.fill(CORTEX_EMAIL)
            
            pw_loc = page.locator("input[type='password'], input[id='password']").first
            await pw_loc.fill(CORTEX_PASS)
            
            # Target "Sign in" button specifically to bypass Google/LinkedIn/Apple submit buttons
            submit_btn = page.locator("button:has-text('Sign in'), button:has-text('Log In')").first
            await submit_btn.click()
            await page.wait_for_timeout(8000)
            print("  [+] Login submitted.")
        else:
            print("  [+] Already authenticated via persistent context.")
        
        await harvest_and_structurize(page, platform)
    except Exception as e:
        await handle_login_failure(page, platform, e)

async def harvest_nvidia_dli(page: Page):
    platform = "NVIDIA DLI"
    print(f"\n{'='*50}\n[CORTEX] Harvesting {platform}\n{'='*50}")
    try:
        await page.goto("https://learn.nvidia.com/catalog", wait_until="domcontentloaded")
        await page.wait_for_timeout(5000)
        # Often public catalog is available
        await harvest_and_structurize(page, platform)
    except Exception as e:
        print(f"  [!] Failed to harvest {platform}: {e}")

async def harvest_fastai(page: Page):
    platform = "fast.ai"
    print(f"\n{'='*50}\n[CORTEX] Harvesting {platform}\n{'='*50}")
    try:
        await page.goto("https://course.fast.ai/", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        # Fast.ai course content is public
        await harvest_and_structurize(page, platform)
    except Exception as e:
        print(f"  [!] Failed to harvest {platform}: {e}")

# --- Orchestration ---

async def run_swarm(auth_only: bool = False, cdp: bool = False):
    print("\n" + "#"*60)
    print("  CORTEX LEARNING HARVESTER: CDP ORCHESTRATION MODE")
    print("#"*60 + "\n")
    print(f"  Identity : {CORTEX_EMAIL}")
    print(f"  Mode     : {'CDP (Active Browser)' if cdp else 'Auth-Only (Visible)' if auth_only else 'Headless Autonomous'}")
    print(f"  Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print("#"*60)

    ensure_nas_directories()
    
    # We use a real Chromium profile directory instead of just a storage_state JSON.
    # This persists IndexedDB, LocalStorage, Cookies, and browser history, drastically
    # improving resilience against anti-bot challenges like Cloudflare.
    profile_dir = os.path.join(NAS_AUTH_DATA, "cortex_chrome_profile")

    async with async_playwright() as p:
        if cdp:
            print("  [*] Connecting to active Chrome instance via CDP (port 9222)...")
            browser = await p.chromium.connect_over_cdp("http://127.0.0.1:9224")
            context = browser.contexts[0]
            context.set_default_timeout(60000)
            
            print(f"  [*] Found {len(context.pages)} open tabs. Harvesting existing tabs...")
            for page in context.pages:
                url = page.url.lower()
                if "skillsbuild" in url or "ibm.com" in url:
                    print(f"\n{'='*50}\n[CORTEX] Harvesting IBM SkillsBuild (from existing tab)\n{'='*50}")
                    await autonomous_crawl(page, "IBM SkillsBuild")
                elif "coursera" in url:
                    print(f"\n{'='*50}\n[CORTEX] Harvesting Coursera (from existing tab)\n{'='*50}")
                    await autonomous_crawl(page, "Coursera")
                elif "deeplearning.ai" in url:
                    print(f"\n{'='*50}\n[CORTEX] Harvesting DeepLearning.AI (from existing tab)\n{'='*50}")
                    await autonomous_crawl(page, "DeepLearning.AI")
                elif "nvidia.com" in url:
                    print(f"\n{'='*50}\n[CORTEX] Harvesting NVIDIA DLI (from existing tab)\n{'='*50}")
                    await autonomous_crawl(page, "NVIDIA DLI")
                elif "fast.ai" in url:
                    print(f"\n{'='*50}\n[CORTEX] Harvesting fast.ai (from existing tab)\n{'='*50}")
                    await autonomous_crawl(page, "fast.ai")
                else:
                    title = await page.title()
                    print(f"  [~] Ignoring unrecognized tab: {title} - {url[:60]}")
        else:
            context = await p.chromium.launch_persistent_context(
                user_data_dir=profile_dir,
                headless=not auth_only,
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800},
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-blink-features=AutomationControlled"
                ]
            )
            
            # Set a generous 60-second default timeout to survive slow Cloudflare checks
            context.set_default_timeout(60000)
            
            # When using persistent context, it launches with an initial blank page
            page = context.pages[0] if context.pages else await context.new_page()
            
            # Apply playwright-stealth to mask the webdriver signature from advanced bot detection
            await apply_stealth(page)

            if auth_only:
                print("\n[*] AUTH-ONLY MODE: Please manually solve any CAPTCHAs in the browser window.")
                print("[*] Script will pause for 120 seconds per platform.")

            # Execute Harvesters Sequentially
            for platform_func in [harvest_ibm, harvest_coursera, harvest_deeplearning_ai]:
                await platform_func(page)
                if auth_only:
                    print(f"[*] Pausing for manual login/verification (120s)...")
                    await page.wait_for_timeout(120000)

            if not auth_only:
                await harvest_nvidia_dli(page)
                await harvest_fastai(page)

        if not cdp:
            print(f"\n[+] Persistent session profile automatically synced to {profile_dir}")
            await context.close()
        else:
            print(f"\n[+] Finished harvesting via CDP. Leaving browser open.")
            await browser.close() # This closes the CDP connection, not the browser
        
    print("\n" + "="*60)
    print("  LEARNING SWARM CYCLE COMPLETE")
    print("="*60)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CORTEX Learning Harvester")
    parser.add_argument("--auth-only", action="store_true", help="Run with browser visible to manually solve CAPTCHAs and save session state.")
    parser.add_argument("--cdp", action="store_true", help="Connect to an already running Chrome instance on port 9222.")
    args = parser.parse_args()
    
    asyncio.run(run_swarm(auth_only=args.auth_only, cdp=args.cdp))
