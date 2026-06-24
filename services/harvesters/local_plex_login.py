import asyncio
import os
import re
from playwright.async_api import async_playwright

async def main():
    print('[*] Starting local visible Playwright browser...')
    async with async_playwright() as p:
        # Launch visible browser
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        print('[*] Navigating to Plex Sign in...')
        await page.goto('https://app.plex.tv/desktop#!/login')
        
        print('[*] Please log in and solve any CAPTCHAs in the browser window!')
        print('[*] Waiting for successful login (myPlexAccessToken in localStorage)...')
        
        token = None
        for i in range(120): # wait up to 120 seconds
            await page.wait_for_timeout(1000)
            token = await page.evaluate('''() => {
                const token = localStorage.getItem('myPlexAccessToken');
                // Ensure it's not a guest token (which is what we get on the auth page initially)
                // A real token usually has a different format or length, or we can just wait until
                // the URL changes from the auth page back to the main app.
                return token;
            }''')
            url = page.url
            if token and 'auth' not in url:
                print(f'[+] Login successful! Token extracted.')
                break
                
        if not token or 'auth' in page.url:
            print('[!] Failed to login or extract token within 120 seconds.')
            await browser.close()
            return
            
        print(f'[+] Token: {token[:8]}...')
        
        # Write to .env
        ENV_PATH = r'y:\creative-liberation-engine\.env'
        if os.path.exists(ENV_PATH):
            with open(ENV_PATH, 'r') as f:
                content = f.read()
            if 'PLEX_TOKEN=' in content:
                content = re.sub(r'PLEX_TOKEN=.*', f'PLEX_TOKEN={token}', content)
            else:
                content += f'\nPLEX_TOKEN={token}\n'
            with open(ENV_PATH, 'w') as f:
                f.write(content)
            print('[+] Saved PLEX_TOKEN to y:\\creative-liberation-engine\\.env')
        else:
            print(f'[!] Could not find .env at {ENV_PATH}')
            
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
