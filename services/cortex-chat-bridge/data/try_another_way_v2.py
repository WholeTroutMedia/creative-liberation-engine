import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.connect_over_cdp("http://192.168.224.3:9224")
        ctx = browser.contexts[0] if browser.contexts else None
        if not ctx:
            print("No contexts")
            return
        page = ctx.pages[1]
        
        # Click "Try another way" using page.locator and standard text matching
        try:
            el = page.locator("text=Try another way").first
            if await el.count() > 0:
                await el.click()
                print("Clicked Try another way link/span")
                await asyncio.sleep(5)
                await page.screenshot(path="/app/data/try_another_way_options.png")
                print("Saved try_another_way_options.png")
                return
            else:
                print("Element not found")
        except Exception as e:
            print("Error clicking:", e)

asyncio.run(main())
