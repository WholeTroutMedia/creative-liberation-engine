import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        # Connect using the resolved IP directly
        browser = await p.chromium.connect_over_cdp("http://172.28.0.2:9224")
        print(f"Total contexts: {len(browser.contexts)}")
        for i, ctx in enumerate(browser.contexts):
            print(f"Context {i} pages: {len(ctx.pages)}")
            for j, page in enumerate(ctx.pages):
                print(f"Context {i}, Page {j} URL: {page.url}")
                try:
                    await page.screenshot(path=f"/app/data/screenshot_ctx{i}_page{j}.png")
                    print(f"  Screenshot saved to /app/data/screenshot_ctx{i}_page{j}.png")
                except Exception as e:
                    print(f"  Failed to save screenshot: {e}")
        print("Screenshot execution finished!")

asyncio.run(main())
