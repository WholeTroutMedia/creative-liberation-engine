"""BROWSER — Sovereign Agentic Web Orchestration Engine

Wraps Playwright (sovereign or attached) to orchestrate any Chromium
browser with real-time event streaming to connected WebSocket clients.

Dual-perception: DOM Accessibility Tree (text) + Screenshots (vision).
Constitutional hooks enforced at pre/post action boundaries.
"""

import asyncio
import base64
import logging
from typing import Any, Callable, Dict, List, Optional

from cle_engine.agents.base_agent import BaseAgent
from cle_engine.core.agent_executor import AgentResult, AgentCapability
from cle_engine.ai_client import AIClient
from cle_engine.browser.core.orchestrator import (
    BrowserOrchestrator, BrowserConfig, ProviderType,
)
from cle_engine.browser.providers.local_chrome import LocalChromeProvider

logger = logging.getLogger(__name__)


class BrowserAgent(BaseAgent):
    """Sovereign agentic browser — Playwright-native, streaming-first."""

    def __init__(
        self,
        sovereign: bool = True,
        headless: bool = False,
        event_callback: Optional[Callable[[str, Dict], None]] = None,
    ):
        super().__init__(
            name="BROWSER",
            agent_type="builder",
            capabilities=[AgentCapability.IDEATION, AgentCapability.IMPLEMENTATION],
            hive="AURORA",
            specialization="web_orchestration",
            active_modes=["ideate", "plan", "ship"],
        )
        self.ai_client = AIClient()
        self.orchestrator = BrowserOrchestrator()
        self.session = None
        self._sovereign = sovereign
        self._headless = headless
        self._event_callback = event_callback  # WebSocket stream sink
        self.activate()

    # ─── Event streaming ──────────────────────────────────────────#

    def set_event_callback(self, cb: Callable[[str, Dict], None]) -> None:
        """Wire a new event callback (e.g. WebSocket send)."""
        self._event_callback = cb

    def _emit(self, event_type: str, data: Dict) -> None:
        """Push a structured event to the callback (non-blocking)."""
        if self._event_callback:
            try:
                self._event_callback(event_type, data)
            except Exception as e:
                logger.warning(f"Event emit error: {e}")

    # ─── Browser lifecycle ────────────────────────────────────────#

    async def _initialize_browser(self) -> None:
        if self.session:
            return

        logger.info(f"Initializing BrowserOrchestrator (sovereign={self._sovereign})...")
        self._emit("agent_status", {"agent": "BROWSER", "status": "Initializing Chromium..."})

        provider = LocalChromeProvider(
            headless=self._headless,
            sovereign=self._sovereign,
            window_size=(1440, 900),
        )
        self.orchestrator.register_provider(ProviderType.PLAYWRIGHT_LOCAL, provider)

        config = BrowserConfig(
            provider=ProviderType.PLAYWRIGHT_LOCAL,
            headless=self._headless,
            framework="playwright",
        )
        self.session = await self.orchestrator.create_session(config=config, agent_name="BROWSER")

        # Wire event callback to the adapter
        adapter = self.orchestrator.get_adapter(self.session.session_id)
        if adapter and hasattr(adapter, "set_event_callback"):
            adapter.set_event_callback(self._emit)

        self._emit("agent_status", {"agent": "BROWSER", "status": "Browser ready"})
        logger.info(f"Browser session ready: {self.session.session_id}")

    async def _close_browser(self) -> None:
        if self.session:
            await self.orchestrator.close_session(self.session)
            self.session = None
            self._emit("agent_status", {"agent": "BROWSER", "status": "Session closed"})

    # ─── Perception ───────────────────────────────────────────────#

    async def _get_screenshot_b64(self) -> Optional[str]:
        try:
            res = await self.orchestrator.execute_action(self.session, "screenshot", {})
            if res.success and res.data:
                if isinstance(res.data, bytes):
                    return base64.b64encode(res.data).decode("utf-8")
                # adapter emits via callback, data may be b64 directly
                if isinstance(res.data, dict) and "base64" in res.data:
                    return res.data["base64"]
            return None
        except Exception as e:
            logger.error(f"Screenshot failed: {e}")
            return None

    async def _get_dom_map(self) -> tuple[str, List[Dict]]:
        """Returns (dom_map_text, elements_list)."""
        try:
            page_state = await self.orchestrator.execute_action(self.session, "observe", {})
            if page_state.success and page_state.data:
                ps = page_state.data
                if hasattr(ps, "text"):
                    return ps.text, getattr(ps, "interactive_elements", [])
                if isinstance(ps, dict):
                    return ps.get("dom_map", ""), ps.get("elements", [])
            return "", []
        except Exception as e:
            logger.error(f"DOM map failed: {e}")
            return "", []

    # ─── LLM inference ────────────────────────────────────────────#

    async def _llm_analyze(
        self,
        url: str,
        instruction: str,
        dom_map: str,
        screenshot_b64: Optional[str],
        llm_config: Dict,
    ) -> str:
        """Send perception data to LLM and get back an action/extraction."""
        provider = llm_config.get("provider", "ollama")

        self.ai_client.provider = provider
        if provider == "perplexity":
            self.ai_client.perplexity_key = llm_config.get("api_key", "")
        elif provider == "google":
            self.ai_client.google_key = llm_config.get("api_key", "")
        elif provider == "openai":
            self.ai_client.openai_key = llm_config.get("api_key", "")
        elif provider == "anthropic":
            self.ai_client.anthropic_key = llm_config.get("api_key", "")

        system = (
            "You are BROWSER — an autonomous web agent for the Creative Liberation Engine. "
            "You receive a URL, user instruction, and an Accessibility Tree (DOM Map). "
            "The DOM Map format: [ID] type: \"text\" — interactive elements with numeric IDs. "
            "Respond with ONE of:\n"
            "  1. A direct text extraction/answer (no JSON)\n"
            "  2. A JSON action: {\"action\":\"click\",\"element_id\":N}\n"
            "  3. A JSON action: {\"action\":\"type\",\"element_id\":N,\"value\":\"text\"}\n"
            "  4. A JSON action: {\"action\":\"navigate\",\"url\":\"https://...\"}\n"
            "Be concise. No filler. Prioritize accuracy."
        )

        prompt = f"URL: {url}\nInstruction: {instruction}\n\nDOM Map:\n{dom_map}\n\nResponse:"

        self._emit("agent_thought", {
            "reasoning": f"Querying {provider.upper()} with {len(dom_map)} chars of DOM context...",
            "action_plan": instruction,
        })

        logger.info(f"Querying {provider.upper()} for: '{instruction}'")
        response = self.ai_client.generate_completion(
            prompt=prompt, system_prompt=system, max_tokens=2000
        )
        return response

    # ─── Main execution loop ──────────────────────────────────────#

    def execute(self, context: Dict[str, Any]) -> AgentResult:
        """Sync wrapper."""
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(self._async_execute(context))

    async def _async_execute(self, context: Dict[str, Any]) -> AgentResult:
        """Full agentic web execution loop with streaming events."""
        try:
            task        = context.get("task", {})
            target_url  = task.get("url") or "https://www.google.com"
            mode        = task.get("perception_mode", "dual")
            instruction = context.get("instruction", "")
            llm_config  = context.get("llm_config", {})
            max_steps   = context.get("max_steps", 1)

            await self._initialize_browser()

            # Navigate
            self._emit("agent_status", {"agent": "BROWSER", "status": f"Navigating to {target_url}..."})
            await self.orchestrator.execute_action(self.session, "navigate", {"url": target_url})
            await asyncio.sleep(1.5)

            # Perception
            dom_map, elements = "", []
            screenshot_b64 = None

            if mode in ("text", "dual"):
                dom_map, elements = await self._get_dom_map()
                self._emit("browser_observe", {
                    "url": target_url,
                    "dom_map": dom_map,
                    "elements": elements,
                    "element_count": len(elements),
                })

            if mode in ("vision", "dual"):
                screenshot_b64 = await self._get_screenshot_b64()
                if screenshot_b64:
                    self._emit("browser_screenshot", {"base64": screenshot_b64})

            # LLM inference
            llm_result = ""
            if instruction and dom_map:
                llm_result = await self._llm_analyze(
                    target_url, instruction, dom_map, screenshot_b64, llm_config
                )
                self._emit("agent_thought", {"reasoning": llm_result, "action_plan": instruction})

            output = {
                "status": "success",
                "agent": self.agent_name,
                "action": f"Navigated + analyzed: {llm_result or 'No LLM instruction'}",
                "dom_map": dom_map,
                "elements": elements,
                "screenshot_base64": screenshot_b64,
                "url": target_url,
            }

            self._emit("browser_response", output)
            return AgentResult(
                success=True, output=output,
                metadata={"agent": self.agent_name, "mode": context.get("mode")},
            )

        except Exception as e:
            logger.error(f"Browser execution failed: {e}", exc_info=True)
            self._emit("error", {"message": str(e)})
            return AgentResult(
                success=False, output={}, error=str(e),
                metadata={"agent": self.agent_name},
            )
        finally:
            await self._close_browser()
