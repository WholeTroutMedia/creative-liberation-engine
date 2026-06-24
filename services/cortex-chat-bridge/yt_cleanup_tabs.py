#!/usr/bin/env python3
"""List all CDP tabs and close extras, keeping only one."""
import asyncio, json
import aiohttp

CDP_URL = "http://localhost:9223"

async def main():
    async with aiohttp.ClientSession() as s:
        async with s.get(f"{CDP_URL}/json", headers={"Host": "localhost"}) as r:
            tabs = await r.json()

    print(f"Total tabs: {len(tabs)}")
    page_tabs = []
    for t in tabs:
        print(f"  {t['id'][:20]} | type={t.get('type','')} | {t.get('url','')[:70]}")
        if t.get("type") == "page":
            page_tabs.append(t)

    # Close all but the first page tab
    if len(page_tabs) > 1:
        print(f"\nClosing {len(page_tabs)-1} extra page tabs...")
        for t in page_tabs[1:]:
            async with aiohttp.ClientSession() as s:
                async with s.get(f"{CDP_URL}/json/close/{t['id']}", headers={"Host": "localhost"}) as r:
                    result = await r.text()
                    print(f"  Closed {t['id'][:16]}: {result.strip()}")
            await asyncio.sleep(0.5)

    # List remaining
    async with aiohttp.ClientSession() as s:
        async with s.get(f"{CDP_URL}/json", headers={"Host": "localhost"}) as r:
            tabs = await r.json()
    print(f"\nRemaining tabs: {len(tabs)}")
    for t in tabs:
        print(f"  {t['id'][:20]} | type={t.get('type','')} | {t.get('url','')[:70]}")

asyncio.run(main())
