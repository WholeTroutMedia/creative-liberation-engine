#!/usr/bin/env python3
"""
CORTEX Headless YouTube Subscriber v6 — API-based approach.
Uses YouTube's internal subscribe API via the browser's authenticated session.
Extracts session cookies and SAPISIDHASH, then makes direct API calls.
"""
import asyncio, json, re, sys, time, hashlib
import aiohttp, websockets

CDP_URL = "http://localhost:9223"

AGENT_DOMAINS = {
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
    "ATLAS / Infrastructure": [
        ("Techno Tim", "@TechnoTim"),
        ("Christian Lempa", "@christianlempa"),
        ("Jeff Geerling", "@JeffGeerling"),
        ("TechWorld with Nana", "@TechWorldwithNana"),
        ("Learn Linux TV", "@LearnLinuxTV"),
        ("NetworkChuck", "@NetworkChuck"),
        ("Lawrence Systems", "@ABORAT"),
    ],
    "VERA / Web Architecture": [
        ("Theo - t3.gg", "@t3dotgg"),
        ("JavaScript Mastery", "@javascriptmastery"),
        ("The Net Ninja", "@NetNinja"),
        ("Traversy Media", "@TraversyMedia"),
        ("Fireship", "@Fireship"),
    ],
    "CORTEX / AI & Agentic": [
        ("Andrej Karpathy", "@AndrejKarpathy"),
        ("3Blue1Brown", "@3blue1brown"),
        ("Yannic Kilcher", "@YannicKilcher"),
        ("Two Minute Papers", "@TwoMinutePapers"),
        ("AI Explained", "@AiExplained"),
        ("DeepLearning.AI", "@Deeplearningai"),
        ("Sentdex", "@sentdex"),
    ],
    "ATHENA / Strategy": [
        ("Y Combinator", "@ycombinator"),
        ("Lex Fridman", "@lexfridman"),
        ("Lenny's Podcast", "@LennysPodcast"),
        ("a16z", "@a16z"),
        ("Reducible", "@Reducible"),
    ],
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


async def get_page_ws():
    """Get WebSocket URL for active page tab."""
    async with aiohttp.ClientSession() as s:
        async with s.get(f"{CDP_URL}/json", headers={"Host": "localhost"}) as r:
            tabs = await r.json()
    page = next((t for t in tabs if t.get("type") == "page"), None)
    if not page:
        raise RuntimeError("No page tab")
    return re.sub(r"ws://[^/]+", "ws://localhost:9223", page["webSocketDebuggerUrl"])


async def cdp_eval(ws, cid_ref, expression, timeout=20):
    """Evaluate JS expression via CDP, return value. None on error."""
    cid_ref[0] += 1
    cid = cid_ref[0]
    msg = {
        "id": cid,
        "method": "Runtime.evaluate",
        "params": {"expression": expression, "returnByValue": True, "awaitPromise": True},
    }
    await ws.send(json.dumps(msg))
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        remaining = max(0.1, deadline - asyncio.get_event_loop().time())
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=min(3, remaining))
        except asyncio.TimeoutError:
            continue
        data = json.loads(raw)
        if data.get("id") == cid:
            if "error" in data:
                return None
            return data.get("result", {}).get("result", {}).get("value")
    return None


async def subscribe_via_js(ws, cid_ref, handle):
    """Subscribe to a channel using fetch() inside the browser context.
    This uses YouTube's internal InnerTube API with the browser's existing auth.
    First resolves the channel handle to a channel ID, then subscribes.
    """
    # Step 1: Resolve handle to channel ID using InnerTube browse API
    result = await cdp_eval(ws, cid_ref, f"""
        (async function() {{
            try {{
                // Resolve channel from handle using browse endpoint
                var resp = await fetch('https://www.youtube.com/{handle}', {{
                    credentials: 'include',
                    headers: {{ 'Accept': 'text/html' }}
                }});
                var html = await resp.text();

                // Extract channel ID from the page source
                var match = html.match(/"channelId":"(UC[^"]+)"/);
                if (!match) {{
                    // Try alternate pattern
                    match = html.match(/channel_id=([^"&]+)/);
                }}
                if (!match) {{
                    return JSON.stringify({{error: 'no_channel_id'}});
                }}
                var channelId = match[1];

                // Step 2: Check if already subscribed
                var subMatch = html.match(/"subscribed":(true|false)/);
                if (subMatch && subMatch[1] === 'true') {{
                    return JSON.stringify({{status: 'already', channelId: channelId}});
                }}

                // Step 3: Extract XSRF token from ytcfg
                // Get it from the window context
                var apiKey = (window.ytcfg && window.ytcfg.get && window.ytcfg.get('INNERTUBE_API_KEY')) || '';
                var clientName = (window.ytcfg && window.ytcfg.get && window.ytcfg.get('INNERTUBE_CLIENT_NAME')) || 'WEB';
                var clientVersion = (window.ytcfg && window.ytcfg.get && window.ytcfg.get('INNERTUBE_CLIENT_VERSION')) || '2.20240101.00.00';

                // Extract SAPISIDHASH for auth
                var cookies = document.cookie.split(';');
                var sapisid = '';
                for (var i = 0; i < cookies.length; i++) {{
                    var c = cookies[i].trim();
                    if (c.startsWith('SAPISID=') || c.startsWith('__Secure-3PAPISID=')) {{
                        sapisid = c.split('=')[1];
                        break;
                    }}
                }}

                if (!apiKey) {{
                    return JSON.stringify({{error: 'no_api_key', channelId: channelId}});
                }}

                // Step 4: Subscribe using InnerTube subscribe endpoint
                var subscribeResp = await fetch('https://www.youtube.com/youtubei/v1/subscription/subscribe?key=' + apiKey, {{
                    method: 'POST',
                    credentials: 'include',
                    headers: {{
                        'Content-Type': 'application/json',
                        'X-Youtube-Client-Name': '1',
                        'X-Youtube-Client-Version': clientVersion,
                    }},
                    body: JSON.stringify({{
                        context: {{
                            client: {{
                                clientName: 'WEB',
                                clientVersion: clientVersion,
                            }},
                        }},
                        channelIds: [channelId],
                    }}),
                }});

                var subResult = await subscribeResp.json();
                if (subscribeResp.ok) {{
                    return JSON.stringify({{status: 'subscribed', channelId: channelId}});
                }} else {{
                    return JSON.stringify({{status: 'api_error', code: subscribeResp.status, channelId: channelId}});
                }}
            }} catch(e) {{
                return JSON.stringify({{error: e.message}});
            }}
        }})()
    """, timeout=30)

    if result is None:
        return {"error": "cdp_timeout"}
    try:
        return json.loads(result)
    except:
        return {"error": f"parse_error: {result}"}


async def main():
    print("=" * 65)
    print("  CORTEX Educational Harvest (Headless v6 — API Mode)")
    print("=" * 65)

    # Connect to browser
    ws_url = await get_page_ws()
    ws = await websockets.connect(ws_url, additional_headers={"Host": "localhost"})
    cid = [0]
    print(f"  CDP connected: {ws_url}")

    # First, make sure we're on youtube.com so we have access to ytcfg
    await cdp_eval(ws, cid, "void(0)")  # test connection

    # Check auth by looking at cookies
    auth_check = await cdp_eval(ws, cid, """
        (function() {
            var cookies = document.cookie;
            var hasSID = cookies.includes('SID=');
            var hasSAPISID = cookies.includes('SAPISID=') || cookies.includes('__Secure-3PAPISID=');
            var hasAPIKey = !!(window.ytcfg && window.ytcfg.get && window.ytcfg.get('INNERTUBE_API_KEY'));
            return JSON.stringify({hasSID: hasSID, hasSAPISID: hasSAPISID, hasAPIKey: hasAPIKey, url: window.location.href});
        })()
    """)
    print(f"  Auth check: {auth_check}")

    if auth_check:
        auth_info = json.loads(auth_check)
        if not auth_info.get("hasSID"):
            print("  WARNING: No SID cookie — may not be logged in")
        if not auth_info.get("hasAPIKey"):
            print("  WARNING: No InnerTube API key — need to be on youtube.com")

    total = sum(len(chs) for chs in AGENT_DOMAINS.values())
    print(f"\n  {total} channels / {len(AGENT_DOMAINS)} domains\n")

    stats = {"subscribed": 0, "already": 0, "error": 0}

    for domain, channels in AGENT_DOMAINS.items():
        print(f"\n  --- {domain} ({len(channels)}) ---")
        for name, handle in channels:
            result = await subscribe_via_js(ws, cid, handle)
            status = result.get("status", result.get("error", "unknown"))

            if status == "already":
                print(f"    OK {name}: already subscribed")
                stats["already"] += 1
            elif status == "subscribed":
                print(f"    ++ {name}: SUBSCRIBED")
                stats["subscribed"] += 1
            else:
                print(f"    ?? {name}: {status}")
                stats["error"] += 1

            # Small delay to avoid rate limiting
            await asyncio.sleep(0.5)

    await ws.close()

    print(f"\n{'=' * 65}")
    print(f"  New: {stats['subscribed']}  Already: {stats['already']}  Errors: {stats['error']}")
    print("DONE")


if __name__ == "__main__":
    asyncio.run(main())
