"""Playwright framework adapter — supports SOVEREIGN and ATTACH modes.

SOVEREIGN: calls playwright.chromium.launch() — owns the full lifecycle.
ATTACH:    calls playwright.chromium.connect_over_cdp(url) — existing browsers.

Both modes expose the same navigation / action / observe / screenshot API.
"""

import asyncio
import base64
import logging
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


class PlaywrightAdapter:
    """Playwright-based browser automation. Dual SOVEREIGN/ATTACH modes."""

    def __init__(self, provider: Any):
        self._provider = provider
        self._playwright: Any = None
        self._browser: Any = None
        self._context: Any = None
        self._page: Any = None
        self._sovereign = getattr(provider, "_sovereign", False)

        # Optional streaming callback — called on every significant event
        self._event_cb: Optional[Callable[[str, Dict], None]] = None

    def set_event_callback(self, cb: Callable[[str, Dict], None]) -> None:
        """Wire a callback to receive structured action events for streaming."""
        self._event_cb = cb

    def _emit(self, event_type: str, data: Dict) -> None:
        if self._event_cb:
            try:
                self._event_cb(event_type, data)
            except Exception as e:
                logger.warning(f"Event callback error: {e}")

    # ─── Initialization ───────────────────────────────────────────#

    async def initialize(
        self,
        session_id: str,
        options: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Connect to browser — sovereign launch or CDP attach."""
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            raise ImportError(
                "playwright not installed. Run: pip install playwright && playwright install chromium"
            )

        opts = options or {}
        viewport = opts.get("viewport", {"width": 1440, "height": 900})

        self._playwright = await async_playwright().start()

        if self._sovereign:
            # SOVEREIGN — launch bundled Chromium, we own the lifecycle
            headless = getattr(self._provider, "_headless", False)
            w, h = getattr(self._provider, "_window_size", (1440, 900))
            self._browser = await self._playwright.chromium.launch(
                headless=headless,
                args=[
                    "--no-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    f"--window-size={w},{h}",
                ],
            )
            # Store back on provider so orchestrator can close it
            self._provider._playwright_obj = self._playwright
            self._provider._browser_obj = self._browser
            logger.info("SOVEREIGN Chromium launched via Playwright.")
        else:
            # ATTACH — connect over CDP
            cdp_url = self._provider.get_cdp_endpoint(session_id)
            self._browser = await self._playwright.chromium.connect_over_cdp(cdp_url)
            logger.info(f"Playwright attached to CDP: {cdp_url}")

        # Context + page
        contexts = self._browser.contexts
        if contexts:
            self._context = contexts[0]
        else:
            self._context = await self._browser.new_context(
                viewport=viewport,
                user_agent=opts.get("user_agent"),
            )

        pages = self._context.pages
        if pages:
            self._page = pages[0]
        else:
            self._page = await self._context.new_page()

        logger.info(f"PlaywrightAdapter ready — session {session_id}")

    @property
    def page(self) -> Any:
        return self._page

    # ─── Navigation ───────────────────────────────────────────────#

    async def navigate(self, url: str, wait_until: str = "domcontentloaded") -> Dict[str, Any]:
        if not self._page:
            raise RuntimeError("Adapter not initialized")
        self._emit("navigate_start", {"url": url})
        response = await self._page.goto(url, wait_until=wait_until, timeout=30_000)
        title = await self._page.title()
        result = {"url": self._page.url, "status": response.status if response else None, "title": title}
        self._emit("navigate_complete", result)
        return result

    # ─── Screenshot ───────────────────────────────────────────────#

    async def screenshot(self, path: Optional[str] = None) -> bytes:
        if not self._page:
            raise RuntimeError("Adapter not initialized")
        data: bytes = await self._page.screenshot(full_page=False, type="jpeg", quality=80)
        if path:
            Path(path).parent.mkdir(parents=True, exist_ok=True)
            Path(path).write_bytes(data)
        b64 = base64.b64encode(data).decode("utf-8")
        self._emit("screenshot", {"base64": b64, "size": len(data)})
        return data

    # ─── Observe (accessibility tree) ─────────────────────────────#

    async def observe(self) -> Any:
        if not self._page:
            raise RuntimeError("Adapter not initialized")

        url = self._page.url
        title = await self._page.title()

        elements = await self._page.evaluate("""() => {
            const results = [];
            let id = 1;
            function isVisible(el) {
                const r = el.getBoundingClientRect();
                const s = window.getComputedStyle(el);
                return r.width > 0 && r.height > 0
                    && s.visibility !== 'hidden'
                    && s.display !== 'none'
                    && s.opacity !== '0';
            }
            const SEL = 'a,button,input,select,textarea,[onclick],[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])';
            document.querySelectorAll(SEL).forEach(el => {
                if (!isVisible(el) || id > 150) return;
                const eid = id++;
                el.setAttribute('data-creative-liberation-engine-id', eid);
                const text = (el.innerText || el.value || el.placeholder
                    || el.getAttribute('aria-label') || el.alt || '')
                    .trim().replace(/\\n/g,' ').substring(0, 60);
                const tag = el.tagName.toLowerCase();
                const type = tag === 'input' ? `input[${el.type}]` : tag;
                const rect = el.getBoundingClientRect();
                results.push({
                    id: eid, type, text,
                    href: el.href || '',
                    x: Math.round(rect.x), y: Math.round(rect.y),
                    w: Math.round(rect.width), h: Math.round(rect.height),
                });
            });
            return results;
        }""")

        # Build text map for LLM
        dom_map = "\n".join(
            f'[{e["id"]}] {e["type"]}: "{e["text"]}"' + (f' ({e["href"]})' if e["href"] else "")
            for e in elements
        )

        self._emit("observe", {
            "url": url,
            "title": title,
            "element_count": len(elements),
            "dom_map": dom_map,
            "elements": elements,
        })

        # Return a dict-like object with attributes
        class PageState:
            pass
        ps = PageState()
        ps.url = url
        ps.title = title
        ps.text = dom_map
        ps.interactive_elements = elements
        ps.metadata = {}
        return ps

    # ─── Generic action dispatcher ────────────────────────────────#

    async def execute_action(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        if not self._page:
            raise RuntimeError("Adapter not initialized")
        ACTION_MAP = {
            "click":    self._action_click,
            "type":     self._action_type,
            "scroll":   self._action_scroll,
            "wait":     self._action_wait,
            "select":   self._action_select,
            "hover":    self._action_hover,
            "press":    self._action_press,
            "evaluate": self._action_evaluate,
        }
        handler = ACTION_MAP.get(action)
        if not handler:
            raise ValueError(f"Unknown action: {action}")
        result = await handler(params)
        self._emit("action", {"action": action, "params": params, "result": result})
        return result

    # ─── Action handlers ──────────────────────────────────────────#

    async def _action_click(self, p: Dict) -> Dict:
        sel, x, y = p.get("selector"), p.get("x"), p.get("y")
        eid = p.get("element_id")
        if eid:
            sel = f'[data-creative-liberation-engine-id="{eid}"]'
        if sel:
            await self._page.click(sel, timeout=p.get("timeout", 8000))
        elif x is not None and y is not None:
            await self._page.mouse.click(x, y)
        else:
            raise ValueError("click requires selector, element_id, or x,y")
        return {"action": "click", "success": True}

    async def _action_type(self, p: Dict) -> Dict:
        sel, eid, text = p.get("selector"), p.get("element_id"), p.get("text", "")
        if eid:
            sel = f'[data-creative-liberation-engine-id="{eid}"]'
        if sel:
            await self._page.fill(sel, text)
        else:
            await self._page.keyboard.type(text)
        return {"action": "type", "success": True}

    async def _action_scroll(self, p: Dict) -> Dict:
        delta = p.get("amount", 400) * (1 if p.get("direction", "down") == "down" else -1)
        await self._page.mouse.wheel(0, delta)
        return {"action": "scroll", "success": True}

    async def _action_wait(self, p: Dict) -> Dict:
        if sel := p.get("selector"):
            await self._page.wait_for_selector(sel, timeout=p.get("timeout", 8000))
        else:
            await asyncio.sleep(p.get("duration", 1))
        return {"action": "wait", "success": True}

    async def _action_select(self, p: Dict) -> Dict:
        await self._page.select_option(p["selector"], p.get("value", ""))
        return {"action": "select", "success": True}

    async def _action_hover(self, p: Dict) -> Dict:
        if sel := p.get("selector"):
            await self._page.hover(sel)
        else:
            await self._page.mouse.move(p["x"], p["y"])
        return {"action": "hover", "success": True}

    async def _action_press(self, p: Dict) -> Dict:
        await self._page.keyboard.press(p["key"])
        return {"action": "press", "success": True}

    async def _action_evaluate(self, p: Dict) -> Dict:
        result = await self._page.evaluate(p["expression"])
        return {"action": "evaluate", "result": result}

    # ─── Extraction ───────────────────────────────────────────────#

    async def extract(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        if not self._page:
            raise RuntimeError("Adapter not initialized")
        result: Dict = {}
        for field_name, config in schema.items():
            try:
                el = await self._page.query_selector(config.get("selector", ""))
                if el:
                    attr = config.get("attribute", "textContent")
                    result[field_name] = (
                        await el.text_content() if attr == "textContent"
                        else await el.inner_html() if attr == "innerHTML"
                        else await el.get_attribute(attr)
                    )
                else:
                    result[field_name] = None
            except Exception as e:
                result[field_name] = None
                logger.warning(f"Extract failed [{field_name}]: {e}")
        return result

    # ─── Cleanup ─────────────────────────────────────────────────#

    async def close(self) -> None:
        for obj in [self._page, self._context]:
            if obj:
                try:
                    await obj.close()
                except Exception:
                    pass
        self._page = self._context = None

        if self._sovereign and self._browser:
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

        logger.info("PlaywrightAdapter closed.")
