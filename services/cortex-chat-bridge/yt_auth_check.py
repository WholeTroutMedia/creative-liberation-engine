#!/usr/bin/env python3
"""Quick auth check — runs inside cortex-browser container."""
import asyncio, json, re
import aiohttp, websockets

async def check():
    async with aiohttp.ClientSession() as s:
        async with s.get("http://localhost:9223/json", headers={"Host": "localhost"}) as r:
            tabs = await r.json()
    page = next((t for t in tabs if t.get("type") == "page"), None)
    if not page:
        print("No page tab")
        return
    ws_url = re.sub(r"ws://[^/]+", "ws://localhost:9223", page["webSocketDebuggerUrl"])
    ws = await websockets.connect(ws_url, additional_headers={"Host": "localhost"})
    await ws.send(json.dumps({"id": 1, "method": "Page.enable"}))
    await ws.recv()
    await ws.send(json.dumps({"id": 2, "method": "Page.navigate", "params": {"url": "https://www.youtube.com"}}))
    await asyncio.sleep(6)
    # Drain events
    while True:
        try:
            await asyncio.wait_for(ws.recv(), 0.2)
        except:
            break
    # Check auth
    js = """
    (function() {
        var results = [];
        var signIn = document.querySelector('a[aria-label="Sign in"]');
        if (signIn) results.push('SIGN_IN_BUTTON_FOUND');
        var selectors = ['#avatar-btn', 'button#avatar-btn', 'yt-img-shadow#avatar',
                         'img#avatar', '#avatar', 'ytd-topbar-menu-button-renderer img',
                         'ytd-topbar-menu-button-renderer', '#buttons ytd-topbar-menu-button-renderer',
                         'yt-icon-button#avatar-btn', '#end #avatar-btn'];
        selectors.forEach(function(s) {
            var el = document.querySelector(s);
            if (el) results.push('FOUND: ' + s + ' tag=' + el.tagName);
        });
        results.push('TITLE: ' + document.title);
        // Count top bar buttons
        var topBtns = document.querySelectorAll('ytd-topbar-menu-button-renderer');
        results.push('TOP_BUTTONS: ' + topBtns.length);
        return results.join(' | ');
    })()
    """
    await ws.send(json.dumps({"id": 3, "method": "Runtime.evaluate",
                               "params": {"expression": js, "returnByValue": True, "awaitPromise": True}}))
    resp = json.loads(await ws.recv())
    print(resp.get("result", {}).get("result", {}).get("value", "no value"))
    await ws.close()

asyncio.run(check())
