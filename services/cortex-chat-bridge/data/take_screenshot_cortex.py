import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.connect_over_cdp("http://192.168.224.3:9224")
        ctx = browser.contexts[0] if browser.contexts else None
        if not ctx:
            print("No contexts")
            return
        for i, p in enumerate(ctx.pages):
            try:
                await p.screenshot(path=f"/app/data/debug_page_{i}.png")
                print(f"Saved page {i}: {p.url}")
            except Exception as e:
                print(f"Failed to screenshot page {i} ({p.url}): {e}")

asyncio.run(main())
