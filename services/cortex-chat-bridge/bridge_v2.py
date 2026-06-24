#!/usr/bin/env python3
"""
CORTEX Chat Bridge V2 — Sovereign Playwright/CDP Edition
=========================================================
Bridges Google Chat ↔ NAS Dispatch via Chrome DevTools Protocol.
Connects to the existing cortex-browser (LinuxServer Chromium) at port 9222.
CORTEX is logged in as inquiries@creativeliberationengine.org — a regular Google user
on the Family Ultra plan.

Flow:
  1. Connects to cortex-browser via CDP (ws://cortex-browser:9222)
  2. Opens Google Chat tab (CORTEX already logged in via persistent session)
  3. Polls for new messages every POLL_INTERVAL seconds
  4. Forwards new messages to DISPATCH_URL/api/chat
  5. Types dispatch responses back into the Chat window
"""

import os
import sys
import time
import json
import logging
import hashlib
import requests
import asyncio
from datetime import datetime, timezone

from playwright.async_api import async_playwright, Page, Browser, BrowserContext

# ── Config ──────────────────────────────────────────────────────────
CDP_URL = os.getenv("CDP_URL", "http://cortex-browser:9223")
DISPATCH_URL = os.getenv("DISPATCH_URL", "http://127.0.0.1:5160")
GENKIT_API_KEY = os.getenv("GENKIT_API_KEY", "")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))
CHAT_URL = "https://chat.google.com/app/home"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
MAX_RESPONSE_LEN = 2000  # Google Chat message length limit

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s [CORTEX-BRIDGE] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("cortex-bridge")

SEEN_FILE = "/app/data/seen_messages.json"

# Track messages we've already processed (hash → timestamp)
seen_messages: dict[str, float] = {}

def load_seen():
    global seen_messages
    if os.path.exists(SEEN_FILE):
        try:
            with open(SEEN_FILE, "r") as f:
                seen_messages = json.load(f)
            log.info(f"Loaded {len(seen_messages)} seen messages from {SEEN_FILE}")
        except Exception as e:
            log.error(f"Error loading seen messages: {e}")

def save_seen():
    try:
        os.makedirs(os.path.dirname(SEEN_FILE), exist_ok=True)
        with open(SEEN_FILE, "w") as f:
            json.dump(seen_messages, f)
    except Exception as e:
        log.error(f"Error saving seen messages: {e}")

def prune_seen():
    """Remove old entries from seen_messages if the dictionary grows too large."""
    if len(seen_messages) > 1000:
        sorted_keys = sorted(seen_messages.keys(), key=lambda k: seen_messages[k])
        # Delete the oldest ones to keep the newest 1000
        for k in sorted_keys[:-1000]:
            del seen_messages[k]
        save_seen()


def resolve_cdp_url(url: str) -> str:
    """Resolve hostname to IP in CDP URL.
    
    Chrome DevTools Protocol rejects connections where the Host header
    contains a hostname rather than an IP address or 'localhost'.
    The socat proxy at 9223 forwards to Chrome on 127.0.0.1:9222 but
    Chrome still validates the Host header from the incoming request.
    """
    import socket
    from urllib.parse import urlparse, urlunparse
    parsed = urlparse(url)
    hostname = parsed.hostname
    port = parsed.port or 9223
    try:
        ip = socket.gethostbyname(hostname)
        resolved = urlunparse(parsed._replace(netloc=f"{ip}:{port}"))
        log.info(f"Resolved CDP URL: {url} → {resolved}")
        return resolved
    except socket.gaierror:
        log.warning(f"Could not resolve {hostname}, using original URL")
        return url


async def connect_cdp(pw) -> Browser:
    """Connect to cortex-browser via CDP with retries."""
    cdp_endpoint = resolve_cdp_url(CDP_URL)
    for attempt in range(20):
        try:
            browser = await pw.chromium.connect_over_cdp(cdp_endpoint)
            log.info(f"✓ Connected to CDP at {cdp_endpoint}")
            return browser
        except Exception as e:
            log.warning(f"CDP connection attempt {attempt+1}/20 failed: {e}")
            await asyncio.sleep(5)
    raise RuntimeError(f"Could not connect to CDP at {cdp_endpoint} after 20 attempts")


async def find_or_open_chat(browser: Browser) -> Page:
    """Find an existing Google Chat tab or open a new one."""
    contexts = browser.contexts
    
    # Search all existing tabs for Google Chat
    for ctx in contexts:
        for page in ctx.pages:
            try:
                if "chat.google.com" in page.url:
                    log.info(f"✓ Found existing Chat tab: {page.url}")
                    await page.bring_to_front()
                    # Only redirect if on a non-main subpage (mentions, search, etc.)
                    # /app/home is the main chat list — keep it there
                    non_main = ["/app/mentions", "/app/search", "/search"]
                    if any(sub in page.url for sub in non_main):
                        log.info(f"Navigating away from {page.url} to main chat...")
                        await page.goto(CHAT_URL, wait_until="domcontentloaded")
                        await asyncio.sleep(5)
                    return page
            except Exception:
                continue
    
    # No Chat tab found — open one in the first context
    if contexts and contexts[0].pages:
        ctx = contexts[0]
    else:
        log.warning("No browser contexts found. Creating new page...")
        ctx = contexts[0] if contexts else await browser.new_context()
    
    log.info("Opening new Google Chat tab...")
    page = await ctx.new_page()
    await page.goto(CHAT_URL, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)
    
    url = page.url
    if "chat.google.com" in url:
        log.info(f"✓ Google Chat opened: {url}")
        return page
    elif "workspace.google.com" in url or "accounts.google.com" in url:
        log.error(f"Not logged in — redirected to: {url}")
        raise RuntimeError(
            "CORTEX is not logged into Google. "
            "Please login manually via noVNC at http://127.0.0.1:3100"
        )
    else:
        log.warning(f"Unexpected URL after opening Chat: {url}")
        return page


async def check_logged_in(page: Page) -> bool:
    """Verify CORTEX is logged into Google Chat."""
    url = page.url
    if "accounts.google.com" in url:
        return False
    if "workspace.google.com/products/chat" in url:
        return False  # Marketing page = not logged in
    
    # If we are on chat.google.com, Google has authenticated us
    # (unauthenticated users are forcefully redirected)
    if "chat.google.com" in url:
        return True
        
    return False


async def get_conversations_with_unread(page: Page) -> list[dict]:
    """Find conversations with unread indicators."""
    unread = []
    try:
        # Diagnostic: count all conversation list items
        all_items = await page.query_selector_all(
            '[role="listitem"], [role="treeitem"], [data-is-read]'
        )
        log.debug(f"DOM diag: {len(all_items)} listitem/treeitem/data-is-read elements found")
        
        # Google Chat marks unread conversations with bold text or unread badges
        items = await page.query_selector_all(
            '[data-is-read="false"], '
            '[aria-label*="unread" i], '
            'span[data-is-unread="true"]'
        )
        if items:
            log.info(f"Found {len(items)} unread indicator elements")
        for item in items:
            try:
                # Find the parent listitem or treeitem for a more stable click target
                parent_handle = await item.evaluate_handle('''
                    (el) => {
                        let parent = el.parentElement;
                        while (parent && parent.getAttribute('role') !== 'listitem' && parent.getAttribute('role') !== 'treeitem') {
                            parent = parent.parentElement;
                        }
                        return parent;
                    }
                ''')
                parent_el = parent_handle.as_element()
                
                # If it's not inside a conversation list item, ignore it
                if not parent_el:
                    continue
                    
                # If the conversation item is not actually visible, ignore it
                if not await parent_el.is_visible():
                    continue

                label = await item.get_attribute("aria-label") or await item.inner_text()
                unread.append({"element": parent_el, "label": (label or "").strip()[:100]})
            except Exception:
                continue
    except Exception as e:
        log.debug(f"Error scanning unread: {e}")
    return unread


async def get_visible_messages(page: Page, count: int = 10) -> list[dict]:
    """Extract recent messages from the currently open conversation."""
    messages = []
    try:
        # Google Chat message containers
        msg_elements = await page.query_selector_all(
            '[data-message-id], '
            '[role="listitem"][data-local-message-id], '
            'div[data-message-text]'
        )
        if not msg_elements:
            # Diagnostic: try broader selectors to see what's on the page
            broad = await page.query_selector_all('[role="listitem"]')
            log.debug(f"DOM diag: 0 message elements, {len(broad)} generic listitems on page")
        for el in msg_elements[-count:]:
            try:
                text = (await el.inner_text()).strip()
                if not text:
                    continue
                msg_id = await el.get_attribute("data-message-id") or ""
                msg_hash = hashlib.md5(
                    (msg_id + text[:200]).encode()
                ).hexdigest()
                messages.append({
                    "text": text,
                    "hash": msg_hash,
                    "id": msg_id,
                    "element": el,
                })
            except Exception:
                continue
    except Exception as e:
        log.debug(f"Error reading messages: {e}")
    return messages


def forward_to_dispatch(message_text: str, sender: str = "unknown") -> str:
    """Forward a message to the NAS dispatch server as a task.
    
    Creates a dispatch task with the chat message content. Agents monitoring
    the dispatch queue will pick up and process the task.
    """
    payload = {
        "title": f"[Google Chat] Message from {sender}",
        "description": message_text,
        "source": "google-chat",
        "priority": "high",
        "metadata": {
            "sender": sender,
            "agent": "CORTEX",
            "channel": "google-chat",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }
    headers = {"Content-Type": "application/json"}
    if GENKIT_API_KEY:
        headers["x-api-key"] = GENKIT_API_KEY

    try:
        log.info(f"→ Dispatch task: {message_text[:80]}...")
        resp = requests.post(
            f"{DISPATCH_URL}/api/tasks",
            json=payload,
            headers=headers,
            timeout=55,
        )
        resp.raise_for_status()
        data = resp.json()
        task_id = data.get("task", {}).get("id") or data.get("id") or data.get("task_id") or "unknown"
        log.info(f"← Dispatch: Task created → {task_id}")
        return f"[CORTEX] Message received and queued as task {task_id}."
    except requests.exceptions.ConnectionError:
        log.error(f"Cannot reach dispatch at {DISPATCH_URL}")
        return "[CORTEX] Dispatch unreachable — NAS dispatch may be down."
    except Exception as e:
        log.error(f"Dispatch error: {e}")
        return f"[CORTEX] Error: {str(e)[:100]}"


async def send_chat_message(page: Page, text: str) -> bool:
    """Type and send a message in the current Chat conversation."""
    try:
        # Find the input box — Google Chat uses contenteditable divs
        input_box = await page.wait_for_selector(
            '[aria-label*="message" i][contenteditable="true"], '
            '[aria-label*="Send a message" i], '
            'div[contenteditable="true"][role="textbox"]',
            timeout=10000,
        )
        if not input_box:
            log.error("Could not find Chat input box")
            return False

        await input_box.focus()
        await input_box.click(force=True)
        await asyncio.sleep(0.3)

        # Type the message (line by line for multi-line)
        for i, line in enumerate(text.split("\n")):
            if i > 0:
                await page.keyboard.down("Shift")
                await page.keyboard.press("Enter")
                await page.keyboard.up("Shift")
            await input_box.type(line, delay=10)

        # Press Enter to send
        await page.keyboard.press("Enter")
        await asyncio.sleep(1)
        log.info(f"✓ Sent response ({len(text)} chars)")
        return True
    except Exception as e:
        log.error(f"Failed to send message: {e}")
        return False


async def check_and_accept_requests(page: Page):
    """Detect and accept pending message requests."""
    try:
        reqs = await page.query_selector_all('[aria-label*="Message request" i]')
        for req in reqs:
            if not await req.is_visible():
                continue
            log.info("Found message request. Attempting to accept...")
            box = await req.bounding_box()
            if box:
                await page.mouse.click(box['x'] + box['width']/2, box['y'] + box['height']/2)
            
            log.info("Waiting for network idle after clicking message request...")
            try:
                await page.wait_for_load_state('networkidle', timeout=5000)
            except Exception as e:
                log.debug(f"Network idle timeout: {e}")
            await asyncio.sleep(2)
            
            try:
                accept = await page.query_selector('button:has-text("Accept"), div[role="button"]:has-text("Accept"), span:has-text("Accept")')
                if accept and await accept.is_visible():
                    log.info("Clicking Accept via mouse coordinates...")
                    box = await accept.bounding_box()
                    if box:
                        await page.mouse.click(box['x'] + box['width']/2, box['y'] + box['height']/2)
                    await asyncio.sleep(3)
                    log.info("✓ Message request accepted.")
                else:
                    log.info("Accept button not found after clicking request.")
            except Exception as e:
                log.warning(f"Error finding/clicking Accept button: {e}")
    except Exception as e:
        log.warning(f"Error checking message requests: {e}")


async def poll_loop(page: Page):
    """Main polling loop — watches for new messages and responds."""
    log.info(f"Starting poll loop (interval: {POLL_INTERVAL}s)")
    consecutive_errors = 0
    poll_count = 0

    while True:
        try:
            poll_count += 1
            if poll_count % 5 == 0:
                prune_seen()
                log.info(f"Poll #{poll_count}, tracking {len(seen_messages)} messages")

            # Check if we're still on Chat
            if "chat.google.com" not in page.url:
                log.warning(f"Drifted from Chat to: {page.url}")
                await page.goto(CHAT_URL, wait_until="domcontentloaded", timeout=30000)
                await asyncio.sleep(5)

            # Scan for unread conversations
            if poll_count == 1:
                html = await page.content()
                with open('/app/chat_dom.html', 'w', encoding='utf-8') as f:
                    f.write(html)
                log.info("DOM dumped to /app/chat_dom.html")

            # Check and accept any pending message requests
            await check_and_accept_requests(page)

            unreads = await get_conversations_with_unread(page)
            if unreads:
                log.info(f"Found {len(unreads)} unread conversation(s)")
                for conv in unreads:
                    try:
                        await conv["element"].click()
                        await asyncio.sleep(2)
                        
                        # Read messages in this conversation
                        messages = await get_visible_messages(page)
                        for msg in messages:
                            if msg["hash"] in seen_messages:
                                continue
                            seen_messages[msg["hash"]] = time.time()
                            save_seen()
                            text = msg["text"]
                            
                            # Skip our own messages
                            if text.startswith("[CORTEX]"):
                                continue
                            
                            # Parse sender from message format
                            lines = text.split("\n")
                            sender = lines[0] if len(lines) > 1 else "unknown"
                            body = "\n".join(lines[1:]) if len(lines) > 1 else text
                            
                            log.info(f"New message from {sender}: {body[:60]}...")
                            response = forward_to_dispatch(body, sender)
                            await send_chat_message(page, response)
                    except Exception as e:
                        log.warning(f"Error processing conversation: {e}")

            # Also check current conversation for new messages
            log.info(f"Poll #{poll_count} - Checking current conversation for new messages...")
            messages = await get_visible_messages(page)
            for msg in messages:
                if msg["hash"] in seen_messages:
                    continue
                seen_messages[msg["hash"]] = time.time()
                save_seen()
                text = msg["text"]
                if text.startswith("[CORTEX]"):
                    continue
                
                lines = text.split("\n")
                sender = lines[0] if len(lines) > 1 else "unknown"
                body = "\n".join(lines[1:]) if len(lines) > 1 else text
                
                log.info(f"New message: {body[:60]}...")
                response = forward_to_dispatch(body, sender)
                await send_chat_message(page, response)

            consecutive_errors = 0
            await asyncio.sleep(POLL_INTERVAL)

        except Exception as e:
            consecutive_errors += 1
            log.error(f"Poll error ({consecutive_errors}/10): {e}")
            if consecutive_errors >= 10:
                log.critical("Too many consecutive errors. Breaking poll loop.")
                return
            await asyncio.sleep(POLL_INTERVAL * 2)


async def main():
    """Entry point — connect via CDP → find Chat → poll."""
    log.info("=" * 60)
    log.info("CORTEX Chat Bridge V2 — Playwright/CDP Edition")
    log.info(f"  CDP:      {CDP_URL}")
    log.info(f"  Dispatch: {DISPATCH_URL}")
    log.info(f"  Poll:     {POLL_INTERVAL}s")
    log.info("=" * 60)
    
    load_seen()

    while True:
        try:
            async with async_playwright() as pw:
                # Step 1: Connect to existing browser via CDP
                browser = await connect_cdp(pw)

                # Step 2: Find or open Google Chat tab
                page = await find_or_open_chat(browser)

                # Step 3: Verify login
                if not await check_logged_in(page):
                    log.error(
                        "CORTEX is NOT logged into Google Chat. "
                        "Please login manually via noVNC at http://127.0.0.1:3100 "
                        "and then restart this service."
                    )
                    await asyncio.sleep(60)
                    continue

                log.info("✓ CORTEX is logged into Google Chat")

                # Step 4: Poll for messages
                await poll_loop(page)

        except RuntimeError as e:
            log.error(f"Fatal: {e}")
            log.info("Retrying in 60s...")
            await asyncio.sleep(60)
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            log.info("Retrying in 30s...")
            await asyncio.sleep(30)


if __name__ == "__main__":
    asyncio.run(main())
