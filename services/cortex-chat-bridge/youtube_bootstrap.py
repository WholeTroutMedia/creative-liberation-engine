#!/usr/bin/env python3
"""
CORTEX YouTube Bootstrap — Subscribe to learning channels and seed playlists.
Runs inside the cortex-chat-bridge container using the same Selenium Grid.
"""
import time
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

SELENIUM_URL = "http://cortex-browser:4444"

# ── Learning Channels ───────────────────────────────────────────────
# Curated list aligned with Creative Liberation Engine mission areas
CHANNELS = [
    # AI/ML Core
    {"name": "Andrej Karpathy", "url": "https://www.youtube.com/@AndrejKarpathy"},
    {"name": "Yannic Kilcher", "url": "https://www.youtube.com/@YannicKilcher"},
    {"name": "Two Minute Papers", "url": "https://www.youtube.com/@TwoMinutePapers"},
    {"name": "3Blue1Brown", "url": "https://www.youtube.com/@3blue1brown"},
    {"name": "AI Explained", "url": "https://www.youtube.com/@aiexplained-official"},
    {"name": "Matt Wolfe", "url": "https://www.youtube.com/@maboroshi"},
    # Agentic / LLM Systems
    {"name": "AI Jason", "url": "https://www.youtube.com/@AIJasonZ"},
    {"name": "Dave Ebbelaar", "url": "https://www.youtube.com/@daboross"},
    {"name": "Matthew Berman", "url": "https://www.youtube.com/@matthew_berman"},
    {"name": "Sam Witteveen", "url": "https://www.youtube.com/@samwitteveenai"},
    # Infrastructure / DevOps / Self-hosted
    {"name": "NetworkChuck", "url": "https://www.youtube.com/@NetworkChuck"},
    {"name": "Techno Tim", "url": "https://www.youtube.com/@TechnoTim"},
    {"name": "Jeff Geerling", "url": "https://www.youtube.com/@JeffGeerling"},
    {"name": "Wolfgang's Channel", "url": "https://www.youtube.com/@WolfgangsChannel"},
    # Creative AI / Music
    {"name": "Fireship", "url": "https://www.youtube.com/@Fireship"},
    {"name": "The Coding Train", "url": "https://www.youtube.com/@TheCodingTrain"},
    {"name": "Andrew Huang", "url": "https://www.youtube.com/@andrewhuang"},
    {"name": "Rick Beato", "url": "https://www.youtube.com/@RickBeato"},
    {"name": "Guy Michelmore", "url": "https://www.youtube.com/@ThinkSpaceEducation"},
    {"name": "Adam Neely", "url": "https://www.youtube.com/@AdamNeely"},
    {"name": "In The Mix", "url": "https://www.youtube.com/@inthemix"},
    {"name": "Venus Theory", "url": "https://www.youtube.com/@VenusTheory"},
    {"name": "Dan Worrall", "url": "https://www.youtube.com/@DanWorrall"},
    {"name": "Signals Music Studio", "url": "https://www.youtube.com/@SignalsMusicStudio"},
    {"name": "You Suck At Producing", "url": "https://www.youtube.com/@yousuckatproducing"},
    {"name": "Damian Keyes", "url": "https://www.youtube.com/@DamianKeyes"},
    {"name": "Alex Rome", "url": "https://www.youtube.com/@AlexRome"},
    # Business / Strategy
    {"name": "Y Combinator", "url": "https://www.youtube.com/@ycombinator"},
    {"name": "All-In Podcast", "url": "https://www.youtube.com/@alaboratory"},
]

# ── Seed searches — videos to watch later ───────────────────────────
SEED_SEARCHES = [
    "agentic AI systems 2026",
    "multi-agent orchestration LLM",
    "self-hosted AI infrastructure NAS",
    "Google Gemini API tutorial",
    "sovereign AI deployment",
    "music generation AI 2026",
    "Docker compose production deployment",
    "TypeScript full stack 2026",
    "music theory essentials",
    "music production workflow 2026",
    "AI music tools distribution",
    "music distribution strategies",
    "audio mixing and manipulation techniques",
    "advanced music theory for producers",
]


def get_driver():
    opts = Options()
    opts.add_argument("--no-first-run")
    opts.add_argument("--no-default-browser-check")
    opts.add_argument("--disable-notifications")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)

    driver = webdriver.Remote(command_executor=f"{SELENIUM_URL}/wd/hub", options=opts)
    driver.set_window_size(1920, 1080)
    driver.implicitly_wait(10)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    return driver


def login_google(driver):
    """Login if not already authenticated."""
    import os
    email = os.getenv("CORTEX_EMAIL", "inquiries@creativeliberationengine.org")
    password = os.getenv("CORTEX_PASSWORD", "WholeTroutMedia!2026")

    driver.get("https://accounts.google.com/signin")
    time.sleep(3)

    if "myaccount" in driver.current_url:
        print("✓ Already logged in")
        return True

    try:
        email_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'input[type="email"]'))
        )
        email_input.send_keys(email)
        email_input.send_keys(Keys.RETURN)
        time.sleep(4)

        pw_input = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'input[type="password"]'))
        )
        pw_input.send_keys(password)
        pw_input.send_keys(Keys.RETURN)
        time.sleep(6)

        if "challenge" not in driver.current_url and "signin" not in driver.current_url:
            print("✓ Google login successful")
            return True
        else:
            print(f"✗ Login stuck at: {driver.current_url}")
            return False
    except Exception as e:
        print(f"✗ Login failed: {e}")
        return False


def subscribe_to_channel(driver, channel):
    """Navigate to a channel and subscribe if not already."""
    name = channel["name"]
    url = channel["url"]
    print(f"\n{'='*50}")
    print(f"Channel: {name}")
    print(f"  URL: {url}")

    try:
        driver.get(url)
        time.sleep(4)

        # Check if we're on a valid channel page
        if "404" in driver.title or "not found" in driver.title.lower():
            print(f"  ✗ Channel not found, skipping")
            return False

        # Check current subscribe state
        page_text = driver.page_source.lower()

        # Look for subscribe button
        subscribe_buttons = driver.find_elements(
            By.XPATH,
            "//button[.//text()[contains(., 'Subscribe')]] | "
            "//yt-button-shape//button[contains(@aria-label, 'Subscribe')]"
        )

        already_subscribed = False
        for btn in subscribe_buttons:
            aria = (btn.get_attribute("aria-label") or "").lower()
            text = btn.text.lower()
            if "unsubscribe" in aria or "subscribed" in text or "unsubscribe" in text:
                already_subscribed = True
                break

        if already_subscribed:
            print(f"  ✓ Already subscribed")
            return True

        # Click subscribe
        for btn in subscribe_buttons:
            text = btn.text.strip().lower()
            aria = (btn.get_attribute("aria-label") or "").lower()
            if "subscribe" in text and "unsubscribe" not in text and "subscribed" not in text:
                btn.click()
                time.sleep(2)
                print(f"  ✓ Subscribed!")
                return True

        print(f"  ? Could not find subscribe button")
        return False

    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False


def create_watch_later_from_search(driver, query):
    """Search YouTube and save top results to Watch Later."""
    print(f"\n{'='*50}")
    print(f"Search: {query}")

    try:
        driver.get(f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}")
        time.sleep(4)

        # Get first 3 video results
        videos = driver.find_elements(By.CSS_SELECTOR, "ytd-video-renderer a#video-title")[:3]
        saved = 0

        for video in videos:
            try:
                title = video.get_attribute("title") or video.text
                href = video.get_attribute("href") or ""
                if not href or "shorts" in href:
                    continue
                print(f"  Found: {title[:70]}")

                # Right-click context menu approach: hover → 3-dot menu → Save to Watch Later
                # Find the parent renderer
                renderer = video.find_element(By.XPATH, "./ancestor::ytd-video-renderer")

                # Find the 3-dot menu button
                menu_btn = renderer.find_element(
                    By.CSS_SELECTOR, "button.yt-icon-button, #button[aria-label]"
                )
                # Scroll into view and click
                driver.execute_script("arguments[0].scrollIntoView(true);", menu_btn)
                time.sleep(0.5)
                menu_btn.click()
                time.sleep(1)

                # Find "Save to Watch later" in the popup menu
                menu_items = driver.find_elements(
                    By.CSS_SELECTOR, "tp-yt-paper-listbox ytd-menu-service-item-renderer"
                )
                for item in menu_items:
                    if "watch later" in (item.text or "").lower():
                        item.click()
                        saved += 1
                        print(f"    ✓ Saved to Watch Later")
                        time.sleep(1)
                        break
                else:
                    # Close menu if Watch Later not found
                    driver.find_element(By.TAG_NAME, "body").click()
                    time.sleep(0.5)

            except Exception as e:
                print(f"    ? Could not save: {e}")
                try:
                    driver.find_element(By.TAG_NAME, "body").click()
                except:
                    pass
                time.sleep(0.5)

        print(f"  Saved {saved} videos from search")
        return saved

    except Exception as e:
        print(f"  ✗ Search error: {e}")
        return 0


def check_gmail(driver):
    """Quick check of CORTEX Gmail inbox."""
    print(f"\n{'='*50}")
    print("Checking Gmail...")

    try:
        driver.get("https://mail.google.com")
        time.sleep(6)

        if "mail.google.com" in driver.current_url:
            print(f"  ✓ Gmail loaded: {driver.current_url}")

            # Count unread
            try:
                unread_elements = driver.find_elements(
                    By.CSS_SELECTOR, ".zE, tr.zE"  # Gmail unread class
                )
                if unread_elements:
                    print(f"  📧 {len(unread_elements)} unread messages")
                    # Read first few subjects
                    for el in unread_elements[:5]:
                        try:
                            subj = el.find_element(By.CSS_SELECTOR, ".bog, .y6 span").text
                            sender = el.find_element(By.CSS_SELECTOR, ".yP, .zF").text
                            print(f"     From: {sender} — {subj}")
                        except:
                            print(f"     (unread message - could not parse)")
                else:
                    print("  ✓ Inbox zero — no unread messages")
            except:
                body_text = driver.find_element(By.TAG_NAME, "body").text[:500]
                print(f"  Inbox state: {body_text[:200]}")
        else:
            print(f"  Redirected to: {driver.current_url}")

    except Exception as e:
        print(f"  ✗ Gmail error: {e}")


def main():
    print("=" * 60)
    print("CORTEX YouTube Bootstrap — Creative Liberation Engine V6")
    print("=" * 60)

    driver = get_driver()
    print("✓ Connected to Selenium")

    # Login
    if not login_google(driver):
        print("Cannot proceed without login")
        driver.quit()
        return

    # Navigate to YouTube first to accept any prompts
    print("\nOpening YouTube...")
    driver.get("https://www.youtube.com")
    time.sleep(5)
    print(f"  URL: {driver.current_url}")
    print(f"  Title: {driver.title}")

    # Handle any consent/cookie dialogs
    try:
        consent_btns = driver.find_elements(
            By.XPATH,
            "//*[contains(text(), 'Accept') or contains(text(), 'I agree') or contains(text(), 'Reject all')]"
        )
        for btn in consent_btns:
            if "reject" in btn.text.lower() or "accept" in btn.text.lower():
                btn.click()
                time.sleep(2)
                print("  Dismissed consent dialog")
                break
    except:
        pass

    # Subscribe to channels
    print("\n" + "=" * 60)
    print("PHASE 1: Subscribe to Learning Channels")
    print("=" * 60)

    results = {"subscribed": [], "failed": [], "already": []}
    for ch in CHANNELS:
        success = subscribe_to_channel(driver, ch)
        if success:
            results["subscribed"].append(ch["name"])
        else:
            results["failed"].append(ch["name"])

    # Seed Watch Later
    print("\n" + "=" * 60)
    print("PHASE 2: Seed Watch Later Queue")
    print("=" * 60)

    total_saved = 0
    for query in SEED_SEARCHES:
        total_saved += create_watch_later_from_search(driver, query)

    # Check Gmail
    print("\n" + "=" * 60)
    print("PHASE 3: Check Gmail")
    print("=" * 60)
    check_gmail(driver)

    # Summary
    print("\n" + "=" * 60)
    print("BOOTSTRAP COMPLETE")
    print("=" * 60)
    print(f"  Channels subscribed: {len(results['subscribed'])}")
    print(f"  Already subscribed:  {len(results['already'])}")
    print(f"  Failed:              {len(results['failed'])}")
    print(f"  Videos queued:       {total_saved}")
    if results["failed"]:
        print(f"  Failed channels: {', '.join(results['failed'])}")
    print(f"\n  YouTube: https://www.youtube.com (logged in as CORTEX)")
    print(f"  Gmail:   https://mail.google.com  (logged in as CORTEX)")

    driver.quit()
    print("\nSession closed. CORTEX learning library initialized.")


if __name__ == "__main__":
    main()
