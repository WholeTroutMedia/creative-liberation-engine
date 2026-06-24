#!/usr/bin/env python3
"""CORTEX Chat Bridge V4 — Fixed Navigation + Genkit LLM Responses.

Key fixes over V3:
  1. Actually navigates into the Artist DM conversation (V3 never called navigate_to_dm)
  2. Uses JS-based message extraction that works on current Google Chat DOM
  3. Calls Genkit for intelligent AI responses instead of just "task queued"
  4. Re-dumps DOM after navigation for debugging
"""

import asyncio
import hashlib
import json
import logging
import os
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests
from playwright.async_api import Browser, Page, async_playwright

# ─── Configuration ──────────────────────────────────────────────
CDP_URL = os.environ.get("CDP_URL", "http://cortex-browser:9223")
DISPATCH_URL = os.environ.get("DISPATCH_URL", "http://127.0.0.1:5160")
GENKIT_URL = os.environ.get("GENKIT_URL", "http://127.0.0.1:4000")
GENKIT_API_KEY = os.environ.get("GENKIT_API_KEY", "")
CHAT_URL = "https://chat.google.com/app/home"
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "5"))
MAX_RESPONSE_LEN = 4000
CORTEX_EMAIL = "inquiries@creativeliberationengine.org"
CORTEX_PASSWORD = "WholeTroutMedia!2026"
TARGET_DM_NAME = os.environ.get("TARGET_DM", "Artist")

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
    if len(seen_messages) > 1000:
        sorted_keys = sorted(seen_messages.keys(), key=lambda k: seen_messages[k])
        for k in sorted_keys[:-1000]:
            del seen_messages[k]
        save_seen()


def resolve_cdp_url(url: str) -> str:
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
    contexts = browser.contexts
    for ctx in contexts:
        for page in ctx.pages:
            try:
                if urlparse(page.url).netloc == "chat.google.com":
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
    parsed = urlparse(url)
    if parsed.netloc == "chat.google.com":
        log.info(f"✓ Google Chat opened: {url}")
        return page
    elif parsed.netloc == "accounts.google.com":
        log.warning("Session expired — attempting automated re-login...")
        login_ok = await auto_login(page)
        if login_ok:
            return page
        raise RuntimeError("Auto-login failed. Manual intervention needed.")
    else:
        log.warning(f"Unexpected URL after opening Chat: {url}")
        return page


async def auto_login(page: Page) -> bool:
    try:
        log.info("Starting auto-login flow...")
        await page.goto(
            "https://accounts.google.com/signin/v2/identifier"
            "?continue=https%3A%2F%2Fchat.google.com%2F",
            wait_until="networkidle"
        )
        await asyncio.sleep(2)

        if "accountchooser" in page.url:
            log.info("Account chooser detected — clicking CORTEX account...")
            try:
                await page.get_by_text(CORTEX_EMAIL).click()
                await asyncio.sleep(3)
            except Exception:
                log.info("CORTEX not in chooser, using 'Use another account'")
                await page.get_by_text("Use another account").click()
                await asyncio.sleep(2)

        email_input = page.locator("input[type='email']").locator("visible=true")
        if await email_input.count() > 0:
            log.info("Entering email...")
            await email_input.fill(CORTEX_EMAIL)
            await page.keyboard.press("Enter")
            await asyncio.sleep(3)

        password_input = page.locator("input[type='password']").locator("visible=true")
        if await password_input.count() > 0:
            log.info("Entering password...")
            await password_input.fill(CORTEX_PASSWORD)
            await page.keyboard.press("Enter")
            await asyncio.sleep(5)

        if urlparse(page.url).netloc == "chat.google.com":
            log.info("✓ Auto-login successful!")
            try:
                await page.locator("text=Disable").click(timeout=3000)
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
        return urlparse(page.url).netloc == "chat.google.com"

    except Exception as e:
        log.error(f"Auto-login error: {e}")
        return False


async def check_logged_in(page: Page) -> bool:
    try:
        return urlparse(page.url).netloc == "chat.google.com"
    except Exception:
        return False


async def dismiss_popups(page: Page):
    try:
        dismissed = await page.evaluate('''() => {
            const results = [];
            const buttons = document.querySelectorAll('button, [role="button"]');
            for (const btn of buttons) {
                const text = (btn.textContent || '').trim();
                if (text === 'Disable' || text === 'No thanks' || text === 'Dismiss' || text === 'Got it' || text === 'Login') {
                    try { btn.click(); results.push(text); } catch(e) {}
                }
            }
            return results;
        }''')
        if dismissed:
            log.info(f"Dismissed popups/login: {dismissed}")
            await asyncio.sleep(1)
    except Exception as e:
        log.debug(f"dismiss_popups: {e}")


async def navigate_to_dm(page: Page) -> bool:
    """Navigate into the DM conversation with the target user.
    
    This is the CRITICAL fix — V3 never called this function, so the bridge
    sat on /app/home forever seeing 0 messages.
    """
    try:
        url = page.url
        # Already in a conversation
        if "/dm/" in url or "/chat/" in url:
            log.debug("Already in a conversation")
            return True

        log.info(f"On home page ({url}), navigating to {TARGET_DM_NAME} DM...")

        # Use JS to find and click the DM link in sidebar
        clicked = await page.evaluate('''(targetName) => {
            // Strategy 1: Find links/buttons with the target name
            const allEls = document.querySelectorAll('a, [role="link"], [role="listitem"], [role="treeitem"]');
            for (const el of allEls) {
                const text = (el.textContent || '').trim();
                const label = el.getAttribute('aria-label') || '';
                if (text.includes(targetName) || label.includes(targetName)) {
                    // Prefer elements that look like chat entries
                    const href = el.getAttribute('href') || '';
                    if (href.includes('/dm/') || href.includes('/chat/') || el.closest('[role="listitem"]')) {
                        el.click();
                        return `clicked: ${text.substring(0, 50)}`;
                    }
                }
            }
            // Strategy 2: Find any element containing the name and click it
            for (const el of allEls) {
                const text = (el.textContent || '').trim();
                if (text.includes(targetName)) {
                    el.click();
                    return `fallback-clicked: ${text.substring(0, 50)}`;
                }
            }
            return null;
        }''', TARGET_DM_NAME)

        if clicked:
            log.info(f"Navigation click: {clicked}")
            await asyncio.sleep(3)
            new_url = page.url
            log.info(f"After navigation: {new_url}")
            if "/dm/" in new_url or "/chat/" in new_url:
                return True
            # Even if URL didn't change, the content might have loaded
            return True
        else:
            log.warning(f"Could not find {TARGET_DM_NAME} DM in sidebar")
            # Try direct URL navigation to DMs list
            await page.goto("https://chat.google.com/app/dm", wait_until="domcontentloaded", timeout=15000)
            await asyncio.sleep(3)
            return False

    except Exception as e:
        log.error(f"navigate_to_dm error: {e}")
        return False


async def get_visible_messages_js(page: Page, count: int = 15) -> list[dict]:
    """Extract messages using pure JS evaluation — most reliable approach.
    
    Works by finding all text content blocks in the message area and
    extracting sender + body from the DOM structure.
    """
    try:
        messages = await page.evaluate('''(maxCount) => {
            const results = [];
            
            // Strategy 1: Find message groups with data-id attribute
            let groups = document.querySelectorAll('div[data-id][role="group"]');
            
            // Strategy 2: Try c-wiz wrappers
            if (!groups.length) {
                groups = document.querySelectorAll('c-wiz[data-message-id], div[data-message-id]');
            }
            
            // Strategy 3: Find the main message container and get its children
            if (!groups.length) {
                const mainArea = document.querySelector('[role="main"], [role="log"], [aria-label*="message" i]');
                if (mainArea) {
                    groups = mainArea.querySelectorAll('[role="listitem"], [role="row"], [role="group"]');
                }
            }
            
            // Strategy 4: Broadest — any element with role=listitem inside the content area
            if (!groups.length) {
                const contentAreas = document.querySelectorAll('[role="main"] [role="list"]');
                for (const area of contentAreas) {
                    const items = area.querySelectorAll('[role="listitem"]');
                    if (items.length > 0) {
                        groups = items;
                        break;
                    }
                }
            }
            
            // Strategy 5: Even broader — look for common message container patterns
            if (!groups.length) {
                groups = document.querySelectorAll('.nF6pT, .ajCeRb, .Bl2pUd, .oGsu4');
            }
            
            if (!groups.length) {
                // Diagnostic: count what we DO see
                const roles = {};
                document.querySelectorAll('[role]').forEach(el => {
                    const r = el.getAttribute('role');
                    roles[r] = (roles[r] || 0) + 1;
                });
                return { error: 'no_messages', diag: { roles, url: window.location.href, title: document.title } };
            }

            const slice = Array.from(groups).slice(-maxCount);
            for (const el of slice) {
                try {
                    // Get sender from heading or first bold/strong element
                    let sender = 'unknown';
                    const heading = el.querySelector('[role="heading"], h3, h4');
                    if (heading) {
                        sender = heading.textContent.trim();
                    }
                    
                    // Get body text - try specific message body selectors
                    let bodyText = '';
                    const bodyEls = el.querySelectorAll('.Zc1Emd, .oGsu4 .Zc1Emd, [dir="ltr"] > span, .GDhqjd');
                    if (bodyEls.length) {
                        const parts = [];
                        bodyEls.forEach(b => {
                            const t = b.textContent.trim();
                            if (t && t !== sender) parts.push(t);
                        });
                        bodyText = parts.join('\\n');
                    }
                    
                    // Fallback: get full inner text minus the sender
                    if (!bodyText) {
                        const fullText = el.innerText || '';
                        const lines = fullText.split('\\n').filter(l => l.trim() && l.trim() !== sender);
                        // Remove timestamp-like lines (e.g. "10:24 AM")
                        bodyText = lines.filter(l => !/^\\d{1,2}:\\d{2}\\s*(AM|PM)?$/i.test(l.trim())).join('\\n');
                    }
                    
                    if (!bodyText.trim()) continue;
                    
                    const dataId = el.getAttribute('data-id') || el.getAttribute('data-message-id') || '';
                    
                    results.push({
                        text: bodyText.trim(),
                        sender: sender,
                        id: dataId,
                    });
                } catch(e) {
                    continue;
                }
            }
            
            return { messages: results, count: groups.length };
        }''', count)

        if isinstance(messages, dict) and "error" in messages:
            diag = messages.get("diag", {})
            log.warning(f"No messages found. URL: {diag.get('url', '?')}, Title: {diag.get('title', '?')}")
            log.debug(f"DOM roles: {diag.get('roles', {})}")
            return []

        msg_list = messages.get("messages", []) if isinstance(messages, dict) else []
        total = messages.get("count", 0) if isinstance(messages, dict) else 0

        if msg_list:
            log.debug(f"Extracted {len(msg_list)} messages from {total} DOM groups")

        result = []
        for msg in msg_list:
            msg_hash = hashlib.md5(
                (msg.get("id", "") + msg["text"][:200]).encode()
            ).hexdigest()
            result.append({
                "text": msg["text"],
                "sender": msg["sender"],
                "hash": msg_hash,
                "id": msg.get("id", ""),
            })

        return result

    except Exception as e:
        log.error(f"get_visible_messages_js error: {e}")
        err_msg = str(e).lower()
        if "closed" in err_msg or "detached" in err_msg or "connection" in err_msg:
            raise e
        return []


def get_ai_response(message_text: str, sender: str = "unknown") -> str:
    """Get an intelligent response from Genkit LLM, falling back to dispatch."""
    
    # First, try Genkit for an intelligent response
    try:
        genkit_payload = {
            "model": "googleai/gemini-2.5-flash",
            "prompt": f"You are CORTEX, the AI operations agent for the Creative Liberation Engine. "
                      f"A user ({sender}) has sent you a message via Google Chat. "
                      f"Respond conversationally and helpfully. Keep responses under 500 chars.\n\n"
                      f"Message: {message_text}",
        }
        headers = {"Content-Type": "application/json"}
        if GENKIT_API_KEY:
            headers["x-api-key"] = GENKIT_API_KEY

        resp = requests.post(
            f"{GENKIT_URL}/generate",
            json=genkit_payload,
            headers=headers,
            timeout=30,
        )
        if resp.ok:
            data = resp.json()
            reply = data.get("response") or data.get("text") or data.get("message", "")
            if reply:
                log.info(f"← Genkit response: {reply[:80]}...")
                return reply
    except Exception as e:
        log.warning(f"Genkit unavailable ({e}), falling back to dispatch")

    # Fallback: forward to dispatch and acknowledge
    return forward_to_dispatch(message_text, sender)


def forward_to_dispatch(message_text: str, sender: str = "unknown") -> str:
    """Forward a message to the dispatch server as a task."""
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
        return f"[CORTEX] Message received and queued as task {task_id}. I'll process this shortly."
    except requests.exceptions.ConnectionError:
        log.error(f"Cannot reach dispatch at {DISPATCH_URL}")
        return "[CORTEX] I received your message but dispatch is temporarily offline."
    except Exception as e:
        log.error(f"Dispatch error: {e}")
        return f"[CORTEX] Received, but encountered an error: {str(e)[:100]}"


async def send_chat_message(page: Page, text: str) -> bool:
    """Type and send a message in the current Chat conversation.
    
    Uses JS-first approach to find and focus the input, then Playwright
    keyboard API to type. This avoids Playwright selector timeouts on
    Google Chat's complex DOM.
    """
    try:
        # Use JS to find and focus the input element
        found = await page.evaluate('''() => {
            // Strategy 1: contenteditable with role=textbox
            for (const el of document.querySelectorAll('[contenteditable="true"][role="textbox"]')) {
                if (el.offsetParent !== null) { el.focus(); el.click(); return 'textbox'; }
            }
            // Strategy 2: aria-label based
            for (const el of document.querySelectorAll('[contenteditable="true"]')) {
                const label = (el.getAttribute('aria-label') || '').toLowerCase();
                if (label.includes('message') || label.includes('send') || label.includes('chat')) {
                    if (el.offsetParent !== null) { el.focus(); el.click(); return 'aria-' + label.substring(0, 30); }
                }
            }
            // Strategy 3: any visible contenteditable
            for (const el of document.querySelectorAll('[contenteditable="true"]')) {
                if (el.offsetParent !== null && el.offsetHeight > 20) {
                    el.focus(); el.click(); return 'generic-editable';
                }
            }
            // Strategy 4: textarea or input
            for (const el of document.querySelectorAll('textarea, input[type="text"]')) {
                const label = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').toLowerCase();
                if (label.includes('message') || label.includes('send')) {
                    if (el.offsetParent !== null) { el.focus(); el.click(); return 'input-' + label.substring(0, 30); }
                }
            }
            // Diagnostic
            const editables = document.querySelectorAll('[contenteditable="true"]');
            const textareas = document.querySelectorAll('textarea');
            return `not_found:editables=${editables.length},textareas=${textareas.length}`;
        }''')

        log.info(f"Input box strategy: {found}")

        if found and found.startswith("not_found"):
            log.error(f"Could not find Chat input box: {found}")
            return False

        await asyncio.sleep(0.5)

        # Type using keyboard API (works regardless of element type)
        # Truncate very long messages
        send_text = text[:MAX_RESPONSE_LEN]
        
        for i, line in enumerate(send_text.split("\n")):
            if i > 0:
                await page.keyboard.down("Shift")
                await page.keyboard.press("Enter")
                await page.keyboard.up("Shift")
            await page.keyboard.type(line, delay=8)

        await asyncio.sleep(0.3)
        await page.keyboard.press("Enter")
        await asyncio.sleep(1.5)
        log.info(f"✓ Sent response ({len(send_text)} chars)")
        return True
    except Exception as e:
        log.error(f"Failed to send message: {e}")
        return False


async def dump_dom_debug(page: Page, filename: str = "chat_dom.html"):
    """Dump current DOM for debugging."""
    try:
        html = await page.content()
        path = f"/app/data/{filename}"
        with open(path, 'w', encoding='utf-8') as f:
            f.write(html)
        log.info(f"DOM dumped to {path} ({len(html)} bytes)")
    except Exception as e:
        log.debug(f"DOM dump failed: {e}")


async def poll_loop(page: Page):
    """Main polling loop — navigates to DM, watches for new messages, responds."""
    log.info(f"Starting poll loop (interval: {POLL_INTERVAL}s)")
    consecutive_errors = 0
    poll_count = 0
    dm_navigated = False

    await dismiss_popups(page)
    await asyncio.sleep(1)

    while True:
        try:
            if page.is_closed():
                raise RuntimeError("Playwright page has been closed")
            poll_count += 1
            if poll_count % 5 == 0:
                prune_seen()
                log.info(f"Poll #{poll_count}, tracking {len(seen_messages)} messages, dm_nav={dm_navigated}")

            # Check if we're still on Chat
            if urlparse(page.url).netloc != "chat.google.com":
                log.warning(f"Drifted from Chat to: {page.url}")
                if urlparse(page.url).netloc == "accounts.google.com":
                    log.warning("Session expired — attempting auto-login...")
                    if not await auto_login(page):
                        log.error("Auto-login failed. Waiting 60s...")
                        await asyncio.sleep(60)
                        continue
                else:
                    await page.goto(CHAT_URL, wait_until="domcontentloaded", timeout=30000)
                    await asyncio.sleep(5)
                dm_navigated = False

            # *** KEY FIX: Navigate into the DM conversation ***
            if not dm_navigated or "/app/home" in page.url:
                log.info("Navigating to DM conversation...")
                dm_navigated = await navigate_to_dm(page)
                if dm_navigated:
                    await asyncio.sleep(2)
                    # Dump DOM after navigation for debugging
                    await dump_dom_debug(page, "chat_dom_in_dm.html")
                else:
                    log.warning("DM navigation failed, will retry next poll")
                    await asyncio.sleep(POLL_INTERVAL)
                    continue

            # Dismiss popups periodically
            if poll_count % 20 == 1:
                await dismiss_popups(page)

            # Extract messages using JS-based approach
            messages = await get_visible_messages_js(page)

            # First poll after DM navigation: seed the cache
            if poll_count == 1 or (dm_navigated and not seen_messages):
                for msg in messages:
                    seen_messages[msg["hash"]] = time.time()
                save_seen()
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
                response = get_ai_response(text, sender)
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
    """Entry point — connect via CDP → find Chat → navigate to DM → poll."""
    log.info("=" * 60)
    log.info("CORTEX Chat Bridge V4 — Fixed Navigation Edition")
    log.info(f"  CDP:      {CDP_URL}")
    log.info(f"  Dispatch: {DISPATCH_URL}")
    log.info(f"  Genkit:   {GENKIT_URL}")
    log.info(f"  Poll:     {POLL_INTERVAL}s")
    log.info(f"  Target:   {TARGET_DM_NAME}")
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
