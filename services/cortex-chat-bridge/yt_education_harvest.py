#!/usr/bin/env python3
"""
CORTEX Educational Knowledge Harvest — Agent-Domain Mapped Subscriptions.

Uses CDP (Chrome DevTools Protocol) to attach to the already-authenticated
cortex-browser container. No login needed — persistent session.

Maps YouTube EDUCATION channels to Creative Liberation Engine agent domains.
Each agent gets a curated feed of tutorial/course/deep-dive channels
that produce harvestable knowledge (transcripts → knowledge libraries).
"""
import os, time, sys, json
import urllib.request

# CDP endpoint — inside the cortex-browser_default network the
# container hostname is "cortex-browser", CDP on internal port 9223
CDP_HOST = os.getenv("CDP_HOST", "cortex-browser")
CDP_PORT = os.getenv("CDP_PORT", "9223")

# ═══════════════════════════════════════════════════════════════════
# AGENT ↔ DOMAIN ↔ EDUCATIONAL CHANNEL MAPPING
# ═══════════════════════════════════════════════════════════════════

AGENT_DOMAINS = {
    # ─────────────────────────────────────────────────────────────
    # FORGE — 3D Production, Game Dev, Real-Time Rendering
    # ─────────────────────────────────────────────────────────────
    "FORGE / Unreal Engine": [
        ("Unreal Sensei", "@UnrealSensei"),
        ("William Faucher", "@WilliamFaucher"),
        ("Ben Cloward", "@BenCloward"),
        ("Unreal Engine (Official)", "@UnrealEngine"),
        ("Ryan Laley", "@RyanLaley"),
        ("Ali Elzoheiry", "@AliElzoheiry"),
    ],

    "FORGE / Blender": [
        ("Blender Guru", "@blenderguru"),
        ("Grant Abbitt", "@grabbitt"),
        ("Ducky 3D", "@TheDucky3D"),
        ("Erindale", "@Erindale"),
        ("Josh Gambrell", "@JoshGambrell"),
        ("CG Cookie", "@cgcookie"),
        ("CrossMind Studio", "@CrossMindStudio"),
    ],

    # ─────────────────────────────────────────────────────────────
    # PRISM — Real-Time Visuals, Generative Art, Interactive Media
    # ─────────────────────────────────────────────────────────────
    "PRISM / TouchDesigner": [
        ("TouchDesigner (Official)", "@TouchDesignerOfficial"),
        ("DotSimulate", "@dotsimulate"),
        ("The Interactive & Immersive HQ", "@TheInteractiveImmersiveHQ"),
        ("Bileam Tschepe", "@elekktronaut"),
        ("Matthew Ragan", "@raganmd"),
    ],

    "PRISM / Shaders & GPU": [
        ("The Art of Code", "@TheArtofCodeIsCool"),
        ("Freya Holmer", "@acegikmo"),
        ("Victor Gordan", "@VictorGordan"),
        ("Sebastian Lague", "@SebastianLague"),
        ("The Coding Train", "@TheCodingTrain"),
    ],

    # ─────────────────────────────────────────────────────────────
    # HARMONY — Audio Production, Sound Design, Music Engineering
    # ─────────────────────────────────────────────────────────────
    "HARMONY / Audio Production": [
        ("In The Mix", "@inthemix"),
        ("Andrew Huang", "@andrewhuang"),
        ("Dan Worrall", "@DanWorrall"),
        ("Produce Like A Pro", "@ProduceLikeAPro"),
        ("Sage Audio", "@SageAudio"),
    ],

    "HARMONY / AI Music": [
        ("Busy Works Beats", "@BusyWorksBeats"),
        ("All About AI", "@AllAboutAI"),
        ("Matt Wolfe", "@MattVidPro"),
    ],

    # ─────────────────────────────────────────────────────────────
    # ATLAS — Infrastructure, DevOps, Self-Hosting, NAS, Docker
    # ─────────────────────────────────────────────────────────────
    "ATLAS / Infrastructure": [
        ("Techno Tim", "@TechnoTim"),
        ("Christian Lempa", "@christianlempa"),
        ("Jeff Geerling", "@JeffGeerling"),
        ("TechWorld with Nana", "@TechWorldwithNana"),
        ("Learn Linux TV", "@LearnLinuxTV"),
        ("NetworkChuck", "@NetworkChuck"),
        ("Lawrence Systems", "@ABORAT"),
    ],

    # ─────────────────────────────────────────────────────────────
    # VERA — Code Architecture, TypeScript, React, System Design
    # ─────────────────────────────────────────────────────────────
    "VERA / Web Architecture": [
        ("Theo - t3.gg", "@t3dotgg"),
        ("JavaScript Mastery", "@javascriptmastery"),
        ("The Net Ninja", "@NetNinja"),
        ("Traversy Media", "@TraversyMedia"),
        ("Fireship", "@Fireship"),
    ],

    # ─────────────────────────────────────────────────────────────
    # CORTEX — AI/ML, Agentic Systems, LLMs, Multi-Agent
    # ─────────────────────────────────────────────────────────────
    "CORTEX / AI & Agentic": [
        ("Andrej Karpathy", "@AndrejKarpathy"),
        ("3Blue1Brown", "@3blue1brown"),
        ("Yannic Kilcher", "@YannicKilcher"),
        ("Two Minute Papers", "@TwoMinutePapers"),
        ("AI Explained", "@AiExplained"),
        ("DeepLearning.AI", "@Deeplearningai"),
        ("Sentdex", "@sentdex"),
    ],

    # ─────────────────────────────────────────────────────────────
    # ATHENA — Strategy, Business, Product, Startups
    # ─────────────────────────────────────────────────────────────
    "ATHENA / Strategy": [
        ("Y Combinator", "@ycombinator"),
        ("Lex Fridman", "@lexfridman"),
        ("Lenny's Podcast", "@LennysPodcast"),
        ("a16z", "@a16z"),
        ("Reducible", "@Reducible"),
    ],

    # ─────────────────────────────────────────────────────────────
    # SENTINEL — AI Security, Prompt Injection, LLM Red-Teaming,
    # Adversarial ML, Application Security, Threat Modeling
    # Critical for protecting the multi-agent OS from adversarial input
    # ─────────────────────────────────────────────────────────────
    "SENTINEL / AI Security": [
        ("LiveOverflow", "@LiveOverflow"),
        ("John Hammond", "@_JohnHammond"),
        ("David Bombal", "@davidbombal"),
        ("The Cyber Mentor", "@TCMSecurityAcademy"),
        ("Professor Messer", "@professormesser"),
        ("13Cubed", "@13Cubed"),
    ],

    "SENTINEL / AI Red-Teaming": [
        ("Computerphile", "@Computerphile"),
        ("Robert Miles", "@RobertMilesAI"),
        ("SANS Institute", "@SANSInstitute"),
        ("IppSec", "@IppSec"),
    ],
}


# ═══════════════════════════════════════════════════════════════════
# CDP HELPERS — Talk directly to Chrome DevTools Protocol
# No Selenium needed. Just websocket JSON-RPC.
# ═══════════════════════════════════════════════════════════════════

import websocket  # pip: websocket-client

_ws = None
_cmd_id = 0

def _cdp_request(path):
    """Make a CDP HTTP request with Host: localhost to bypass Chrome's host check."""
    req = urllib.request.Request(
        f"http://{CDP_HOST}:{CDP_PORT}{path}",
        headers={"Host": "localhost"}
    )
    resp = urllib.request.urlopen(req, timeout=10)
    return resp.read()

def cdp_connect():
    """Connect to the first browser tab via CDP."""
    global _ws
    print(f"  Connecting to CDP at {CDP_HOST}:{CDP_PORT} ...")
    raw = _cdp_request("/json")
    tabs = json.loads(raw)
    # Find a page target (not devtools/background)
    page_tab = None
    for t in tabs:
        if t.get("type") == "page":
            page_tab = t
            break
    if not page_tab:
        # Open a new tab
        _cdp_request("/json/new?about:blank")
        time.sleep(2)
        raw = _cdp_request("/json")
        tabs = json.loads(raw)
        for t in tabs:
            if t.get("type") == "page":
                page_tab = t
                break
    if not page_tab:
        raise RuntimeError("No page tab found in CDP")
    ws_url = page_tab["webSocketDebuggerUrl"]
    # CDP returns ws://localhost:9222/devtools/... — replace with our target
    # We need to replace both host AND port since internal port differs
    import re
    ws_url = re.sub(r'ws://[^/]+', f'ws://{CDP_HOST}:{CDP_PORT}', ws_url)
    print(f"  WebSocket: {ws_url}")
    _ws = websocket.create_connection(ws_url, timeout=30, host="localhost")
    print("  ✓ CDP connected")


def cdp_send(method, params=None, timeout=30):
    """Send a CDP command and return the result."""
    global _cmd_id
    _cmd_id += 1
    msg = {"id": _cmd_id, "method": method}
    if params:
        msg["params"] = params
    _ws.send(json.dumps(msg))
    deadline = time.time() + timeout
    while time.time() < deadline:
        raw = _ws.recv()
        data = json.loads(raw)
        if data.get("id") == _cmd_id:
            if "error" in data:
                raise RuntimeError(f"CDP error: {data['error']}")
            return data.get("result", {})
    raise TimeoutError(f"CDP timeout for {method}")


def cdp_navigate(url):
    """Navigate to a URL and wait for load."""
    cdp_send("Page.navigate", {"url": url})
    time.sleep(4)


def cdp_eval(expression):
    """Evaluate JavaScript in the page and return the result value."""
    result = cdp_send("Runtime.evaluate", {
        "expression": expression,
        "returnByValue": True,
        "awaitPromise": True,
    })
    val = result.get("result", {}).get("value")
    return val


def subscribe_channel(name, handle):
    """Navigate to channel page, click Subscribe via CDP JS eval."""
    url = f"https://www.youtube.com/{handle}"
    try:
        cdp_navigate(url)

        # Check for 404
        title = cdp_eval("document.title") or ""
        if "404" in title.lower():
            print(f"    ✗ {name}: NOT FOUND ({handle})")
            return "not_found"

        result = cdp_eval("""
            (function() {
                // Strategy 1: ytd-subscribe-button-renderer
                var renderers = document.querySelectorAll('ytd-subscribe-button-renderer');
                for (var r = 0; r < renderers.length; r++) {
                    var renderer = renderers[r];
                    if (renderer.hasAttribute('subscribe-button-hidden') ||
                        renderer.hasAttribute('subscribed')) {
                        return 'already';
                    }
                    var buttons = renderer.querySelectorAll('button');
                    for (var b = 0; b < buttons.length; b++) {
                        var text = (buttons[b].textContent || '').trim().toLowerCase();
                        if (text === 'subscribed' || text === 'unsubscribe') return 'already';
                        if (text === 'subscribe') {
                            buttons[b].click();
                            return 'clicked';
                        }
                    }
                }
                // Strategy 2: Broader search
                var allButtons = document.querySelectorAll('button, yt-button-shape button');
                for (var i = 0; i < allButtons.length; i++) {
                    var btn = allButtons[i];
                    var btnText = (btn.textContent || '').trim();
                    var ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                    if (btnText === 'Subscribed' || ariaLabel.includes('unsubscribe')) return 'already';
                    if (btnText === 'Subscribe' && !ariaLabel.includes('unsubscribe')) {
                        btn.click();
                        return 'clicked';
                    }
                }
                return 'no_button';
            })()
        """)

        if result == "already":
            print(f"    ✓ {name}: already subscribed")
            return "already"
        elif result == "clicked":
            time.sleep(3)
            print(f"    ✓ {name}: SUBSCRIBED ✓")
            return "subscribed"
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
print("=" * 65)
print("  CORTEX Educational Knowledge Harvest")
print("  Agent-Domain Mapped YouTube Subscriptions (CDP)")
print(f"  CDP Target: {CDP_HOST}:{CDP_PORT}")
print("=" * 65)

cdp_connect()

# Enable Page domain for navigation
cdp_send("Page.enable")

# Navigate to YouTube first
cdp_navigate("https://www.youtube.com")

# Check if logged in
account_check = cdp_eval("""
    (function() {
        var avatar = document.querySelector('#avatar-btn, button#avatar-btn, yt-img-shadow#avatar');
        return avatar ? 'logged_in' : 'not_logged_in';
    })()
""")
print(f"  Auth status: {account_check}")

CORTEX_EMAIL = os.getenv("CORTEX_EMAIL", "inquiries@creativeliberationengine.org")
CORTEX_PASSWORD = os.getenv("CORTEX_PASSWORD", "")

if account_check != "logged_in" and CORTEX_PASSWORD:
    print("  Logging in to Google...")
    # Navigate to Google sign-in for YouTube
    cdp_navigate("https://accounts.google.com/signin/v2/identifier?service=youtube&hl=en&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin")
    time.sleep(3)

    # Enter email
    cdp_eval(f"""
        (function() {{
            var emailInput = document.querySelector('input[type="email"]');
            if (emailInput) {{
                emailInput.focus();
                emailInput.value = '{CORTEX_EMAIL}';
                emailInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
            }}
        }})()
    """)
    time.sleep(1)
    # Click Next
    cdp_eval("""
        (function() {
            var buttons = document.querySelectorAll('button');
            for (var i = 0; i < buttons.length; i++) {
                var text = (buttons[i].textContent || '').trim();
                if (text === 'Next' || text === 'Suivant') {
                    buttons[i].click();
                    return 'clicked_next';
                }
            }
            // Try the identifier button
            var nextBtn = document.querySelector('#identifierNext button');
            if (nextBtn) { nextBtn.click(); return 'clicked_id_next'; }
            return 'no_next';
        })()
    """)
    time.sleep(4)

    # Enter password
    password_escaped = CORTEX_PASSWORD.replace("'", "\\'").replace("\\", "\\\\")
    cdp_eval(f"""
        (function() {{
            var pwInput = document.querySelector('input[type="password"]');
            if (pwInput) {{
                pwInput.focus();
                pwInput.value = '{password_escaped}';
                pwInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
            }}
        }})()
    """)
    time.sleep(1)
    # Click Next for password
    cdp_eval("""
        (function() {
            var nextBtn = document.querySelector('#passwordNext button');
            if (nextBtn) { nextBtn.click(); return 'clicked_pw_next'; }
            var buttons = document.querySelectorAll('button');
            for (var i = 0; i < buttons.length; i++) {
                var text = (buttons[i].textContent || '').trim();
                if (text === 'Next' || text === 'Suivant') {
                    buttons[i].click();
                    return 'clicked_next';
                }
            }
            return 'no_next';
        })()
    """)
    time.sleep(8)  # Wait for login to complete

    # Verify we're now on YouTube
    cdp_navigate("https://www.youtube.com")
    account_check2 = cdp_eval("""
        (function() {
            var avatar = document.querySelector('#avatar-btn, button#avatar-btn, yt-img-shadow#avatar');
            return avatar ? 'logged_in' : 'not_logged_in';
        })()
    """)
    print(f"  Post-login auth status: {account_check2}")
    if account_check2 != "logged_in":
        print("  ⚠ Login may have failed — Google may require CAPTCHA/2FA.")
        print("    Please log in manually via http://127.0.0.1:3100")
        print("    Then re-run this script.")

total_channels = sum(len(chs) for chs in AGENT_DOMAINS.values())
print(f"\n  Processing {total_channels} channels across {len(AGENT_DOMAINS)} agent domains\n")

stats = {"subscribed": 0, "already": 0, "not_found": 0, "other": 0}
not_found_list = []

for domain, channels in AGENT_DOMAINS.items():
    print(f"\n{'─' * 60}")
    print(f"  {domain} ({len(channels)} channels)")
    print(f"{'─' * 60}")

    for name, handle in channels:
        result = subscribe_channel(name, handle)
        if result == "subscribed":
            stats["subscribed"] += 1
        elif result == "already":
            stats["already"] += 1
        elif result == "not_found":
            stats["not_found"] += 1
            not_found_list.append((domain, name, handle))
        else:
            stats["other"] += 1
        time.sleep(1.5)

# ── Verification ──
print(f"\n{'═' * 65}")
print("  VERIFICATION — Listing all subscriptions")
print(f"{'═' * 65}")
cdp_navigate("https://www.youtube.com/feed/channels")
time.sleep(3)

# Scroll down to load all
for _ in range(8):
    cdp_eval("window.scrollTo(0, document.documentElement.scrollHeight)")
    time.sleep(1)

subs_raw = cdp_eval("""
    (function() {
        var names = [];
        var els = document.querySelectorAll('#channel-name #text, ytd-channel-renderer #text.ytd-channel-name');
        for (var i = 0; i < els.length; i++) {
            var t = (els[i].textContent || '').trim();
            if (t && t.length > 1) names.push(t);
        }
        return JSON.stringify(names);
    })()
""")

found = set()
if subs_raw:
    try:
        found = set(json.loads(subs_raw))
    except:
        pass

if found:
    print(f"  Total subscriptions visible: {len(found)}")
    for n in sorted(found):
        print(f"    • {n}")

_ws.close()

print(f"\n{'═' * 65}")
print("  RESULTS")
print(f"{'═' * 65}")
print(f"  New subscriptions:  {stats['subscribed']}")
print(f"  Already subscribed: {stats['already']}")
print(f"  Not found:          {stats['not_found']}")
print(f"  Other issues:       {stats['other']}")
if not_found_list:
    print(f"\n  Channels not found (need handle correction):")
    for domain, name, handle in not_found_list:
        print(f"    [{domain}] {name} ({handle})")
print(f"\n✓ CORTEX educational knowledge library updated")
