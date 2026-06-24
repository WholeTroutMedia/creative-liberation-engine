#!/usr/bin/env python3
"""
CORTEX YouTube Swarm Expansion — Creative Coding & Simulation
=======================================================================
Targets new domains for programmatic canvas manipulation, generative art,
and physics simulations to power the "DOS Alchemy" / Image to Life features.

NEW DOMAINS:
  - academy-yt-canvas-creative (p5.js, Processing, Generative Art)
  - academy-yt-canvas-webgl (Three.js, Shaders, GLSL)
  - academy-yt-canvas-physics (Matter.js, Box2D, Game Engines)

Runs inside cortex-omni-watcher via CDP against cortex-browser.
"""

import json
import time
import urllib.request
import os
import re

CDP_HOST = os.getenv("CDP_HOST", "localhost")
CDP_PORT = os.getenv("CDP_PORT", "9224")

try:
    import websocket
except ImportError:
    os.system("pip3 install websocket-client")
    import websocket

# ═══════════════════════════════════════════════════════════════════
# EXPANSION CHANNELS — Creative Coding & Simulation
# ═══════════════════════════════════════════════════════════════════

EXPANSION_DOMAINS = {
    # ─────────────────────────────────────────────────────────────
    # CANVAS / Creative Coding & p5.js
    # ─────────────────────────────────────────────────────────────
    "CANVAS / Creative Coding [NEW]": [
        ("The Coding Train", "@TheCodingTrain"),    # The godfather of p5.js and Processing
        ("Patt Vira", "@pattvira"),                 # p5.js generative art and algorithms
        ("Steve's Makerspace", "@StevesMakerspace"),# p5.js generative art
        ("Gorilla Sun", "@GorillaSun"),             # Generative art patterns
        ("Barney Codes", "@BarneyCodes"),           # Creative coding
        ("Tim Rodenbröker", "@timrodenbroeker"),    # Creative coding and typography
    ],

    # ─────────────────────────────────────────────────────────────
    # CANVAS / WebGL & Shaders (Three.js, GLSL)
    # ─────────────────────────────────────────────────────────────
    "CANVAS / WebGL & Shaders [NEW]": [
        ("Simon Dev", "@SimonDevYT"),               # Three.js, shaders, robust game dev
        ("Bruno Simon", "@bruno_simon"),            # Three.js Journey creator
        ("Yuri Artiukh", "@akella"),                # Advanced WebGL and shaders
        ("Wrong Akram", "@WrongAkram"),             # GSAP and Three.js frontend
        ("DesignCourse", "@DesignCourse"),          # Three.js integrations
        ("Suboptimal Engineer", "@SuboptimalEng"),  # Three.js and shaders
        ("Visionary Games", "@VisionaryGames"),     # WebGL tutorials
    ],

    # ─────────────────────────────────────────────────────────────
    # CANVAS / Physics, Canvas API, and Web Games
    # ─────────────────────────────────────────────────────────────
    "CANVAS / Physics & Games [NEW]": [
        ("Chris Courses", "@ChrisCourses"),         # HTML Canvas, collision, games
        ("Frank laboratory", "@Franklaboratory"),   # HTML Canvas, particles, pure JS physics
        ("Radu Mariescu-Istodor", "@Radu"),         # JavaScript math and physics from scratch
        ("Emanuele Feronato", "@EmanueleFeronato"), # Phaser and web games
        ("Kippo", "@kippo_"),                       # Canvas and web game dev
        ("Domenico De Felice", "@DomenicoDeFelice"),# HTML5 game development
    ],

    # ─────────────────────────────────────────────────────────────
    # AURORA / Motion, VFX, & Cinematography
    # ─────────────────────────────────────────────────────────────
    "AURORA / Motion & VFX [NEW]": [
        ("Video Copilot", "@VideoCopilot"),         # After Effects legends
        ("Corridor Crew", "@CorridorCrew"),         # VFX artists react and explain
        ("School of Motion", "@SchoolOfMotion"),    # Motion design and AE
        ("Film Riot", "@FilmRiot"),                 # Indie VFX and filmmaking
        ("Ben Marriott", "@BenMarriott"),           # Advanced motion design
        ("Ian Hubert", "@IanHubert2"),              # Blender fast workflow and VFX
    ],

    # ─────────────────────────────────────────────────────────────
    # ATELIER / Design Systems, UI/UX, & Interaction
    # ─────────────────────────────────────────────────────────────
    "ATELIER / Design Systems & UI [NEW]": [
        ("Figma", "@Figma"),                        # Design tools and systems
        ("DesignCourse", "@DesignCourse"),          # UI/UX fundamentals
        ("Rachel How", "@RachelHow"),               # UI/UX design and product
        ("Malewicz", "@Malewicz"),                  # UI trends and workflows
        ("Mizko", "@Mizko"),                        # Design systems and strategy
        ("Jesse Showalter", "@JesseShowalter"),     # Web design and UI
    ],
}

# ═══════════════════════════════════════════════════════════════════
# CDP ENGINE
# ═══════════════════════════════════════════════════════════════════

_ws = None
_cmd_id = 0

def cdp_request(path):
    req = urllib.request.Request(
        "http://{}:{}{}".format(CDP_HOST, CDP_PORT, path),
        headers={"Host": "localhost"}
    )
    resp = urllib.request.urlopen(req, timeout=15)
    return resp.read()

def cdp_connect():
    global _ws
    print("[*] Connecting to CDP at {}:{}...".format(CDP_HOST, CDP_PORT))
    raw = cdp_request("/json")
    tabs = json.loads(raw)
    page_tab = None
    for t in tabs:
        if t.get("type") == "page":
            page_tab = t
            break
    if not page_tab:
        cdp_request("/json/new?about:blank")
        time.sleep(2)
        raw = cdp_request("/json")
        tabs = json.loads(raw)
        for t in tabs:
            if t.get("type") == "page":
                page_tab = t
                break
    if not page_tab:
        raise RuntimeError("No page tab available")
    ws_url = page_tab["webSocketDebuggerUrl"]
    ws_url = re.sub(r"ws://[^/]+", "ws://{}:{}".format(CDP_HOST, CDP_PORT), ws_url)
    _ws = websocket.create_connection(ws_url, timeout=30, header=["Host: localhost"])
    print("[+] CDP connected")

def cdp_send(method, params=None, timeout=30):
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
                raise RuntimeError("CDP error: {}".format(data["error"]))
            return data.get("result", {})
    raise TimeoutError("CDP timeout for {}".format(method))

def cdp_navigate(url, wait=4):
    """Navigate and wait for actual page load via CDP events, not dumb sleep."""
    try:
        cdp_send("Page.enable", timeout=5)
    except Exception:
        pass
    cdp_send("Page.navigate", {"url": url})
    deadline = time.time() + 15
    load_fired = False
    while time.time() < deadline:
        try:
            _ws.settimeout(1.0)
            raw = _ws.recv()
            data = json.loads(raw)
            method = data.get("method", "")
            if method in ("Page.loadEventFired", "Page.domContentEventFired"):
                load_fired = True
                break
        except websocket.WebSocketTimeoutException:
            continue
        except Exception:
            break
    _ws.settimeout(30)
    if not load_fired:
        time.sleep(wait)
    time.sleep(2)

def cdp_eval(expression, timeout=30):
    result = cdp_send("Runtime.evaluate", {
        "expression": expression,
        "returnByValue": True,
        "awaitPromise": True,
    }, timeout=timeout)
    return result.get("result", {}).get("value")

# ─── Subscribe button finder JS (reusable) ────────────────────────
_FIND_SUBSCRIBE_JS = """
(function() {
    var renderers = document.querySelectorAll('ytd-subscribe-button-renderer');
    for (var r = 0; r < renderers.length; r++) {
        var renderer = renderers[r];
        if (renderer.hasAttribute('subscribed')) return 'already';
        var buttons = renderer.querySelectorAll('button');
        for (var b = 0; b < buttons.length; b++) {
            var text = (buttons[b].textContent || '').trim().toLowerCase();
            if (text === 'subscribed' || text === 'unsubscribe') return 'already';
            if (text === 'subscribe') { buttons[b].click(); return 'clicked'; }
        }
    }
    var subModels = document.querySelectorAll('yt-subscribe-button-view-model button, yt-button-view-model button');
    for (var s = 0; s < subModels.length; s++) {
        var btn = subModels[s];
        var ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        var btnText = (btn.textContent || '').trim();
        if (ariaLabel.indexOf('unsubscribe') >= 0 || btnText === 'Subscribed') return 'already';
        if (btnText === 'Subscribe' && ariaLabel.indexOf('subscribe') >= 0) {
            btn.click(); return 'clicked';
        }
    }
    var allButtons = document.querySelectorAll('button, yt-button-shape button');
    for (var i = 0; i < allButtons.length; i++) {
        var btn2 = allButtons[i];
        var btnText2 = (btn2.textContent || '').trim();
        var ariaLabel2 = (btn2.getAttribute('aria-label') || '').toLowerCase();
        if (btnText2 === 'Subscribed' || ariaLabel2.indexOf('unsubscribe') >= 0) return 'already';
        if (btnText2 === 'Subscribe' && ariaLabel2.indexOf('unsubscribe') < 0) {
            btn2.click(); return 'clicked';
        }
    }
    return 'no_button';
})()
"""

def subscribe_channel(name, handle):
    url = "https://www.youtube.com/{}".format(handle)
    try:
        cdp_navigate(url, wait=5)
        
        # Wait up to 20s for DOM to hydrate (specifically the subscribe button or channel header)
        title = ""
        for _ in range(15):
            title = cdp_eval("document.title") or ""
            # Wait specifically for the channel header container or a 404
            has_ui = cdp_eval("!!document.querySelector('#page-header, #channel-header, yt-dynamic-sizing-formatted-string.ytd-channel-name, yt-page-not-found-renderer')")
            if title and title != "YouTube" and has_ui:
                break
            time.sleep(1.5)
        
        # Additional buffer to ensure custom elements are upgraded and buttons are injected
        time.sleep(3)

        if "404" in title.lower() or "page not found" in title.lower():
            print("    x {}: NOT FOUND ({})".format(name, handle))
            return "not_found"

        page_check = cdp_eval("""
            (function() {
                var bigError = document.querySelector('yt-page-not-found-renderer, #error-page yt-page-not-found-renderer');
                if (bigError) return 'error_page';
                return 'ok';
            })()
        """)

        if page_check == "error_page":
            print("    x {}: PAGE NOT FOUND ({})".format(name, handle))
            return "not_found"

        result = "no_button"
        for attempt in range(15):  # increased attempts
            result = cdp_eval(_FIND_SUBSCRIBE_JS)
            if result in ("clicked", "already"):
                break
            time.sleep(1) # Faster polling, better DOM timing

        if result == "already":
            print("    = {}: already subscribed".format(name))
            return "already"
        elif result == "clicked":
            time.sleep(1)
            print("    + {}: SUBSCRIBED!".format(name))
            return "subscribed"
        else:
            print("    ? {}: no subscribe button found (15 attempts)".format(name))
            return "no_button"
    except Exception as e:
        err = str(e).split("\n")[0][:80]
        print("    x {}: {}".format(name, err))
        return "error"

# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════
total_channels = sum(len(chs) for chs in EXPANSION_DOMAINS.values())

print("=" * 65)
print("  CORTEX YouTube Swarm Expansion - Creative Canvas")
print("  Targeting {} channels across {} domains".format(total_channels, len(EXPANSION_DOMAINS)))
print("  CDP Target: {}:{}".format(CDP_HOST, CDP_PORT))
print("=" * 65)

cdp_connect()
cdp_send("Page.enable")

# Go to YouTube first
cdp_navigate("https://www.youtube.com", wait=5)

# Check auth
auth = cdp_eval("""
    (function() {
        var avatar = document.querySelector('#avatar-btn, button#avatar-btn, img.yt-spec-avatar-shape__image');
        return avatar ? 'logged_in' : 'not_logged_in';
    })()
""")
print("[*] YouTube auth: {}".format(auth))

if auth != "logged_in":
    print("[!] Not logged into YouTube. Attempting auto-login via Sign In button...")
    # Try clicking Sign In
    sign_in = "not_found"
    for _ in range(5):
        sign_in = cdp_eval("""
            (function() {
                var links = document.querySelectorAll('a, button, yt-button-shape a');
                for (var i = 0; i < links.length; i++) {
                    if ((links[i].textContent || '').trim() === 'Sign in') {
                        links[i].click();
                        return 'clicked';
                    }
                }
                return 'not_found';
            })()
        """)
        if sign_in == "clicked":
            break
        import time
        time.sleep(2)
    if sign_in == "clicked":
        time.sleep(10)
        # Check for account chooser
        clicked_chooser = cdp_eval("""
            (function() {
                var items = document.querySelectorAll('*');
                for (var i = 0; i < items.length; i++) {
                    if ((items[i].getAttribute('data-identifier') || '') === 'inquiries@creativeliberationengine.org') {
                        var el = items[i];
                        var clickable = el.closest('[role="link"], [role="button"], li, div[jsaction]');
                        if (clickable) {
                            clickable.click();
                            return 'clicked_cortex';
                        }
                        el.click();
                        return 'clicked_cortex';
                    }
                }
                return 'no_chooser';
            })()
        """)
        
        # Wait up to 30 seconds for the browser to redirect back to youtube and load the page
        for _ in range(15):
            time.sleep(2)
            current_url = cdp_eval("document.location.href")
            if current_url and "youtube.com" in current_url:
                break
                
        # Additional buffer for DOM hydration
        time.sleep(5)
        
        # We only navigate if we somehow didn't end up back on YouTube
        current_url = cdp_eval("document.location.href") or ""
        if "youtube.com" not in current_url:
            cdp_navigate("https://www.youtube.com", wait=5)
            
        auth = cdp_eval("""
            (function() {
                var avatar = document.querySelector('#avatar-btn, button#avatar-btn, img.yt-spec-avatar-shape__image');
                return avatar ? 'logged_in' : 'not_logged_in';
            })()
        """)
        print("[*] YouTube auth after auto-login: {}".format(auth))

    if auth != "logged_in":
        print("[!] Still not logged in. Continuing anyway (will discover channels but can't subscribe).")

stats = {"subscribed": 0, "already": 0, "not_found": 0, "other": 0}
not_found = []

for domain, channels in EXPANSION_DOMAINS.items():
    print("\n{}".format("-" * 60))
    print("  {} ({} channels)".format(domain, len(channels)))
    print("{}".format("-" * 60))

    for name, handle in channels:
        result = subscribe_channel(name, handle)
        if result == "subscribed":
            stats["subscribed"] += 1
        elif result == "already":
            stats["already"] += 1
        elif result == "not_found":
            stats["not_found"] += 1
            not_found.append((domain, name, handle))
        else:
            stats["other"] += 1
        time.sleep(1.5)

_ws.close()

print("\n{}".format("=" * 65))
print("  EXPANSION RESULTS")
print("{}".format("=" * 65))
print("  New subscriptions:  {}".format(stats["subscribed"]))
print("  Already subscribed: {}".format(stats["already"]))
print("  Not found:          {}".format(stats["not_found"]))
print("  Other issues:       {}".format(stats["other"]))
if not_found:
    print("\n  Channels not found (need handle correction):")
    for domain, name, handle in not_found:
        print("    [{}] {} ({})".format(domain, name, handle))
print("\n[+] Swarm expansion complete.")
