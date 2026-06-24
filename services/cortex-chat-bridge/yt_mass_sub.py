#!/usr/bin/env python3
"""
CORTEX Mass YouTube Subscription — Top 5 per category.
Uses YouTube's subscribe URL pattern for reliable subscriptions.
"""
import os, time, sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

SELENIUM_URL = "http://cortex-browser:4444"
EMAIL = os.getenv("CORTEX_EMAIL", "inquiries@creativeliberationengine.org")
PASSWORD = os.getenv("CORTEX_PASSWORD", "WholeTroutMedia!2026")

# ═══════════════════════════════════════════════════════════
# TOP 5 PER CATEGORY — Curated from community recommendations
# ═══════════════════════════════════════════════════════════
CHANNELS = {
    "Unreal Engine": [
        ("Unreal Engine (Official)", "@UnrealEngine"),
        ("Unreal Sensei", "@UnrealSensei"),
        ("William Faucher", "@WilliamFaucher"),
        ("Bad Decisions Studio", "@BadDecisionsStudio"),
        ("Gorka Games", "@GorkaGames"),
    ],
    "Blender": [
        ("Blender Guru", "@blenderguru"),
        ("Grant Abbitt", "@GrantAbbitt"),
        ("Ducky 3D", "@TheDucky3D"),
        ("CG Cookie", "@cg_cookie"),
        ("SouthernShotty", "@SouthernShotty3D"),
    ],
    "TouchDesigner": [
        ("TouchDesigner (Official)", "@TouchDesignerOfficial"),
        ("DotSimulate", "@dotsimulate"),
        ("The Interactive & Immersive HQ", "@TheInteractiveImmersiveHQ"),
        ("Bileam Tschepe", "@elekktronaut"),
        ("Pao Olea", "@PaoOlea"),
    ],
    "AI / ML / Agentic": [
        ("Andrej Karpathy", "@AndrejKarpathy"),
        ("Two Minute Papers", "@TwoMinutePapers"),
        ("Yannic Kilcher", "@YannicKilcher"),
        ("AI Explained", "@AiExplained"),
        ("3Blue1Brown", "@3blue1brown"),
    ],
    "Self-Hosted / Infra": [
        ("Techno Tim", "@TechnoTim"),
        ("Jeff Geerling", "@JeffGeerling"),
        ("NetworkChuck", "@NetworkChuck"),
        ("Lawrence Systems", "@ABORAT"),
        ("Hardware Haven", "@HardwareHaven"),
    ],
    "AI Music": [
        ("Busy Works Beats", "@BusyWorksBeats"),
        ("All About AI", "@AllAboutAI"),
        ("AI Revolution", "@airevolutionx"),
        ("Matt Wolfe", "@MattVidPro"),
        ("Fireship", "@Fireship"),
    ],
    "Music Production & Theory": [
        ("Andrew Huang", "@andrewhuang"),
        ("Rick Beato", "@RickBeato"),
        ("Adam Neely", "@AdamNeely"),
        ("Guy Michelmore", "@GuyMichelmore"),
        ("Venus Theory", "@VenusTheory"),
        ("Dan Worrall", "@DanWorrall"),
        ("Signals Music Studio", "@SignalsMusicStudio"),
        ("You Suck At Producing", "@yousuckatproducing"),
        ("Damian Keyes", "@DamianKeyes"),
        ("Alex Rome", "@AlexRome"),
        ("Musformation", "@Musformation"),
        ("Indie Music Academy", "@IndieMusicAcademy"),
        ("Burstimo", "@Burstimo"),
        ("Jesse Cannon", "@JesseCannon"),
        ("Help Me Devvon", "@HelpMeDevvon"),
    ],
    "Creative Coding / Genertic": [
        ("The Coding Train", "@TheCodingTrain"),
        ("Sebastian Lague", "@SebastianLague"),
        ("Reducible", "@Reducible"),
        ("Freya Holmer", "@acegikmo"),
        ("Y Combinator", "@ycombinator"),
    ],
}

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
    driver.implicitly_wait(8)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    return driver

def login(driver):
    driver.get("https://accounts.google.com/signin")
    time.sleep(3)
    if "myaccount" in driver.current_url:
        print("  ✓ Already logged in")
        return True
    try:
        ei = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'input[type="email"]'))
        )
        ei.send_keys(EMAIL)
        ei.send_keys(Keys.RETURN)
        time.sleep(4)
        pw = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'input[type="password"]'))
        )
        pw.send_keys(PASSWORD)
        pw.send_keys(Keys.RETURN)
        time.sleep(6)
        if "challenge" not in driver.current_url:
            print("  ✓ Login successful")
            return True
    except Exception as e:
        print(f"  ✗ Login error: {e}")
    return False

def subscribe_to_channel(driver, name, handle):
    """Navigate to channel and click subscribe using JavaScript."""
    url = f"https://www.youtube.com/{handle}"
    try:
        driver.get(url)
        time.sleep(4)

        # Check for 404
        if "404" in driver.title.lower() or driver.current_url.endswith("/404"):
            print(f"    ✗ {name}: NOT FOUND ({handle})")
            return "not_found"

        # Use JavaScript to find and analyze subscribe buttons
        # This avoids stale element issues entirely
        result = driver.execute_script("""
            // Find all subscribe-related buttons
            var buttons = document.querySelectorAll(
                'ytd-subscribe-button-renderer button, ' +
                'yt-button-shape button[aria-label*="ubscri"], ' +
                'tp-yt-paper-button[subscribed], ' +
                '#subscribe-button button, ' +
                'ytd-subscribe-button-renderer'
            );

            for (var i = 0; i < buttons.length; i++) {
                var btn = buttons[i];
                var aria = (btn.getAttribute('aria-label') || '').toLowerCase();
                var text = (btn.textContent || '').trim().toLowerCase();
                var subscribed = btn.hasAttribute('subscribed') ||
                                 btn.closest('[subscribed]') !== null;

                // Check if already subscribed
                if (subscribed || aria.includes('unsubscribe') || text === 'subscribed') {
                    return 'already';
                }

                // Found unsubscribed subscribe button
                if ((text.includes('subscribe') && !text.includes('unsubscribe') && !text.includes('subscribed')) ||
                    (aria.includes('subscribe') && !aria.includes('unsubscribe'))) {
                    btn.click();
                    return 'clicked';
                }
            }

            // Try broader search
            var allBtns = document.querySelectorAll('button');
            for (var j = 0; j < allBtns.length; j++) {
                var b = allBtns[j];
                var t = (b.textContent || '').trim();
                if (t === 'Subscribe') {
                    b.click();
                    return 'clicked';
                }
            }

            return 'no_button';
        """)

        if result == "already":
            print(f"    ✓ {name}: already subscribed")
            return "already"
        elif result == "clicked":
            time.sleep(2)
            # Verify it stuck
            verify = driver.execute_script("""
                var btns = document.querySelectorAll(
                    'ytd-subscribe-button-renderer button, ' +
                    'yt-button-shape button[aria-label*="ubscri"]'
                );
                for (var i = 0; i < btns.length; i++) {
                    var a = (btns[i].getAttribute('aria-label') || '').toLowerCase();
                    var t = (btns[i].textContent || '').trim().toLowerCase();
                    if (a.includes('unsubscribe') || t === 'subscribed') return 'confirmed';
                }
                return 'unconfirmed';
            """)
            if verify == "confirmed":
                print(f"    ✓ {name}: SUBSCRIBED ✓")
                return "subscribed"
            else:
                print(f"    ? {name}: clicked but unconfirmed")
                return "unconfirmed"
        else:
            print(f"    ? {name}: no subscribe button found")
            return "no_button"

    except Exception as e:
        err = str(e).split('\n')[0][:80]
        print(f"    ✗ {name}: {err}")
        return "error"


# ═══════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════
print("=" * 60)
print("CORTEX YouTube Mass Subscription")
print(f"Account: {EMAIL}")
print("=" * 60)

driver = get_driver()
print("✓ Selenium connected")

if not login(driver):
    print("✗ Cannot login, aborting")
    driver.quit()
    sys.exit(1)

# Verify identity
driver.get("https://myaccount.google.com/personal-info")
time.sleep(4)
page = driver.find_element(By.TAG_NAME, "body").text
for line in page.split("\n"):
    if "@" in line and ("cle" in line.lower() or "cortex" in line.lower()):
        print(f"  Identity confirmed: {line.strip()}")
        break

# Go to YouTube first to establish session
driver.get("https://www.youtube.com")
time.sleep(3)

stats = {"subscribed": 0, "already": 0, "failed": 0, "total": 0}
failed_list = []

for category, channels in CHANNELS.items():
    print(f"\n{'─' * 50}")
    print(f"  {category} ({len(channels)} channels)")
    print(f"{'─' * 50}")

    for name, handle in channels:
        stats["total"] += 1
        result = subscribe_to_channel(driver, name, handle)
        if result == "subscribed":
            stats["subscribed"] += 1
        elif result == "already":
            stats["already"] += 1
        else:
            stats["failed"] += 1
            failed_list.append(f"{name} ({handle})")
        time.sleep(1)  # Brief pause between channels

# Final verification — list all subscriptions
print(f"\n{'═' * 60}")
print("VERIFICATION — Checking /feed/channels")
print(f"{'═' * 60}")
driver.get("https://www.youtube.com/feed/channels")
time.sleep(5)

# Scroll down to load all
for _ in range(5):
    driver.execute_script("window.scrollTo(0, document.documentElement.scrollHeight)")
    time.sleep(1)

# Get channel names
ch_elements = driver.find_elements(By.CSS_SELECTOR,
    "#channel-name #text, "
    "ytd-channel-renderer #text.ytd-channel-name, "
    "#info-section #channel-name"
)
found_names = set()
for el in ch_elements:
    t = el.text.strip()
    if t and len(t) > 1 and "@" not in t:
        found_names.add(t)

if found_names:
    print(f"  Found {len(found_names)} subscriptions:")
    for n in sorted(found_names):
        print(f"    • {n}")
else:
    print("  Could not read subscription list from page")

driver.quit()

print(f"\n{'═' * 60}")
print("RESULTS")
print(f"{'═' * 60}")
print(f"  Total attempted:  {stats['total']}")
print(f"  New subscriptions: {stats['subscribed']}")
print(f"  Already had:       {stats['already']}")
print(f"  Failed:            {stats['failed']}")
if failed_list:
    print(f"  Failed channels:")
    for f in failed_list:
        print(f"    ✗ {f}")
print(f"\n✓ CORTEX learning library updated")
