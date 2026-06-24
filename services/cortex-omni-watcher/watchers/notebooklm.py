import asyncio
import logging
from playwright.async_api import async_playwright
import aiohttp

logger = logging.getLogger("NotebookLMWatcher")

class NotebookLMWatcher:
    def __init__(self, poll_interval=60):
        self.poll_interval = poll_interval
        self.base_url = "https://notebooklm.google.com/"
        self.storage_state = "/app/cortex_state.json"

    async def start(self):
        logger.info(f"Starting NotebookLM Watcher. Polling every {self.poll_interval}s.")
        import os
        import socket
        from urllib.parse import urlparse, urlunparse

        async with async_playwright() as p:
            cdp_url = os.getenv("CDP_URL", "http://cortex-browser:9223")
            parsed = urlparse(cdp_url)
            try:
                ip = socket.gethostbyname(parsed.hostname)
                cdp_endpoint = urlunparse(parsed._replace(netloc=f"{ip}:{parsed.port}"))
            except Exception:
                cdp_endpoint = cdp_url
                
            logger.info(f"Connecting to persistent cortex-browser at {cdp_endpoint} via CDP...")
            for attempt in range(10):
                try:
                    browser = await p.chromium.connect_over_cdp(cdp_endpoint)
                    break
                except Exception as e:
                    logger.warning(f"CDP connection attempt {attempt+1} failed: {e}")
                    await asyncio.sleep(2)
            else:
                raise RuntimeError(f"Could not connect to CDP at {cdp_endpoint}")
            
            # Use the existing context from the persistent browser
            context = browser.contexts[0] if browser.contexts else await browser.new_context()
            page = await context.new_page()
            
            while True:
                try:
                    await self.poll_notebooks(page)
                except Exception as e:
                    logger.error(f"Error polling NotebookLM: {e}")
                
                await asyncio.sleep(self.poll_interval)

    async def poll_notebooks(self, page):
        # 1. Navigate to the specific shared notebook
        shared_notebook_url = "https://notebooklm.google.com/notebook/d576cc07-d2ab-4cbb-86eb-749810aa97ba"
        await page.goto(shared_notebook_url)
        await page.wait_for_load_state("networkidle")
        
        # Give NotebookLM a moment to render the workspace
        await page.wait_for_timeout(3000)
        
        logger.debug("Scanning for new updates in the shared workspace...")
        
        # 2. Extract notes from the workspace
        # We look for saved notes in the DOM
        notes = await page.evaluate('''() => {
            const noteElements = document.querySelectorAll('mat-card');
            return Array.from(noteElements).map(el => el.innerText).filter(text => text.trim() !== '');
        }''')
        
        # Detect new notes (we should probably maintain a state of seen notes, for now just log them)
        for note in notes:
            if "CORTEX_SYNC" not in note: # Marker to avoid re-syncing
                logger.info(f"Detected note: {note[:50]}...")
                await self.dispatch_to_nas({ 
                    "type": "notebooklm_intent", 
                    "source": "shared_workspace",
                    "content": note 
                })
                # TODO: add a mechanism to mark the note as seen in the UI if possible

    async def dispatch_to_nas(self, payload):
        # Forward extracted intents or sources to the Creative Liberation Engine NAS
        try:
            # We use the internal docker network hostname 'dispatch' instead of the IP
            async with aiohttp.ClientSession() as session:
                async with session.post('http://cle-v6-dispatch-1:5150/api/tasks', json=payload) as response:
                    if response.status == 200:
                        logger.info("Successfully dispatched Notebook intent to NAS.")
                    else:
                        logger.warning(f"NAS Dispatch returned status {response.status}")
        except Exception as e:
            logger.error(f"Failed to connect to NAS Dispatch: {e}")
