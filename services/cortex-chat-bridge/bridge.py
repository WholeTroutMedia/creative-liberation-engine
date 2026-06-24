#!/usr/bin/env python3
"""
CORTEX Chat Bridge — Sovereign V6
===================================
Bridges Google Chat ↔ NAS Dispatch via Selenium WebDriver.
Uses the existing cortex-browser container (Selenium Grid at port 4444).
CORTEX is logged in as inquiries@creativeliberationengine.org — a regular Google user
on the Family Ultra plan.

Flow:
  1. Connects to Selenium Grid → creates ONE persistent session
  2. Logs into Google as CORTEX (same session)
  3. Opens Google Chat
  4. Polls for new messages every POLL_INTERVAL seconds
  5. Forwards new messages to DISPATCH_URL/api/chat
  6. Types dispatch responses back into the Chat window
"""

import os
import sys
import time
import json
import logging
import hashlib
import requests
from datetime import datetime, timezone
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    NoSuchElementException,
    TimeoutException,
    StaleElementReferenceException,
    WebDriverException,
)

# ── Config ──────────────────────────────────────────────────────────
SELENIUM_URL = os.getenv("SELENIUM_URL", "http://cortex-browser:4444")
DISPATCH_URL = os.getenv("DISPATCH_URL", "http://dispatch:5150")
GENKIT_API_KEY = os.getenv("GENKIT_API_KEY", "")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "5"))
CORTEX_EMAIL = os.getenv("CORTEX_EMAIL", "inquiries@creativeliberationengine.org")
CORTEX_PASSWORD = os.getenv("CORTEX_PASSWORD", "")
CHAT_URL = "https://chat.google.com"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s [CORTEX-BRIDGE] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("cortex-bridge")

# Track messages we've already processed
seen_messages: set[str] = set()


def create_driver() -> webdriver.Remote:
    """Connect to Selenium Grid with anti-detection flags."""
    opts = Options()
    opts.add_argument("--no-first-run")
    opts.add_argument("--no-default-browser-check")
    opts.add_argument("--disable-notifications")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)

    log.info(f"Connecting to Selenium Grid at {SELENIUM_URL}...")
    for attempt in range(10):
        try:
            driver = webdriver.Remote(
                command_executor=f"{SELENIUM_URL}/wd/hub",
                options=opts,
            )
            driver.set_window_size(1920, 1080)
            driver.implicitly_wait(10)
            # Remove webdriver detection flag
            driver.execute_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            )
            log.info("✓ Connected to Selenium Grid")
            return driver
        except Exception as e:
            log.warning(f"Connection attempt {attempt+1}/10 failed: {e}")
            time.sleep(5)
    raise RuntimeError("Could not connect to Selenium Grid after 10 attempts")


def login_to_google(driver: webdriver.Remote) -> bool:
    """Log into Google as CORTEX. Returns True on success."""
    if not CORTEX_PASSWORD:
        log.error("CORTEX_PASSWORD not set. Cannot login.")
        return False

    log.info(f"Logging into Google as {CORTEX_EMAIL}...")
    driver.get("https://accounts.google.com/signin/v2/identifier")
    time.sleep(3)

    # Check if already logged in (same session)
    if "myaccount" in driver.current_url:
        log.info("✓ Already logged into Google")
        return True

    try:
        # Enter email
        email_input = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'input[type="email"]'))
        )
        email_input.clear()
        email_input.send_keys(CORTEX_EMAIL)
        log.info(f"  Entered email: {CORTEX_EMAIL}")
        time.sleep(1)
        email_input.send_keys(Keys.RETURN)
        time.sleep(4)
    except Exception as e:
        log.error(f"  Email entry failed: {e}")
        return False

    # Enter password
    try:
        pw_input = WebDriverWait(driver, 15).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'input[type="password"]'))
        )
        pw_input.clear()
        pw_input.send_keys(CORTEX_PASSWORD)
        log.info("  Entered password")
        time.sleep(1)
        pw_input.send_keys(Keys.RETURN)
        time.sleep(6)
    except TimeoutException:
        # Password field didn't appear — might be verification challenge
        body = driver.find_element(By.TAG_NAME, "body").text[:500]
        log.error(f"  Password field not found. Page says: {body}")
        return False
    except Exception as e:
        log.error(f"  Password entry failed: {e}")
        return False

    # Verify login
    url = driver.current_url
    if "challenge" in url or "signin" in url:
        body = driver.find_element(By.TAG_NAME, "body").text[:500]
        log.warning(f"  Post-login challenge detected at {url}")
        log.warning(f"  Page: {body}")
        
        # Try to handle common challenges (2-step, phone verification, etc.)
        # Check for "confirm recovery email" or "verify it's you" screens
        if "recovery" in body.lower() or "verify" in body.lower():
            # Try clicking "Try another way" or "Not now"
            try:
                skip_buttons = driver.find_elements(
                    By.XPATH, 
                    "//*[contains(text(), 'Not now') or contains(text(), 'Skip') or contains(text(), 'Done')]"
                )
                if skip_buttons:
                    skip_buttons[0].click()
                    time.sleep(3)
                    log.info("  Clicked skip/done button")
            except Exception:
                pass
        return False

    log.info("✓ Google login successful")
    return True


def open_chat(driver: webdriver.Remote) -> bool:
    """Navigate to Google Chat."""
    log.info(f"Opening Google Chat...")
    driver.get(CHAT_URL)
    time.sleep(8)

    url = driver.current_url
    if "chat.google.com" in url and "workspace.google.com" not in url:
        log.info("✓ Google Chat loaded")
        return True
    elif "workspace.google.com" in url:
        log.warning("Redirected to marketing page — not logged in")
        return False
    else:
        log.warning(f"Unexpected Chat URL: {url}")
        return False


def get_latest_messages(driver: webdriver.Remote, count: int = 5) -> list[dict]:
    """Extract the latest messages from the currently open conversation."""
    messages = []
    try:
        msg_elements = driver.find_elements(
            By.CSS_SELECTOR, '[data-message-id], [role="listitem"]'
        )
        for el in msg_elements[-count:]:
            try:
                text = el.text.strip()
                if not text:
                    continue
                msg_hash = hashlib.md5(text.encode()).hexdigest()
                messages.append({"text": text, "hash": msg_hash, "element": el})
            except StaleElementReferenceException:
                continue
    except NoSuchElementException:
        pass
    return messages


def get_unread_conversations(driver: webdriver.Remote) -> list[dict]:
    """Find conversations with unread messages."""
    unread = []
    try:
        conv_items = driver.find_elements(
            By.CSS_SELECTOR, '[data-is-read="false"], [aria-label*="unread"]'
        )
        for item in conv_items:
            try:
                label = item.get_attribute("aria-label") or item.text
                unread.append({"element": item, "label": label.strip()[:100]})
            except StaleElementReferenceException:
                continue
    except NoSuchElementException:
        pass
    return unread


def forward_to_dispatch(message_text: str, sender: str = "unknown") -> str:
    """Forward a message to the NAS dispatch server."""
    payload = {
        "message": message_text,
        "sender": sender,
        "source": "google-chat",
        "agent": "CORTEX",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    headers = {"Content-Type": "application/json"}
    if GENKIT_API_KEY:
        headers["x-api-key"] = GENKIT_API_KEY

    try:
        log.info(f"→ Dispatch: {message_text[:80]}...")
        resp = requests.post(
            f"{DISPATCH_URL}/api/chat", json=payload, headers=headers, timeout=55
        )
        resp.raise_for_status()
        data = resp.json()
        response_text = (
            data.get("response")
            or data.get("data", {}).get("response")
            or data.get("message")
            or "Message received."
        )
        log.info(f"← Dispatch: {response_text[:80]}...")
        return response_text
    except requests.exceptions.ConnectionError:
        log.error(f"Cannot reach dispatch at {DISPATCH_URL}")
        return "[CORTEX] Dispatch unreachable."
    except Exception as e:
        log.error(f"Dispatch error: {e}")
        return f"[CORTEX] Error: {str(e)[:100]}"


def send_chat_message(driver: webdriver.Remote, text: str) -> bool:
    """Type and send a message in the current Chat conversation."""
    try:
        input_box = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, '[aria-label*="message" i], [contenteditable="true"], textarea')
            )
        )
        input_box.click()
        time.sleep(0.3)
        for line in text.split("\n"):
            input_box.send_keys(line)
            input_box.send_keys(Keys.SHIFT + Keys.RETURN)
        input_box.send_keys(Keys.RETURN)
        time.sleep(1)
        log.info(f"✓ Sent response ({len(text)} chars)")
        return True
    except Exception as e:
        log.error(f"Failed to send message: {e}")
        return False


def poll_loop(driver: webdriver.Remote):
    """Main polling loop."""
    log.info(f"Starting poll loop (interval: {POLL_INTERVAL}s)")
    consecutive_errors = 0

    while True:
        try:
            messages = get_latest_messages(driver)
            new_msgs = [m for m in messages if m["hash"] not in seen_messages]

            if new_msgs:
                for msg in new_msgs:
                    seen_messages.add(msg["hash"])
                    text = msg["text"]
                    if text.startswith("[CORTEX]"):
                        continue
                    lines = text.split("\n")
                    sender = lines[0] if len(lines) > 1 else "unknown"
                    body = "\n".join(lines[1:]) if len(lines) > 1 else text
                    response = forward_to_dispatch(body, sender)
                    send_chat_message(driver, response)

            unreads = get_unread_conversations(driver)
            if unreads:
                log.info(f"Found {len(unreads)} unread conversations")
                for conv in unreads:
                    try:
                        conv["element"].click()
                        time.sleep(2)
                        conv_msgs = get_latest_messages(driver)
                        for msg in conv_msgs:
                            if msg["hash"] not in seen_messages:
                                seen_messages.add(msg["hash"])
                                response = forward_to_dispatch(msg["text"])
                                send_chat_message(driver, response)
                    except Exception as e:
                        log.warning(f"Error processing conversation: {e}")

            consecutive_errors = 0
            time.sleep(POLL_INTERVAL)

        except WebDriverException as e:
            consecutive_errors += 1
            log.error(f"WebDriver error ({consecutive_errors}/10): {e}")
            if consecutive_errors >= 10:
                log.critical("Too many errors. Restarting...")
                return
            time.sleep(POLL_INTERVAL * 2)
        except KeyboardInterrupt:
            log.info("Shutdown requested")
            break
        except Exception as e:
            consecutive_errors += 1
            log.error(f"Unexpected error: {e}")
            time.sleep(POLL_INTERVAL)


def main():
    """Entry point — single session: connect → login → chat → poll."""
    log.info("=" * 60)
    log.info("CORTEX Chat Bridge — Creative Liberation Engine V6")
    log.info(f"  Selenium: {SELENIUM_URL}")
    log.info(f"  Dispatch: {DISPATCH_URL}")
    log.info(f"  Poll:     {POLL_INTERVAL}s")
    log.info("=" * 60)

    while True:
        driver = None
        try:
            # Step 1: Connect to Selenium (keeps session alive)
            driver = create_driver()

            # Step 2: Login to Google IN THIS SESSION
            if not login_to_google(driver):
                log.error("Google login failed. Retrying in 60s...")
                driver.quit()
                time.sleep(60)
                continue

            # Step 3: Open Google Chat IN THIS SESSION
            if not open_chat(driver):
                log.error("Could not open Google Chat. Retrying in 30s...")
                driver.quit()
                time.sleep(30)
                continue

            # Step 4: Poll for messages (stays in same session)
            poll_loop(driver)

        except Exception as e:
            log.error(f"Fatal: {e}")
            time.sleep(15)
        finally:
            if driver:
                try:
                    driver.quit()
                except Exception:
                    pass


if __name__ == "__main__":
    main()
