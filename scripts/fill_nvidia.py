import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://localhost:9222")
        context = browser.contexts[0]
        
        nvidia_page = None
        for page in context.pages:
            if "nvidia" in page.url.lower():
                nvidia_page = page
                break
                
        if nvidia_page:
            print("Filling out NVIDIA form...")
            
            # Fill email if present
            try:
                if await nvidia_page.locator("input[type='email']").is_visible(timeout=2000):
                    print("Filling email...")
                    await nvidia_page.fill("input[type='email']", "inquiries@creativeliberationengine.org")
            except: pass
            
            # Fill password
            try:
                if await nvidia_page.locator("input[type='password']").is_visible(timeout=2000):
                    print("Filling password...")
                    await nvidia_page.fill("input[type='password']", "WholeTroutMedia!2026")
            except: pass
            
            # Uncheck remember me if needed
            try:
                await nvidia_page.uncheck("input[type='checkbox']")
            except: pass
            
            # Click Continue
            print("Clicking Continue...")
            await nvidia_page.locator("button:has-text('Continue'), button:has-text('Next'), button[type='submit']").first.click()
            
            print("Waiting for page load...")
            await nvidia_page.wait_for_timeout(4000)
            
            # Check for new inputs
            print("Checking new inputs...")
            inputs = await nvidia_page.locator("input").element_handles()
            for i in inputs:
                name = await i.get_attribute("name")
                type_ = await i.get_attribute("type")
                id_ = await i.get_attribute("id")
                print(f"Input: id={id_}, name={name}, type={type_}")
                
            buttons = await nvidia_page.locator("button").element_handles()
            for b in buttons:
                text = await b.inner_text()
                print(f"Button: {text.strip()}")
                
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
