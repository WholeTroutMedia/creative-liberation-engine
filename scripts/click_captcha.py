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
            print("Checking for Turnstile CAPTCHA...")
            
            # Find Turnstile iframes
            for frame in nvidia_page.frames:
                if "challenges.cloudflare.com" in frame.url:
                    print(f"Found Cloudflare iframe: {frame.url}")
                    try:
                        # Wait for the turnstile checkbox
                        cb = frame.locator(".cb-c")
                        if await cb.is_visible(timeout=5000):
                            print("Clicking Turnstile...")
                            await cb.click()
                            await nvidia_page.wait_for_timeout(3000)
                    except Exception as e:
                        print(f"Failed to click Turnstile: {e}")
                        
            # Wait to see if the button is enabled
            is_disabled = await nvidia_page.locator("button:has-text('Create Account')").first.get_attribute("disabled")
            if is_disabled is not None:
                print("Create Account button is STILL disabled.")
            else:
                print("Create Account button is now ENABLED! Clicking...")
                await nvidia_page.locator("button:has-text('Create Account')").first.click()
                await nvidia_page.wait_for_timeout(5000)
                print("Success! URL:", nvidia_page.url)
                
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
