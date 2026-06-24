import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.connect_over_cdp("http://192.168.240.2:9223")
        page = browser.contexts[0].pages[0]
        print(f"Connected to {page.url}")

        req = await page.query_selector('[aria-label*="Message request" i]')
        if req:
            print("Clicking message request via mouse coordinates...")
            box = await req.bounding_box()
            if box:
                await page.mouse.click(box['x'] + box['width']/2, box['y'] + box['height']/2)
            
            print("Waiting for network idle...")
            try:
                await page.wait_for_load_state('networkidle', timeout=5000)
            except Exception as e:
                print(f"Network idle timeout: {e}")
            await asyncio.sleep(2)
            
            try:
                accept = await page.query_selector('button:has-text("Accept"), div[role="button"]:has-text("Accept"), span:has-text("Accept")')
                if accept:
                    print("Clicking Accept via mouse coordinates...")
                    box = await accept.bounding_box()
                    if box:
                        await page.mouse.click(box['x'] + box['width']/2, box['y'] + box['height']/2)
                    await asyncio.sleep(3)
                else:
                    print("Accept button not found.")
            except Exception as e:
                print(f"Error finding Accept button: {e}")
                
            html = await page.content()
            with open('/app/chat_dom_accepted.html', 'w', encoding='utf-8') as f:
                f.write(html)
            print("DOM dumped to /app/chat_dom_accepted.html")
        else:
            print("No message request found.")

asyncio.run(main())
