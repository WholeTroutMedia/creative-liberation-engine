#!/usr/bin/env python3
"""CORTEX Chat Bridge V3 — Playwright/CDP Edition.

Monitors Google Chat for messages via CDP connection to cortex-browser,
forwards them to the Creative Liberation Engine dispatch server, and sends replies
back through the Chat UI.

DOM selectors updated 2026-05-12 for current Google Chat layout.
"""

import asyncio
import hashlib
import logging
import os
import time
from datetime import datetime, timezone

import requests
from playwright.async_api import Browser, Page, async_playwright

# ─── Configuration ──────────────────────────────────────────────
CDP_URL = os.environ.get("CDP_URL", "http://cortex-browser:9223")
DISPATCH_URL = os.environ.get("DISPATCH_URL", "http://genesis-deploy-dispatch-1:5050")
GENKIT_API_KEY = os.environ.get("GENKIT_API_KEY", "")
CHAT_URL = "https://chat.google.com/app/home"
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "5"))
MAX_RESPONSE_LEN = 4000
CORTEX_EMAIL = "inquiries@creativeliberationengine.org"
CORTEX_PASSWORD = "WholeTroutMedia!2026"

# ─── Logging ────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if os.environ.get("DEBUG") else logging.INFO,
    format="%(asctime)s [CORTEX-BRIDGE] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("cortex-bridge")

# Track messages we've already processed (hash → timestamp)
seen_messages: dict[str, float] = {}
SEEN_FILE = "/app/data/seen_messages.json"

def load_seen():
    global seen_messages
    if os.path.exists(SEEN_FILE):
        try:
            import json
            with open(SEEN_FILE, "r") as f:
                seen_messages = json.load(f)
            log.info(f"Loaded {len(seen_messages)} seen messages from {SEEN_FILE}")
        except Exception as e:
            log.error(f"Error loading seen messages: {e}")

def save_seen():
    try:
        import json
        os.makedirs(os.path.dirname(SEEN_FILE), exist_ok=True)
        with open(SEEN_FILE, "w") as f:
            json.dump(seen_messages, f)
    except Exception as e:
        log.error(f"Error saving seen messages: {e}")

def prune_seen():
    """Remove old entries from seen_messages if it grows too large."""
    if len(seen_messages) > 1000:
        sorted_keys = sorted(seen_messages.keys(), key=lambda k: seen_messages[k])
        # Delete the oldest ones to keep the newest 1000
        for k in sorted_keys[:-1000]:
            del seen_messages[k]
        save_seen()


def resolve_cdp_url(url: str) -> str:
    """Resolve hostname to IP in CDP URL."""
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
    
    for ctx in contexts:
        for page in ctx.pages:
            try:
                if "chat.google.com" in page.url:
                    log.info(f"✓ Found existing Chat tab: {page.url}")
                    await page.bring_to_front()
                    return page
            except Exception:
                continue
    
    if contexts and contexts[0].pages:
        ctx = contexts[0]
    else:
        ctx = contexts[0] if contexts else await browser.new_context()
    
    log.info("Opening new Google Chat tab...")
    page = await ctx.new_page()
    await page.goto(CHAT_URL, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(5)
    
    url = page.url
    if "chat.google.com" in url:
        log.info(f"✓ Google Chat opened: {url}")
        return page
    elif "accounts.google.com" in url:
        log.warning("Session expired — attempting automated re-login...")
        login_ok = await auto_login(page)
        if login_ok:
            return page
        raise RuntimeError("Auto-login failed. Manual intervention needed.")
    else:
        log.warning(f"Unexpected URL after opening Chat: {url}")
        return page


async def auto_login(page: Page) -> bool:
    """Automatically re-login using CORTEX credentials."""
    try:
        log.info("Starting auto-login flow...")
        
        await page.goto(
            "https://accounts.google.com/signin/v2/identifier"
            "?continue=https%3A%2F%2Fchat.google.com%2F",
            wait_until="networkidle"
        )
        await asyncio.sleep(2)
        
        # Account chooser — click existing CORTEX account
        if "accountchooser" in page.url:
            log.info("Account chooser detected — clicking CORTEX account...")
            try:
                await page.get_by_text(CORTEX_EMAIL).click()
                await asyncio.sleep(3)
            except Exception:
                log.info("CORTEX not in chooser, using 'Use another account'")
                await page.get_by_text("Use another account").click()
                await asyncio.sleep(2)
        
        # Email input (only if visible)
        email_input = page.locator("input[type='email']").locator("visible=true")
        if await email_input.count() > 0:
            log.info("Entering email...")
            await email_input.fill(CORTEX_EMAIL)
            await page.keyboard.press("Enter")
            await asyncio.sleep(3)
        
        # Password input (only if visible)
        password_input = page.locator("input[type='password']").locator("visible=true")
        if await password_input.count() > 0:
            log.info("Entering password...")
            await password_input.fill(CORTEX_PASSWORD)
            await page.keyboard.press("Enter")
            await asyncio.sleep(5)
        
        # Check result
        if "chat.google.com" in page.url:
            log.info("✓ Auto-login successful!")
            # Dismiss notifications popup
            try:
                await page.locator("text=Disable").click(timeout=3000)
            except Exception:
                pass
            # Accept chat request if present
            try:
                await page.locator("text=Accept").click(timeout=3000)
            except Exception:
                pass
            return True
        
        content = await page.content()
        if "Verify it" in content or "captcha" in content.lower():
            log.error("Google requires verification — manual login needed via noVNC")
            return False
        
        log.warning(f"Post-login URL: {page.url} — checking if usable...")
        await page.goto(CHAT_URL, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(3)
        return "chat.google.com" in page.url
        
    except Exception as e:
        log.error(f"Auto-login error: {e}")
        return False


async def check_logged_in(page: Page) -> bool:
    """Verify CORTEX is logged into Google Chat."""
    url = page.url
    if "accounts.google.com" in url:
        return False
    if "workspace.google.com/products/chat" in url:
        return False
    if "chat.google.com" in url:
        return True
    return False


async def dismiss_popups(page: Page):
    """Dismiss any notification/request popups blocking the UI.
    
    Uses query_selector with evaluate to avoid hanging on locator().count()
    which can block indefinitely in Google Chat's heavy DOM.
    """
    # Use JS evaluation for speed — no Playwright locator overhead
    try:
        dismissed = await page.evaluate('''() => {
            const results = [];
            // Look for notification/popup buttons
            const buttons = document.querySelectorAll('button, [role="button"]');
            for (const btn of buttons) {
                const text = (btn.textContent || '').trim();
                if (text === 'Disable' || text === 'Accept' || text === 'No thanks' || text === 'Dismiss') {
                    try {
                        btn.click();
                        results.push(text);
                    } catch(e) {}
                }
            }
            return results;
        }''')
        if dismissed:
            log.info(f"Dismissed popups: {dismissed}")
            await asyncio.sleep(1)
    except Exception as e:
        log.debug(f"dismiss_popups: {e}")


async def navigate_to_dm(page: Page):
    """Navigate into the DM with Sovereign Artist if we're on the home view."""
    try:
        url = page.url
        # If we're already in a chat conversation, stay there
        if "/app/chat/" in url or "/dm/" in url:
            return
        
        # Try to click the Sovereign Artist DM in the sidebar
        dm_link = page.locator("a[href*='dm/'], a[href*='chat/']").filter(
            has_text="Artist"
        ).first
        if await dm_link.count() > 0:
            await dm_link.click()
            await asyncio.sleep(2)
            log.info("Navigated to Sovereign Artist DM")
    except Exception as e:
        log.debug(f"navigate_to_dm: {e}")


async def get_conversations_with_unread(page: Page) -> list[dict]:
    """Find conversations with unread indicators."""
    unread = []
    try:
        all_items = await page.query_selector_all(
            '[role="listitem"], [role="treeitem"], [data-is-read]'
        )
        log.debug(f"DOM diag: {len(all_items)} listitem/treeitem/data-is-read elements found")
        
        items = await page.query_selector_all(
            '[data-is-read="false"], '
            '[aria-label*="unread" i], '
            'span[data-is-unread="true"]'
        )
        if items:
            log.info(f"Found {len(items)} unread indicator elements")
        for item in items:
            try:
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
                
                if not parent_el:
                    continue
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
    """Extract recent messages from the currently open conversation.
    
    Updated 2026-05-12 for current Google Chat DOM structure:
      - Message groups:  div.nF6pT[data-id][role="group"]
      - Message body:    div.Zc1Emd  (inside div.oGsu4)
      - Sender heading:  span[data-message-id][role="heading"]
      - Also:            c-wiz.ajCeRb  (top-level message wrappers)
    """
    messages = []
    try:
        # Primary selector: message group containers with data-id
        msg_groups = await page.query_selector_all(
            'div.nF6pT[data-id][role="group"]'
        )
        
        # Fallback: try c-wiz message wrappers
        if not msg_groups:
            msg_groups = await page.query_selector_all('c-wiz.ajCeRb')
        
        # Fallback 2: try the old selectors too
        if not msg_groups:
            msg_groups = await page.query_selector_all(
                '[data-message-id], '
                '[role="listitem"][data-local-message-id], '
                'div[data-message-text]'
            )
        
        if not msg_groups:
            broad = await page.query_selector_all('[role="listitem"]')
            log.debug(f"DOM diag: 0 message elements, {len(broad)} generic listitems on page")
            return messages
        
        log.debug(f"Found {len(msg_groups)} message group elements")
        
        for el in msg_groups[-count:]:
            try:
                # Extract sender from heading span
                sender = "unknown"
                sender_el = await el.query_selector(
                    'span[data-message-id][role="heading"], '
                    'span[role="heading"]'
                )
                if sender_el:
                    sender = (await sender_el.inner_text()).strip()
                
                # Extract message body text from Zc1Emd divs
                body_parts = []
                body_els = await el.query_selector_all('div.Zc1Emd')
                if body_els:
                    for body_el in body_els:
                        txt = (await body_el.inner_text()).strip()
                        if txt:
                            body_parts.append(txt)
                
                # Fallback: if no Zc1Emd found, get inner text of the whole group
                if not body_parts:
                    full_text = (await el.inner_text()).strip()
                    # Try to strip out the sender name and timestamp
                    lines = full_text.split("\n")
                    body_parts = [l.strip() for l in lines if l.strip() and l.strip() != sender]
                
                if not body_parts:
                    continue
                
                body_text = "\n".join(body_parts)
                
                # Get a stable ID
                msg_id = (
                    await el.get_attribute("data-id") 
                    or await el.get_attribute("data-message-id") 
                    or ""
                )
                msg_hash = hashlib.md5(
                    (msg_id + body_text[:200]).encode()
                ).hexdigest()
                
                messages.append({
                    "text": body_text,
                    "sender": sender,
                    "hash": msg_hash,
                    "id": msg_id,
                    "element": el,
                })
            except Exception as e:
                log.debug(f"Error parsing message element: {e}")
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
        input_box = await page.wait_for_selector(
            '[aria-label*="message" i][contenteditable="true"], '
            '[aria-label*="Send a message" i], '
            'div[contenteditable="true"][role="textbox"]',
            timeout=10000,
        )
        if not input_box:
            log.error("Could not find Chat input box")
            return False

        await input_box.click()
        await asyncio.sleep(0.3)

        for i, line in enumerate(text.split("\n")):
            if i > 0:
                await page.keyboard.down("Shift")
                await page.keyboard.press("Enter")
                await page.keyboard.up("Shift")
            await input_box.type(line, delay=10)

        await page.keyboard.press("Enter")
        await asyncio.sleep(1)
        log.info(f"✓ Sent response ({len(text)} chars)")
        return True
    except Exception as e:
        log.error(f"Failed to send message: {e}")
        return False


async def poll_loop(page: Page):
    """Main polling loop — watches for new messages and responds."""
    log.info(f"Starting poll loop (interval: {POLL_INTERVAL}s)")
    consecutive_errors = 0
    poll_count = 0

    # Dismiss any blocking popups on first entry
    await dismiss_popups(page)
    await asyncio.sleep(1)

    while True:
        try:
            poll_count += 1
            if poll_count % 5 == 0:
                prune_seen()
                log.info(f"Poll #{poll_count}, tracking {len(seen_messages)} messages")

            # Check if we're still on Chat
            if "chat.google.com" not in page.url:
                log.warning(f"Drifted from Chat to: {page.url}")
                if "accounts.google.com" in page.url:
                    log.warning("Session expired — attempting auto-login...")
                    if not await auto_login(page):
                        log.error("Auto-login failed. Waiting 60s before retry...")
                        await asyncio.sleep(60)
                        continue
                else:
                    await page.goto(CHAT_URL, wait_until="domcontentloaded", timeout=30000)
                    await asyncio.sleep(5)

            # Dismiss popups periodically (Google loves resurfacing these)
            if poll_count % 20 == 1:
                await dismiss_popups(page)

            # Dump DOM on first poll for debugging
            if poll_count == 1:
                html = await page.content()
                with open('/app/chat_dom.html', 'w', encoding='utf-8') as f:
                    f.write(html)
                log.info("DOM dumped to /app/chat_dom.html")

            # Check current conversation for new messages
            messages = await get_visible_messages(page)
            if messages:
                log.info(f"Poll #{poll_count} - Found {len(messages)} visible messages")
            
            # First poll: seed the cache with all visible messages to avoid
            # flooding dispatch with historical messages on restart
            if poll_count == 1:
                for msg in messages:
                    seen_messages[msg["hash"]] = time.time()
                log.info(f"Seeded {len(messages)} existing messages into seen cache")
                await asyncio.sleep(POLL_INTERVAL)
                continue
            
            new_count = 0
            for msg in messages:
                if msg["hash"] in seen_messages:
                    continue
                seen_messages[msg["hash"]] = time.time()
                save_seen()
                
                text = msg["text"]
                sender = msg.get("sender", "unknown")
                
                # Skip our own messages
                if text.startswith("[CORTEX]") or sender == "CORTEX":
                    continue
                
                new_count += 1
                log.info(f"📨 New message from {sender}: {text[:80]}...")
                response = forward_to_dispatch(text, sender)
                await send_chat_message(page, response)

            if new_count == 0 and poll_count % 10 == 0:
                log.debug(f"Poll #{poll_count} - No new messages")

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
    log.info("CORTEX Chat Bridge V3 — Playwright/CDP Edition")
    log.info(f"  CDP:      {CDP_URL}")
    log.info(f"  Dispatch: {DISPATCH_URL}")
    log.info(f"  Poll:     {POLL_INTERVAL}s")
    log.info("=" * 60)
    
    load_seen()

    while True:
        try:
            async with async_playwright() as pw:
                browser = await connect_cdp(pw)
                page = await find_or_open_chat(browser)

                if not await check_logged_in(page):
                    log.warning("Not logged in — attempting auto-login...")
                    if not await auto_login(page):
                        log.error(
                            "CORTEX is NOT logged into Google Chat and auto-login failed. "
                            "Manual login needed via noVNC at http://127.0.0.1:7901"
                        )
                        await asyncio.sleep(60)
                        continue

                log.info("✓ CORTEX is logged into Google Chat")
                await dismiss_popups(page)
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
