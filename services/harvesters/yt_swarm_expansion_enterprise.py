#!/usr/bin/env python3
"""
CORTEX YouTube Swarm Expansion — Enterprise Intelligence
=======================================================================
Targets new enterprise-grade knowledge domains to transform the
Creative Liberation Engine from a creative studio into a sovereign agentic enterprise.

NEW DOMAINS:
  - academy-yt-lex-law         (Contract law, IP, corporate compliance)
  - academy-yt-lex-ethics      (AI ethics, philosophy, governance)
  - academy-yt-market-finance  (Corporate finance, economics, strategy)
  - academy-yt-cyber-ops       (Cybersecurity, DevOps, zero-trust)
  - academy-yt-game-theory     (Negotiation, behavioral psychology, strategy)

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
# EXPANSION CHANNELS — Enterprise Intelligence
# ═══════════════════════════════════════════════════════════════════

EXPANSION_DOMAINS = {
    # ─────────────────────────────────────────────────────────────
    # LEX / Law & Contract Intelligence
    # ─────────────────────────────────────────────────────────────
    "LEX / Law & Contracts [NEW]": [
        ("LegalEagle", "@LegalEagle"),                   # Legal analysis, contract breakdowns
        ("Law By Mike", "@lawbymike"),                    # Practical law for businesses
        ("The Law Says What", "@TheLawSaysWhat"),         # Legal frameworks explained
        ("Lawful Masses", "@LawfulMasses"),               # IP law, copyright, fair use
        ("Think Media", "@ThinkMedia"),                   # Creator rights and monetization law
        ("Hoeg Law", "@HoegLaw"),                        # Entertainment & tech law
        ("Steve Lehto", "@staboroflove"),                 # Business litigation, consumer law
        ("Attorney Tom", "@AttorneyTom"),                 # Funny legal analysis
        ("VisualPolitik EN", "@VisualPolitikEN"),         # Geopolitical legal frameworks
        ("Evan Carmichael", "@EvanCarmichael"),           # Startup legal + business
    ],

    # ─────────────────────────────────────────────────────────────
    # LEX / AI Ethics & Digital Governance
    # ─────────────────────────────────────────────────────────────
    "LEX / AI Ethics & Governance [NEW]": [
        ("AI Explained", "@aiexplained-official"),        # AI policy and safety
        ("Robert Miles", "@RobertMilesAI"),               # AI safety research
        ("Machine Learning Street Talk", "@MLSTresearch"),# AI ethics debate
        ("Two Minute Papers", "@TwoMinutePapers"),        # AI capability tracking
        ("Wes Roth", "@WesRoth"),                        # AI governance and policy
        ("Matt Wolfe", "@maboroflove"),                   # AI enterprise and tools
        ("The AI Advantage", "@TheAiAdvantage"),          # AI application ethics
        ("David Shapiro", "@DaveShap"),                   # AI alignment, philosophy
        ("Connor Leahy", "@ConnorLeahy"),                 # AI safety advocacy
        ("Yannic Kilcher", "@YannicKilcher"),             # ML paper reviews + ethics
    ],

    # ─────────────────────────────────────────────────────────────
    # MARKET / Corporate Finance & Economics
    # ─────────────────────────────────────────────────────────────
    "MARKET / Finance & Economics [NEW]": [
        ("Patrick Boyle", "@PBoyle"),                     # Hedge fund finance, macro
        ("The Plain Bagel", "@ThePlainBagel"),            # Economics explained
        ("Economics Explained", "@EconomicsExplained"),    # Macroeconomics
        ("Aswath Damodaran", "@AswathDamodaranonValuation"), # Valuation master (NYU)
        ("How Money Works", "@HowMoneyWorks"),            # Financial systems
        ("Money & Macro", "@MoneyMacro"),                 # Central banking, monetary policy
        ("Ben Felix", "@BenFelixCSI"),                   # Evidence-based finance
        ("Graham Stephan", "@GrahamStephan"),             # Personal & business finance
        ("All-In Podcast", "@alaboroflove"),              # VC / macro strategy
        ("Y Combinator", "@ycombinator"),                 # Startup economics
        ("Acquire", "@acquiredotcom"),                    # Business acquisition strategy
        ("Slidebean", "@slidebean"),                      # Startup finance teardowns
    ],

    # ─────────────────────────────────────────────────────────────
    # CYBER / Cybersecurity & Infrastructure
    # ─────────────────────────────────────────────────────────────
    "CYBER / Security & Infrastructure [NEW]": [
        ("NetworkChuck", "@NetworkChuck"),                 # Networking, Docker, cybersecurity
        ("John Hammond", "@_JohnHammond"),                # Offensive security, CTFs
        ("David Bombal", "@davidbombal"),                 # Networking and ethical hacking
        ("LiveOverflow", "@LiveOverflow"),                # Binary exploitation, web security
        ("TechWorld with Nana", "@TechWorldwithNana"),    # DevOps, K8s, CI/CD
        ("Jeff Geerling", "@JeffGeerling"),               # Self-hosting, home lab, Ansible
        ("Fireship", "@Fireship"),                        # Fast-paced dev and infrastructure
        ("Mental Outlaw", "@MentalOutlaw"),               # Linux, privacy, security
        ("Christian Lempa", "@ChristianLempa"),           # Home lab, Docker, proxmox
        ("Wolfgang", "@WolfgangsChannel"),                # Self-hosting and NAS builds
        ("Level1Techs", "@Level1Techs"),                  # Enterprise hardware and Linux
        ("IppSec", "@IppSec"),                            # HTB walkthroughs, pentesting
    ],

    # ─────────────────────────────────────────────────────────────
    # STRATEGY / Game Theory & Negotiation
    # ─────────────────────────────────────────────────────────────
    "STRATEGY / Game Theory & Negotiation [NEW]": [
        ("Chris Voss", "@NegotiationMastery"),            # FBI negotiation tactics
        ("Charisma on Command", "@Charismaoncommand"),    # Behavioral psychology
        ("Valuetainment", "@valuetainment"),              # Business strategy
        ("Simon Sinek", "@SimonSinek"),                   # Leadership psychology
        ("Jordan Peterson", "@JordanBPeterson"),          # Behavioral analysis
        ("Sprouts", "@spraboroflove"),                    # Psychology and game theory
        ("Primer", "@PrimerBlobs"),                       # Game theory simulations
        ("Veritasium", "@veritasium"),                    # Decision-making science
        ("CGP Grey", "@CGPGrey"),                         # Systems thinking
        ("Kurzgesagt", "@kurzgesagt"),                    # Strategic systems and science
    ],
}

# ═══════════════════════════════════════════════════════════════════
# CDP ENGINE (identical to existing swarm expansions)
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
    # Enable page events so we can catch loadEventFired
    try:
        cdp_send("Page.enable", timeout=5)
    except Exception:
        pass
    cdp_send("Page.navigate", {"url": url})
    # Wait for Page.loadEventFired from the websocket stream (real load signal)
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
        # Fallback: if events didn't fire, give the page a static wait
        time.sleep(wait)
    # Always give YouTube's JS hydration a moment after load event
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
    // Method 1: ytd-subscribe-button-renderer (classic YouTube)
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
    // Method 2: yt-subscribe-button-view-model (2024+ YouTube redesign)
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
    // Method 3: Generic fallback — any button with Subscribe text
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
        cdp_navigate(url)
        title = cdp_eval("document.title") or ""
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

        # Poll for the subscribe button — retry up to 6 times (12s total)
        # This handles YouTube's lazy JS hydration properly
        result = "no_button"
        for attempt in range(6):
            result = cdp_eval(_FIND_SUBSCRIBE_JS)
            if result in ("clicked", "already"):
                break
            time.sleep(2)

        if result == "already":
            print("    = {}: already subscribed".format(name))
            return "already"
        elif result == "clicked":
            time.sleep(2)
            print("    + {}: SUBSCRIBED!".format(name))
            return "subscribed"
        else:
            print("    ? {}: no subscribe button found (6 attempts)".format(name))
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
print("  CORTEX YouTube Swarm Expansion - Enterprise Intelligence")
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
        cdp_eval("""
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
        time.sleep(10)
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
        time.sleep(1.0)

_ws.close()

print("\n{}".format("=" * 65))
print("  ENTERPRISE EXPANSION RESULTS")
print("{}".format("=" * 65))
print("  New subscriptions:  {}".format(stats["subscribed"]))
print("  Already subscribed: {}".format(stats["already"]))
print("  Not found:          {}".format(stats["not_found"]))
print("  Other issues:       {}".format(stats["other"]))
if not_found:
    print("\n  Channels not found (need handle correction):")
    for domain, name, handle in not_found:
        print("    [{}] {} ({})".format(domain, name, handle))
print("\n[+] Enterprise swarm expansion complete.")
