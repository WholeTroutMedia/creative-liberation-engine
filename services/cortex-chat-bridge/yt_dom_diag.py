#!/usr/bin/env python3
"""Debug: What is on the page after navigating to a YouTube channel?"""
import asyncio, json, re
import aiohttp, websockets

CDP_URL = "http://localhost:9223"

async def get_page_ws():
    async with aiohttp.ClientSession() as s:
        async with s.get(f"{CDP_URL}/json", headers={"Host": "localhost"}) as r:
            tabs = await r.json()
    page = next((t for t in tabs if t.get("type") == "page"), None)
    if not page:
        raise RuntimeError("No page tab")
    return re.sub(r"ws://[^/]+", "ws://localhost:9223", page["webSocketDebuggerUrl"])

async def cdp(ws, cid, method, params=None):
    cid[0] += 1
    msg = {"id": cid[0], "method": method}
    if params: msg["params"] = params
    await ws.send(json.dumps(msg))
    while True:
        raw = await asyncio.wait_for(ws.recv(), 20)
        data = json.loads(raw)
        if data.get("id") == cid[0]:
            return data

async def main():
    # Step 1: Navigate via CDP
    ws_url = await get_page_ws()
    ws = await websockets.connect(ws_url, additional_headers={"Host": "localhost"})
    cid = [0]
    await cdp(ws, cid, "Page.navigate", {"url": "https://www.youtube.com/@UnrealSensei"})
    await ws.close()

    # Step 2: Wait for page load
    print("Waiting 12 seconds for page load...")
    await asyncio.sleep(12)

    # Step 3: Reconnect and check
    ws_url = await get_page_ws()
    ws = await websockets.connect(ws_url, additional_headers={"Host": "localhost"})
    cid = [0]

    # Check multiple times
    for attempt in range(5):
        result = await cdp(ws, cid, "Runtime.evaluate", {
            "expression": """
                (function() {
                    var info = {};
                    info.url = window.location.href;
                    info.title = document.title;
                    info.readyState = document.readyState;
                    info.bodyLen = document.body ? document.body.innerHTML.length : 0;

                    // All button texts
                    var btns = document.querySelectorAll('button');
                    var btnTexts = [];
                    for (var i = 0; i < Math.min(btns.length, 30); i++) {
                        var t = (btns[i].textContent || '').trim();
                        if (t.length > 0 && t.length < 80) btnTexts.push(t);
                    }
                    info.buttonCount = btns.length;
                    info.buttonTexts = btnTexts;

                    // subscribe renderers
                    info.subRenderers = document.querySelectorAll('ytd-subscribe-button-renderer').length;

                    // yt-button-shape buttons
                    var ytBtns = document.querySelectorAll('yt-button-shape button');
                    var ytTexts = [];
                    for (var j = 0; j < Math.min(ytBtns.length, 20); j++) {
                        var txt = (ytBtns[j].textContent || '').trim();
                        if (txt.length > 0 && txt.length < 80) ytTexts.push(txt);
                    }
                    info.ytButtonShapeCount = ytBtns.length;
                    info.ytButtonShapeTexts = ytTexts;

                    return JSON.stringify(info, null, 2);
                })()
            """,
            "returnByValue": True,
            "awaitPromise": True,
        })

        if "error" in result:
            print(f"  Attempt {attempt+1}: CDP error: {result['error']}")
            # Reconnect
            await ws.close()
            await asyncio.sleep(3)
            ws_url = await get_page_ws()
            ws = await websockets.connect(ws_url, additional_headers={"Host": "localhost"})
            cid = [0]
            continue

        val = result.get("result", {}).get("result", {}).get("value", "null")
        print(f"  Attempt {attempt+1}: {val}")

        if val != "null":
            data = json.loads(val)
            if data.get("buttonCount", 0) > 5:
                break  # Page is hydrated enough
        await asyncio.sleep(3)

    await ws.close()

asyncio.run(main())
