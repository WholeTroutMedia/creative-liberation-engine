"""
Selenium framework adapter.

Wraps Selenium WebDriver to work with any browser provider
through remote WebDriver or CDP connections.
"""

import base64
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..providers.base import BrowserProvider, PageState

logger = logging.getLogger(__name__)


class SeleniumAdapter:
    """Selenium WebDriver-based browser automation adapter.

    Connects to any provider via remote WebDriver protocol
    or CDP endpoint for broader compatibility with legacy systems.
    """

    def __init__(self, provider: BrowserProvider):
        self._provider = provider
        self._driver = None

    async def initialize(self, session_id: str, options: Optional[Dict[str, Any]] = None) -> None:
        """Connect Selenium to the provider's endpoint."""
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
        except ImportError:
            raise ImportError("selenium not installed. Run: pip install selenium")

        opts = options or {}
        cdp_url = self._provider.get_cdp_endpoint(session_id)

        chrome_options = Options()
        chrome_options.debugger_address = cdp_url.replace("ws://", "").replace("http://", "")

        if opts.get("headless"):
            chrome_options.add_argument("--headless=new")

        self._driver = webdriver.Chrome(options=chrome_options)
        logger.info("Selenium connected to %s", self._provider.name)

    @property
    def driver(self):
        """Direct access to the Selenium WebDriver."""
        return self._driver

    async def navigate(self, url: str, wait_until: str = "domcontentloaded") -> Dict[str, Any]:
        if not self._driver:
            raise RuntimeError("Adapter not initialized")

        self._driver.get(url)
        return {
            "url": self._driver.current_url,
            "title": self._driver.title,
        }

    async def execute_action(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        if not self._driver:
            raise RuntimeError("Adapter not initialized")

        from selenium.webdriver.common.by import By
        from selenium.webdriver.common.action_chains import ActionChains
        from selenium.webdriver.common.keys import Keys

        if action == "click":
            selector = params.get("selector")
            if selector:
                element = self._driver.find_element(By.CSS_SELECTOR, selector)
                element.click()
            else:
                ac = ActionChains(self._driver)
                ac.move_by_offset(params["x"], params["y"]).click().perform()

        elif action == "type":
            selector = params.get("selector")
            text = params.get("text", "")
            if selector:
                element = self._driver.find_element(By.CSS_SELECTOR, selector)
                element.clear()
                element.send_keys(text)
            else:
                ac = ActionChains(self._driver)
                ac.send_keys(text).perform()

        elif action == "scroll":
            amount = params.get("amount", 300)
            direction = params.get("direction", "down")
            delta = amount if direction == "down" else -amount
            self._driver.execute_script(f"window.scrollBy(0, {delta})")

        elif action == "wait":
            time.sleep(params.get("duration", 1))

        elif action == "press":
            key = params["key"]
            ac = ActionChains(self._driver)
            ac.send_keys(getattr(Keys, key.upper(), key)).perform()

        elif action == "evaluate":
            result = self._driver.execute_script(params["expression"])
            return {"action": "evaluate", "result": result}

        else:
            raise ValueError(f"Unknown action: {action}")

        return {"action": action, "success": True}

    async def extract(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        if not self._driver:
            raise RuntimeError("Adapter not initialized")

        from selenium.webdriver.common.by import By

        result = {}
        for field, config in schema.items():
            selector = config.get("selector", "")
            attr = config.get("attribute", "textContent")

            try:
                elements = self._driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    el = elements[0]
                    if attr == "textContent":
                        result[field] = el.text
                    elif attr == "innerHTML":
                        result[field] = el.get_attribute("innerHTML")
                    else:
                        result[field] = el.get_attribute(attr)
                else:
                    result[field] = None
            except Exception as e:
                result[field] = None
                logger.warning("Extraction failed for %s: %s", field, e)

        return result

    async def observe(self) -> PageState:
        if not self._driver:
            raise RuntimeError("Adapter not initialized")

        url = self._driver.current_url
        title = self._driver.title
        html = self._driver.page_source
        text = self._driver.execute_script("return document.body ? document.body.innerText : ''")

        interactive = self._driver.execute_script("""
      var elements = [];
      var selectors = 'a, button, input, select, textarea, [role="button"]';
      document.querySelectorAll(selectors).forEach(function(el, i) {
        if (i < 100) {
          var rect = el.getBoundingClientRect();
          elements.push({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || '').trim().substring(0, 100),
            type: el.type || '',
            visible: rect.width > 0 && rect.height > 0
          });
        }
      });
      return elements;
    """)

        return PageState(
            url=url,
            title=title,
            html=html,
            text=text,
            interactive_elements=interactive or [],
            metadata={"provider": self._provider.name, "framework": "selenium"},
        )

    async def screenshot(self, path: Optional[str] = None) -> bytes:
        if not self._driver:
            raise RuntimeError("Adapter not initialized")

        png_data = self._driver.get_screenshot_as_png()

        if path:
            Path(path).parent.mkdir(parents=True, exist_ok=True)
            Path(path).write_bytes(png_data)

        return png_data

    async def close(self) -> None:
        if self._driver:
            try:
                self._driver.quit()
            except Exception:
                pass
            self._driver = None
        logger.info("Selenium adapter closed")
