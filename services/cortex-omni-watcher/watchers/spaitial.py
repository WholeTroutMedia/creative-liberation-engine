import asyncio
import logging
from playwright.async_api import async_playwright
import os

logger = logging.getLogger("SpaitialWatcher")

class SpaitialWatcher:
    def __init__(self, poll_interval=300):
        self.poll_interval = poll_interval
        self.url = "https://app.spaitial.ai/worlds"
        self._playwright = None
        self._context = None

    async def _ensure_browser(self):
        """Connect to central cortex-browser via CDP.
        
        This prevents embedded Playwright from spawning separate Chromium instances
        per watcher, saving RAM and eliminating zombie processes.
        """
        if self._playwright is None:
            self._playwright = await async_playwright().start()
            
            cdp_url = os.getenv("CDP_URL", "http://cortex-browser:9223")
            import socket
            from urllib.parse import urlparse, urlunparse
            parsed = urlparse(cdp_url)
            try:
                ip = socket.gethostbyname(parsed.hostname)
                cdp_endpoint = urlunparse(parsed._replace(netloc=f"{ip}:{parsed.port}"))
            except Exception:
                cdp_endpoint = cdp_url
                
            logger.info(f"Connecting to persistent cortex-browser at {cdp_endpoint} via CDP...")
            for attempt in range(5):
                try:
                    self._browser = await self._playwright.chromium.connect_over_cdp(cdp_endpoint)
                    break
                except Exception as e:
                    logger.warning(f"CDP connection attempt {attempt+1} failed: {e}")
                    await asyncio.sleep(2)
            else:
                raise RuntimeError(f"Could not connect to CDP at {cdp_endpoint}")
                
            self._context = self._browser.contexts[0] if self._browser.contexts else await self._browser.new_context()
        return self._context

    async def _close_browser(self):
        """Cleanly disconnect from CDP."""
        self._context = None
        if hasattr(self, '_browser') and self._browser:
            try:
                await self._browser.close()
            except Exception:
                pass
            self._browser = None
        if self._playwright:
            try:
                await self._playwright.stop()
            except Exception:
                pass
            self._playwright = None

    async def start(self):
        logger.info(f"INIT: SpaitialWatcher started. Polling every {self.poll_interval}s")
        while True:
            try:
                await self.create_digital_twin()
            except Exception as e:
                logger.error(f"Error in SpaitialWatcher: {e}")
                # If the browser crashed, tear it down so it relaunches next cycle
                await self._close_browser()
            await asyncio.sleep(self.poll_interval)

    def update_status(self, state, details):
        status_file = "/app/creative-liberation-engine/surfaces/spatial-os/public/cortex_status.json"
        import json
        from datetime import datetime
        data = {
            "state": state,
            "venue_id": "Hill Country",
            "details": details,
            "last_updated": datetime.now().isoformat()
        }
        try:
            with open(status_file, "w") as f:
                json.dump(data, f)
        except Exception as e:
            logger.error(f"Failed to write status file: {e}")

    async def create_digital_twin(self):
        logger.info("Starting digital twin creation process...")
        self.update_status("initializing", "Booting Headless Browser on NAS")

        context = await self._ensure_browser()
        page = context.pages[0] if context.pages else await context.new_page()

        logger.info(f"Navigating to {self.url}...")
        self.update_status("navigating", "Connecting to app.spaitial.ai...")
        await page.goto(self.url, wait_until="networkidle")
        await page.wait_for_timeout(5000)
        
        current_url = page.url
        logger.info(f"Current URL after load: {current_url}")
        
        email_locator = page.locator("input[type='email']")
        
        if "login" in current_url.lower() or "signin" in current_url.lower() or "auth" in current_url.lower() or await email_locator.count() > 0:
            logger.info("Login required. Attempting to authenticate...")
            self.update_status("authenticating", "Executing CORTEX Login Sequence")
            # Direct email/password login
            email_input = page.locator("input[type='email']").first
            if await email_input.is_visible():
                logger.info("Entering email credentials...")
                await email_input.fill("inquiries@creativeliberationengine.org")
                
                password_input = page.locator("input[type='password']").first
                if await password_input.is_visible():
                    await password_input.fill(os.getenv("CORTEX_PASSWORD", "WholeTroutMedia!2026"))
                    
                login_btn = page.locator("button:has-text('Login')").first
                if await login_btn.is_visible():
                    await login_btn.click()
                    logger.info("Clicked Login. Waiting for authentication...")
                    try:
                        await page.wait_for_url("**/worlds*", timeout=15000)
                        logger.info("Successfully redirected to worlds page.")
                    except Exception as e:
                        logger.warning(f"Redirect timeout or error: {e}. Checking URL.")
                        
            current_url = page.url
            if "worlds" not in current_url.lower():
                logger.info(f"Still not on worlds page. Current URL: {current_url}. Forcing goto...")
                await page.goto(self.url, wait_until="networkidle")
            
            await page.wait_for_timeout(5000)
        
        logger.info("Looking for 'Create World' button...")
        self.update_status("scanning", "Scanning DOM for Create World entry point")
        await page.screenshot(path="/app/creative-liberation-engine/surfaces/spatial-os/public/worlds_page.png")
        create_btn = page.locator("button:has-text('Create World')").first
        
        if await create_btn.is_visible():
            await create_btn.click()
            logger.info("Clicked 'Create World'.")
            self.update_status("interacting", "Opening Creation Modal")
            
            # Wait for form modal to appear
            await page.wait_for_timeout(2000)
            await page.screenshot(path="/app/creative-liberation-engine/surfaces/spatial-os/public/create_modal.png")
            
            logger.info("Submitting digital twin for Hill Country...")
            self.update_status("processing", "Injecting asset payload for Hill Country")
            # Fill out the form autonomously
            text_tab = page.get_by_role("tab", name="Text").first
            if await text_tab.is_visible():
                await text_tab.click()
                await page.wait_for_timeout(1000)
                
            input_field = page.locator("textarea").first
            if not await input_field.is_visible():
                input_field = page.locator("input[type='text'], input:not([type='file'])").first
            
            if await input_field.is_visible():
                await input_field.fill("Hill Country")
                # Check for Create or Generate buttons
                submit_btn = page.locator("button:has-text('Create')").last
                if not await submit_btn.is_visible():
                    submit_btn = page.locator("button:has-text('Generate')").last
                    
                if await submit_btn.is_visible():
                    await submit_btn.click()
                    logger.info("Successfully submitted Hill Country digital twin.")
                    self.update_status("success", "Digital Twin transmission complete")
                    await page.wait_for_timeout(3000) # Wait for submission
                else:
                    logger.warning("Submit button not found in modal.")
                    self.update_status("error", "Submit button not found in modal")
            else:
                logger.warning("Text input field not found. Dumping HTML...")
                html_content = await page.content()
                with open("/app/creative-liberation-engine/surfaces/spatial-os/public/modal_source.html", "w") as f:
                    f.write(html_content)
                self.update_status("error", "Text input field not found")
        else:
            # Try anchor link if button isn't there
            create_link = page.locator("a:has-text('Create')").first
            if await create_link.is_visible():
                await create_link.click()
                logger.info("Clicked 'Create' link.")
                self.update_status("interacting", "Navigating via Create link")
            else:
                logger.warning("Create World button not found. Verify Cortex login status via Persistent Context.")
                self.update_status("failed", "Create World button not found. Session expired?")
                # Also try Create New, etc.
                html_content = await page.content()
                with open("/app/creative-liberation-engine/surfaces/spatial-os/public/page_source.html", "w") as f:
                    f.write(html_content)

        logger.info("Digital twin creation attempt finished.")
        # We don't reset to idle immediately so the UI can show "success"
        await asyncio.sleep(10)
        self.update_status("idle", "Awaiting next spatial task")
