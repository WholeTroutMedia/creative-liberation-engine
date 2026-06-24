"""
cle_engine/agents/agent_provider_bridge.py

HELIX-H: Agent Runtime Provider Bridge
The critical bridge that gives agents actual capabilities by connecting them
to the Creative Liberation Engine's provider ecosystem.

When an agent needs to:
  - Think (AI):          → ModelRouter
  - Remember (memory):   → SCRIBEProviderBridge
  - Code (GitHub):       → GitHubProvider
  - Browse (browser):    → BrowserOrchestrator (MCP)
  - Communicate (events):→ EventBus

Every operation is:
  1. Capability-gated  — raises CapabilityDeniedError if agent lacks permission
  2. Event-broadcast   — publishes to agent.dispatch / agent.complete channels
  3. VERA-audited      — full loguru audit trail with agent_name, op, timestamps

Constitutional Compliance:
  - Article II:   Separation of Powers — agents only get what their hive needs
  - Article III:  Human Supremacy — all destructive ops require explicit caps
  - Article IX:   Quality Standards — no stubs, no partial implementations
  - Article XII:  OISE — provider-agnostic interface, full interoperability
  - Article XVII: VERA Enforcement — every op logged with latency + outcome
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from enum import Enum
from typing import Any, AsyncIterator, Dict, List, Optional, Set, Tuple

from loguru import logger
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Graceful provider imports — bridge stays alive even if providers are absent
# ---------------------------------------------------------------------------

try:
    from cle_engine.providers import (
        Citation,
        CompletionResponse,
        EmbeddingResult,
        Message,
        ModelRouter,
        TaskIntent,
    )
    _MODEL_ROUTER_AVAILABLE = True
except ImportError:
    try:
        from providers import (  # type: ignore[no-redef]
            Citation,
            CompletionResponse,
            EmbeddingResult,
            Message,
            ModelRouter,
            TaskIntent,
        )
        _MODEL_ROUTER_AVAILABLE = True
    except ImportError:
        _MODEL_ROUTER_AVAILABLE = False
        ModelRouter = None  # type: ignore[assignment,misc]
        Message = None      # type: ignore[assignment,misc]
        TaskIntent = None   # type: ignore[assignment,misc]
        logger.warning(
            "[agent_bridge] cle_engine.providers not found — "
            "AI methods will raise ProviderUnavailableError"
        )

try:
    from cle_engine.providers.github_provider import GitHubProvider
    _GITHUB_AVAILABLE = True
except ImportError:
    try:
        from github_provider import GitHubProvider  # type: ignore[no-redef]
        _GITHUB_AVAILABLE = True
    except ImportError:
        _GITHUB_AVAILABLE = False
        GitHubProvider = None  # type: ignore[assignment,misc]
        logger.warning(
            "[agent_bridge] GitHubProvider not found — "
            "GitHub methods will raise ProviderUnavailableError"
        )

try:
    from cle_engine.providers.google_provider import GoogleProvider
    _GOOGLE_AVAILABLE = True
except ImportError:
    try:
        from google_provider import GoogleProvider  # type: ignore[no-redef]
        _GOOGLE_AVAILABLE = True
    except ImportError:
        _GOOGLE_AVAILABLE = False
        GoogleProvider = None  # type: ignore[assignment,misc]
        logger.warning(
            "[agent_bridge] GoogleProvider not found — "
            "workspace methods will raise ProviderUnavailableError"
        )

try:
    from cle_engine.memory.scribe_provider_bridge import SCRIBEProviderBridge
    _SCRIBE_AVAILABLE = True
except ImportError:
    try:
        from scribe_provider_bridge import SCRIBEProviderBridge  # type: ignore[no-redef]
        _SCRIBE_AVAILABLE = True
    except ImportError:
        _SCRIBE_AVAILABLE = False
        SCRIBEProviderBridge = None  # type: ignore[assignment,misc]
        logger.warning(
            "[agent_bridge] SCRIBEProviderBridge not found — "
            "memory methods will raise ProviderUnavailableError"
        )

try:
    from cle_engine.websocket.event_bus import (
        AgentEvent,
        Channel,
        EngineEvent,
        EventBus,
        Severity,
    )
    _EVENT_BUS_AVAILABLE = True
except ImportError:
    try:
        from event_bus import (  # type: ignore[no-redef]
            AgentEvent,
            Channel,
            EngineEvent,
            EventBus,
            Severity,
        )
        _EVENT_BUS_AVAILABLE = True
    except ImportError:
        _EVENT_BUS_AVAILABLE = False
        EventBus = None    # type: ignore[assignment,misc]
        Channel = None     # type: ignore[assignment,misc]
        Severity = None    # type: ignore[assignment,misc]
        AgentEvent = None  # type: ignore[assignment,misc]
        EngineEvent = None # type: ignore[assignment,misc]
        logger.warning(
            "[agent_bridge] EventBus not found — "
            "event emission will use loguru-only fallback"
        )

# BrowserOrchestrator is optional (COMET MCP bridge — may not be present)
try:
    from cle_engine.browser.browser_orchestrator import BrowserOrchestrator
    _BROWSER_AVAILABLE = True
except ImportError:
    _BROWSER_AVAILABLE = False
    BrowserOrchestrator = None  # type: ignore[assignment,misc]
    logger.debug(
        "[agent_bridge] BrowserOrchestrator not found — "
        "browser methods will raise ProviderUnavailableError"
    )


# ---------------------------------------------------------------------------
# Custom Exceptions
# ---------------------------------------------------------------------------

class CapabilityDeniedError(PermissionError):
    """
    Raised when an agent attempts to use a capability not in its allowed set.

    Attributes:
        agent_name:  The name of the agent that made the request.
        capability:  The AgentCapability that was denied.
        hive:        The hive the agent belongs to.
    """

    def __init__(
        self,
        agent_name: str,
        capability: str,
        hive: str = "",
    ) -> None:
        self.agent_name = agent_name
        self.capability = capability
        self.hive = hive
        super().__init__(
            f"Agent '{agent_name}' (hive={hive or 'unknown'}) does not have "
            f"capability '{capability}'. "
            f"Request the capability to be granted or use a differently-scoped "
            f"toolkit."
        )


class ProviderUnavailableError(RuntimeError):
    """
    Raised when a required provider package is not installed or not configured.

    Attributes:
        provider:   Human-readable provider name.
        capability: The AgentCapability that requires this provider.
        hint:       Installation hint.
    """

    def __init__(
        self,
        provider: str,
        capability: str = "",
        hint: str = "",
    ) -> None:
        self.provider = provider
        self.capability = capability
        self.hint = hint
        msg = f"Provider '{provider}' is not available"
        if capability:
            msg += f" (required for capability '{capability}')"
        if hint:
            msg += f". {hint}"
        super().__init__(msg)


# ---------------------------------------------------------------------------
# AgentCapability Enum
# ---------------------------------------------------------------------------

class AgentCapability(str, Enum):
    """
    Enumeration of all capabilities an agent toolkit can expose.

    Capabilities are grouped by subsystem:
      - ai_*:        ModelRouter / Perplexity / Google AI calls
      - github_*:    GitHub API operations (read vs write vs actions)
      - browser_*:   Browser navigation and extraction (COMET MCP)
      - memory_*:    SCRIBE memory persistence and recall
      - workspace_*: Google Workspace (Docs, Gmail, Calendar, Drive)
      - event_*:     EventBus publication
    """

    # AI
    AI_COMPLETION  = "ai_completion"
    AI_SEARCH      = "ai_search"
    AI_STREAMING   = "ai_streaming"
    EMBEDDINGS     = "embeddings"

    # GitHub
    GITHUB_READ    = "github_read"
    GITHUB_WRITE   = "github_write"
    GITHUB_ACTIONS = "github_actions"

    # Browser
    BROWSER_NAVIGATE = "browser_navigate"
    BROWSER_EXTRACT  = "browser_extract"

    # Memory
    MEMORY_STORE       = "memory_store"
    MEMORY_RECALL      = "memory_recall"
    MEMORY_CONSOLIDATE = "memory_consolidate"

    # Workspace
    WORKSPACE_DOCS     = "workspace_docs"
    WORKSPACE_EMAIL    = "workspace_email"
    WORKSPACE_CALENDAR = "workspace_calendar"
    WORKSPACE_DRIVE    = "workspace_drive"

    # Events
    EVENT_PUBLISH = "event_publish"


# ---------------------------------------------------------------------------
# VERA Audit Record
# ---------------------------------------------------------------------------

class VERARecord(BaseModel):
    """Immutable audit record written for every toolkit operation."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: float = Field(default_factory=time.time)
    agent_name: str
    hive: str
    operation: str
    capability: str
    params_summary: Dict[str, Any] = Field(default_factory=dict)
    latency_ms: float = 0.0
    success: bool = True
    error: Optional[str] = None
    result_summary: Optional[str] = None

    model_config = {"use_enum_values": True}


# Force Pydantic v2 to resolve forward-reference annotations immediately.
# Required because `from __future__ import annotations` makes all annotations
# lazy strings; model_rebuild() resolves them with the current module globals.
VERARecord.model_rebuild()


# ---------------------------------------------------------------------------
# AgentToolkit — the high-level per-agent capability interface
# ---------------------------------------------------------------------------

class AgentToolkit:
    """
    High-level interface that wraps all providers into agent-friendly methods.

    Each agent gets a toolkit instance configured with their allowed
    capabilities.  Every method:

      1. Verifies the agent has the required capability
         (raises CapabilityDeniedError otherwise).

      2. Delegates to the appropriate provider
         (raises ProviderUnavailableError if the provider package is absent).

      3. Publishes dispatch + complete events to EventBus.

      4. Emits a VERA audit log entry via loguru.

    Constructor Args:
        agent_name:    Unique agent identifier (e.g. "AURORA-7", "LEX-prime").
        hive:          Hive/group name (e.g. "AURORA", "LEX", "KEEPER").
        capabilities:  Set of AgentCapability values granted to this agent.
        event_bus:     Optional EventBus instance for real-time event streaming.
                       If None, events fall back to loguru-only output.
        model_router:  Optional pre-configured ModelRouter.
        github:        Optional pre-configured GitHubProvider.
        scribe:        Optional pre-configured SCRIBEProviderBridge.
        google:        Optional pre-configured GoogleProvider.
        browser:       Optional pre-configured BrowserOrchestrator.
    """

    def __init__(
        self,
        agent_name: str,
        hive: str,
        capabilities: Set[AgentCapability],
        event_bus: Optional[Any] = None,  # EventBus | None
        *,
        model_router: Optional[Any] = None,
        github: Optional[Any] = None,
        scribe: Optional[Any] = None,
        google: Optional[Any] = None,
        browser: Optional[Any] = None,
    ) -> None:
        self.agent_name = agent_name
        self.hive = hive
        self.capabilities = frozenset(capabilities)

        # Provider references
        self._router: Optional[Any] = model_router
        self._github: Optional[Any] = github
        self._scribe: Optional[Any] = scribe
        self._google: Optional[Any] = google
        self._browser: Optional[Any] = browser
        self._event_bus: Optional[Any] = event_bus

        # VERA audit log (in-process ring buffer — persisted via loguru)
        self._audit_log: List[VERARecord] = []
        self._ops_count: int = 0

        logger.info(
            "[VERA][agent_bridge] AgentToolkit created | "
            f"agent={agent_name} hive={hive} "
            f"capabilities={[c.value for c in capabilities]}"
        )

    # ------------------------------------------------------------------
    # Internal capability guard
    # ------------------------------------------------------------------

    def _require(self, cap: AgentCapability) -> None:
        """
        Assert the agent has *cap*.  Raises CapabilityDeniedError if not.
        """
        if cap not in self.capabilities:
            raise CapabilityDeniedError(
                agent_name=self.agent_name,
                capability=cap.value,
                hive=self.hive,
            )

    # ------------------------------------------------------------------
    # Internal provider guards
    # ------------------------------------------------------------------

    def _require_router(self) -> Any:
        """Return ModelRouter or raise ProviderUnavailableError."""
        if self._router is None:
            raise ProviderUnavailableError(
                provider="ModelRouter",
                hint="Inject a ModelRouter via AgentToolkit(model_router=...)",
            )
        return self._router

    def _require_github(self) -> Any:
        """Return GitHubProvider or raise ProviderUnavailableError."""
        if self._github is None:
            if not _GITHUB_AVAILABLE:
                raise ProviderUnavailableError(
                    provider="GitHubProvider",
                    hint="Install cle_engine and configure GITHUB_TOKEN",
                )
            raise ProviderUnavailableError(
                provider="GitHubProvider",
                hint="Inject a GitHubProvider via AgentToolkit(github=...)",
            )
        return self._github

    def _require_scribe(self) -> Any:
        """Return SCRIBEProviderBridge or raise ProviderUnavailableError."""
        if self._scribe is None:
            if not _SCRIBE_AVAILABLE:
                raise ProviderUnavailableError(
                    provider="SCRIBEProviderBridge",
                    hint="Install cle_engine memory package",
                )
            raise ProviderUnavailableError(
                provider="SCRIBEProviderBridge",
                hint="Inject a SCRIBEProviderBridge via AgentToolkit(scribe=...)",
            )
        return self._scribe

    def _require_google(self) -> Any:
        """Return GoogleProvider or raise ProviderUnavailableError."""
        if self._google is None:
            if not _GOOGLE_AVAILABLE:
                raise ProviderUnavailableError(
                    provider="GoogleProvider",
                    hint="Install cle_engine and configure Google OAuth",
                )
            raise ProviderUnavailableError(
                provider="GoogleProvider",
                hint="Inject a GoogleProvider via AgentToolkit(google=...)",
            )
        return self._google

    def _require_browser(self) -> Any:
        """Return BrowserOrchestrator or raise ProviderUnavailableError."""
        if self._browser is None:
            if not _BROWSER_AVAILABLE:
                raise ProviderUnavailableError(
                    provider="BrowserOrchestrator",
                    hint="Install cle_engine browser package (COMET MCP)",
                )
            raise ProviderUnavailableError(
                provider="BrowserOrchestrator",
                hint="Inject a BrowserOrchestrator via AgentToolkit(browser=...)",
            )
        return self._browser

    # ------------------------------------------------------------------
    # Internal VERA audit + event helpers
    # ------------------------------------------------------------------

    def _vera_start(
        self,
        operation: str,
        capability: AgentCapability,
        params: Dict[str, Any],
    ) -> Tuple[float, str]:
        """
        Record operation start.  Returns (start_time, task_id).
        """
        task_id = str(uuid.uuid4())
        self._ops_count += 1
        logger.info(
            "[VERA][agent_bridge] DISPATCH | "
            f"agent={self.agent_name} hive={self.hive} "
            f"op={operation} cap={capability.value} task_id={task_id} "
            f"params={json.dumps(params, default=str)[:256]}"
        )
        return time.perf_counter(), task_id

    def _vera_end(
        self,
        operation: str,
        capability: AgentCapability,
        task_id: str,
        start: float,
        success: bool,
        result_summary: Optional[str] = None,
        error: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> VERARecord:
        """
        Record operation completion, append to audit log, emit log line.
        Returns the VERARecord for callers that want to inspect it.
        """
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        record = VERARecord(
            agent_name=self.agent_name,
            hive=self.hive,
            operation=operation,
            capability=capability.value,
            params_summary=params or {},
            latency_ms=latency_ms,
            success=success,
            error=error,
            result_summary=result_summary,
        )
        self._audit_log.append(record)

        status = "COMPLETE" if success else "ERROR"
        logger.info(
            f"[VERA][agent_bridge] {status} | "
            f"agent={self.agent_name} hive={self.hive} "
            f"op={operation} cap={capability.value} task_id={task_id} "
            f"latency_ms={latency_ms} "
            f"result={result_summary or ''} "
            f"error={error or ''}"
        )
        return record

    async def _emit_dispatch(
        self,
        task_id: str,
        operation: str,
        payload: Dict[str, Any],
    ) -> None:
        """Publish agent.dispatch event to EventBus (non-fatal on failure)."""
        if self._event_bus is None or not _EVENT_BUS_AVAILABLE:
            return
        try:
            event = AgentEvent(
                channel=Channel.AGENT_DISPATCH,
                source_agent=self.agent_name,
                agent_name=self.agent_name,
                hive=self.hive,
                task_id=task_id,
                payload={"operation": operation, **payload},
                severity=Severity.INFO,
            )
            await self._event_bus.publish(Channel.AGENT_DISPATCH, event)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                f"[agent_bridge] EventBus dispatch publish failed: {exc}"
            )

    async def _emit_complete(
        self,
        task_id: str,
        operation: str,
        result_summary: str,
        success: bool,
        latency_ms: float,
    ) -> None:
        """Publish agent.complete (or agent.error) event to EventBus."""
        if self._event_bus is None or not _EVENT_BUS_AVAILABLE:
            return
        try:
            channel = Channel.AGENT_COMPLETE if success else Channel.AGENT_ERROR
            severity = Severity.INFO if success else Severity.ERROR
            event = AgentEvent(
                channel=channel,
                source_agent=self.agent_name,
                agent_name=self.agent_name,
                hive=self.hive,
                task_id=task_id,
                result_summary=result_summary,
                payload={
                    "operation": operation,
                    "success": success,
                    "latency_ms": latency_ms,
                },
                severity=severity,
            )
            await self._event_bus.publish(channel, event)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                f"[agent_bridge] EventBus complete publish failed: {exc}"
            )

    # ------------------------------------------------------------------
    # ----------------------------------------------------------------
    # AI METHODS — delegate to ModelRouter
    # ------------------------------------------------------------------

    async def think(
        self,
        prompt: str,
        system: str = "",
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        """
        Simple AI completion.  Returns the text response as a plain string.

        Delegates to ModelRouter with TaskIntent.CHAT (or REASONING if a
        system prompt is provided that suggests analytical work).

        Args:
            prompt:      The user prompt to complete.
            system:      Optional system message to prepend.
            model:       Override the default model selected by the router.
            temperature: Sampling temperature (0.0–1.0).
            max_tokens:  Maximum tokens in the response.

        Returns:
            str — the model's response text.

        Raises:
            CapabilityDeniedError:    Agent lacks ai_completion.
            ProviderUnavailableError: ModelRouter not configured.
        """
        self._require(AgentCapability.AI_COMPLETION)
        router = self._require_router()

        start, task_id = self._vera_start(
            "think",
            AgentCapability.AI_COMPLETION,
            {
                "prompt_len": len(prompt),
                "has_system": bool(system),
                "model": model or "auto",
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
        )
        await self._emit_dispatch(
            task_id, "think", {"prompt_preview": prompt[:120]}
        )

        try:
            messages = []
            if system:
                messages.append(Message(role="system", content=system))
            messages.append(Message(role="user", content=prompt))

            # If a specific model override is requested, use direct provider
            if model:
                # Attempt Perplexity first, then Google
                try:
                    response = await router.perplexity.complete(
                        messages=messages,
                        model=model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
                except Exception:
                    response = await router.google.complete(
                        messages=messages,
                        model=model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
            else:
                response = await router.route(
                    intent=TaskIntent.CHAT,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )

            result = response.content
            record = self._vera_end(
                "think",
                AgentCapability.AI_COMPLETION,
                task_id,
                start,
                success=True,
                result_summary=f"model={response.model} chars={len(result)}",
            )
            await self._emit_complete(
                task_id, "think", f"chars={len(result)}", True, record.latency_ms
            )
            return result

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "think",
                AgentCapability.AI_COMPLETION,
                task_id,
                start,
                success=False,
                error=str(exc),
            )
            await self._emit_complete(
                task_id, "think", "", False, record.latency_ms
            )
            raise

    async def think_structured(
        self,
        prompt: str,
        schema: Dict[str, Any],
        system: str = "",
    ) -> Dict[str, Any]:
        """
        AI completion with structured JSON output enforced by the model.

        Passes the schema as a response_format hint and parses the output.
        Falls back to JSON extraction from free-form text if the model does
        not support response_format natively.

        Args:
            prompt: The user prompt.
            schema: JSON Schema dict describing the expected response shape.
            system: Optional system message.

        Returns:
            Dict — parsed JSON response from the model.

        Raises:
            CapabilityDeniedError:    Agent lacks ai_completion.
            ProviderUnavailableError: ModelRouter not configured.
            ValueError:               Response could not be parsed as JSON.
        """
        self._require(AgentCapability.AI_COMPLETION)
        router = self._require_router()

        start, task_id = self._vera_start(
            "think_structured",
            AgentCapability.AI_COMPLETION,
            {
                "prompt_len": len(prompt),
                "schema_keys": list(schema.get("properties", {}).keys())[:8],
                "has_system": bool(system),
            },
        )
        await self._emit_dispatch(
            task_id, "think_structured", {"prompt_preview": prompt[:120]}
        )

        try:
            messages = []
            structured_system = (
                f"{system}\n\n" if system else ""
            ) + (
                "You MUST respond with valid JSON that matches this schema:\n"
                f"{json.dumps(schema, indent=2)}\n"
                "No prose before or after the JSON object. No markdown fences."
            )
            messages.append(Message(role="system", content=structured_system))
            messages.append(Message(role="user", content=prompt))

            response = await router.route(
                intent=TaskIntent.REASONING,
                messages=messages,
                temperature=0.1,
                max_tokens=4096,
                response_format={"type": "json_object"},
            )

            raw = response.content.strip()
            # Strip markdown code fences if present
            if raw.startswith("```"):
                lines = raw.splitlines()
                raw = "\n".join(
                    line for line in lines
                    if not line.strip().startswith("```")
                ).strip()

            parsed: Dict[str, Any] = json.loads(raw)

            record = self._vera_end(
                "think_structured",
                AgentCapability.AI_COMPLETION,
                task_id,
                start,
                success=True,
                result_summary=f"model={response.model} keys={list(parsed.keys())[:6]}",
            )
            await self._emit_complete(
                task_id, "think_structured",
                f"keys={list(parsed.keys())[:6]}", True, record.latency_ms
            )
            return parsed

        except json.JSONDecodeError as exc:
            err = f"JSON parse failed: {exc}"
            record = self._vera_end(
                "think_structured", AgentCapability.AI_COMPLETION,
                task_id, start, success=False, error=err,
            )
            await self._emit_complete(
                task_id, "think_structured", "", False, record.latency_ms
            )
            raise ValueError(err) from exc
        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "think_structured", AgentCapability.AI_COMPLETION,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "think_structured", "", False, record.latency_ms
            )
            raise

    async def think_stream(
        self,
        prompt: str,
        system: str = "",
    ) -> AsyncIterator[str]:
        """
        Streaming AI completion.  Yields text chunks as they arrive.

        Args:
            prompt: The user prompt.
            system: Optional system message.

        Yields:
            str — incremental text chunks from the model.

        Raises:
            CapabilityDeniedError:    Agent lacks ai_streaming.
            ProviderUnavailableError: ModelRouter not configured.
        """
        self._require(AgentCapability.AI_STREAMING)
        router = self._require_router()

        start, task_id = self._vera_start(
            "think_stream",
            AgentCapability.AI_STREAMING,
            {"prompt_len": len(prompt), "has_system": bool(system)},
        )
        await self._emit_dispatch(
            task_id, "think_stream", {"prompt_preview": prompt[:120]}
        )

        total_chars = 0
        try:
            messages = []
            if system:
                messages.append(Message(role="system", content=system))
            messages.append(Message(role="user", content=prompt))

            async for chunk in router.route_stream(
                intent=TaskIntent.CHAT,
                messages=messages,
            ):
                text = chunk.content
                if text:
                    total_chars += len(text)
                    yield text

            record = self._vera_end(
                "think_stream",
                AgentCapability.AI_STREAMING,
                task_id,
                start,
                success=True,
                result_summary=f"total_chars={total_chars}",
            )
            await self._emit_complete(
                task_id, "think_stream",
                f"streamed_chars={total_chars}", True, record.latency_ms
            )

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "think_stream", AgentCapability.AI_STREAMING,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "think_stream", "", False, record.latency_ms
            )
            raise

    async def search(
        self,
        query: str,
        mode: str = "concise",
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Web search via Perplexity Sonar.

        Returns a tuple of (synthesized_answer, citations_list).

        Args:
            query: The search query.
            mode:  "concise" (default) or "academic" or "deep".

        Returns:
            Tuple[str, List[Dict]] — (answer, citations).
            Each citation dict has keys: url, title, snippet, domain.

        Raises:
            CapabilityDeniedError:    Agent lacks ai_search.
            ProviderUnavailableError: ModelRouter / Perplexity not configured.
        """
        self._require(AgentCapability.AI_SEARCH)
        router = self._require_router()

        start, task_id = self._vera_start(
            "search",
            AgentCapability.AI_SEARCH,
            {"query": query[:120], "mode": mode},
        )
        await self._emit_dispatch(task_id, "search", {"query": query[:120]})

        try:
            messages = [Message(role="user", content=query)]

            intent_map = {
                "deep": TaskIntent.DEEP_RESEARCH,
                "academic": TaskIntent.SEARCH,
                "concise": TaskIntent.SEARCH,
            }
            intent = intent_map.get(mode, TaskIntent.SEARCH)

            response = await router.route(
                intent=intent,
                messages=messages,
                max_tokens=2048,
                temperature=0.1,
            )

            answer = response.content
            citations = [
                {
                    "url": c.url,
                    "title": c.title or "",
                    "snippet": c.snippet or "",
                    "domain": c.domain or "",
                }
                for c in (response.citations or [])
            ]

            record = self._vera_end(
                "search", AgentCapability.AI_SEARCH,
                task_id, start, success=True,
                result_summary=f"answer_len={len(answer)} citations={len(citations)}",
            )
            await self._emit_complete(
                task_id, "search",
                f"citations={len(citations)}", True, record.latency_ms
            )
            return answer, citations

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "search", AgentCapability.AI_SEARCH,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "search", "", False, record.latency_ms
            )
            raise

    async def embed(
        self,
        texts: List[str],
    ) -> List[List[float]]:
        """
        Convert a list of texts to vector embeddings.

        Args:
            texts: List of strings to embed.

        Returns:
            List[List[float]] — one embedding vector per input text.

        Raises:
            CapabilityDeniedError:    Agent lacks embeddings.
            ProviderUnavailableError: ModelRouter not configured.
        """
        self._require(AgentCapability.EMBEDDINGS)
        router = self._require_router()

        start, task_id = self._vera_start(
            "embed",
            AgentCapability.EMBEDDINGS,
            {"text_count": len(texts), "total_chars": sum(len(t) for t in texts)},
        )
        await self._emit_dispatch(
            task_id, "embed", {"text_count": len(texts)}
        )

        try:
            results = await router.embed(texts)
            vectors = [r.embedding for r in results]

            record = self._vera_end(
                "embed", AgentCapability.EMBEDDINGS,
                task_id, start, success=True,
                result_summary=f"vectors={len(vectors)} dim={len(vectors[0]) if vectors else 0}",
            )
            await self._emit_complete(
                task_id, "embed",
                f"vectors={len(vectors)}", True, record.latency_ms
            )
            return vectors

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "embed", AgentCapability.EMBEDDINGS,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "embed", "", False, record.latency_ms
            )
            raise

    # ------------------------------------------------------------------
    # GITHUB METHODS — delegate to GitHubProvider
    # ------------------------------------------------------------------

    async def read_file(
        self,
        owner: str,
        repo: str,
        path: str,
        ref: Optional[str] = None,
    ) -> str:
        """
        Read a file from a GitHub repository.

        Args:
            owner: Repository owner (user or org).
            repo:  Repository name.
            path:  File path within the repository.
            ref:   Git ref (branch, tag, commit SHA). Defaults to repo default.

        Returns:
            str — decoded file content.

        Raises:
            CapabilityDeniedError:    Agent lacks github_read.
            ProviderUnavailableError: GitHubProvider not configured.
        """
        self._require(AgentCapability.GITHUB_READ)
        github = self._require_github()

        start, task_id = self._vera_start(
            "read_file", AgentCapability.GITHUB_READ,
            {"owner": owner, "repo": repo, "path": path, "ref": ref},
        )
        await self._emit_dispatch(
            task_id, "read_file", {"repo": f"{owner}/{repo}", "path": path}
        )

        try:
            file_obj = await github.get_file(
                owner=owner, repo=repo, path=path, ref=ref
            )
            # GitHubProvider.get_file returns a GitHubFile dataclass
            content = file_obj.content if hasattr(file_obj, "content") else str(file_obj)

            record = self._vera_end(
                "read_file", AgentCapability.GITHUB_READ,
                task_id, start, success=True,
                result_summary=f"bytes={len(content)}",
            )
            await self._emit_complete(
                task_id, "read_file",
                f"bytes={len(content)}", True, record.latency_ms
            )
            return content

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "read_file", AgentCapability.GITHUB_READ,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "read_file", "", False, record.latency_ms
            )
            raise

    async def write_file(
        self,
        owner: str,
        repo: str,
        path: str,
        content: str,
        message: str,
        branch: str = "main",
    ) -> str:
        """
        Create or update a file in a GitHub repository.

        Handles both file creation (no existing SHA) and updates (fetches
        current SHA automatically).

        Args:
            owner:   Repository owner.
            repo:    Repository name.
            path:    File path within the repository.
            content: File content (plain text; will be base64-encoded internally).
            message: Commit message.
            branch:  Target branch (default: "main").

        Returns:
            str — commit SHA.

        Raises:
            CapabilityDeniedError:    Agent lacks github_write.
            ProviderUnavailableError: GitHubProvider not configured.
        """
        self._require(AgentCapability.GITHUB_WRITE)
        github = self._require_github()

        start, task_id = self._vera_start(
            "write_file", AgentCapability.GITHUB_WRITE,
            {
                "owner": owner, "repo": repo, "path": path,
                "branch": branch, "msg_preview": message[:80],
                "content_len": len(content),
            },
        )
        await self._emit_dispatch(
            task_id, "write_file",
            {"repo": f"{owner}/{repo}", "path": path, "branch": branch}
        )

        try:
            # Try to get existing file SHA for update path
            existing_sha: Optional[str] = None
            try:
                existing_file = await github.get_file(
                    owner=owner, repo=repo, path=path, ref=branch
                )
                existing_sha = getattr(existing_file, "sha", None)
            except Exception:
                pass  # File doesn't exist yet — create path

            if existing_sha:
                result = await github.update_file(
                    owner=owner,
                    repo=repo,
                    path=path,
                    content=content,
                    message=message,
                    sha=existing_sha,
                    branch=branch,
                )
            else:
                result = await github.create_file(
                    owner=owner,
                    repo=repo,
                    path=path,
                    content=content,
                    message=message,
                    branch=branch,
                )

            # Extract commit SHA from result
            commit_sha = (
                result.get("commit", {}).get("sha", "")
                if isinstance(result, dict)
                else getattr(result, "sha", str(result))
            )

            record = self._vera_end(
                "write_file", AgentCapability.GITHUB_WRITE,
                task_id, start, success=True,
                result_summary=f"sha={commit_sha[:12] if commit_sha else 'unknown'}",
            )
            await self._emit_complete(
                task_id, "write_file",
                f"sha={commit_sha[:12] if commit_sha else '?'}", True, record.latency_ms
            )
            return commit_sha

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "write_file", AgentCapability.GITHUB_WRITE,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "write_file", "", False, record.latency_ms
            )
            raise

    async def push_files(
        self,
        owner: str,
        repo: str,
        files: List[Dict[str, Any]],
        message: str,
        branch: str = "main",
    ) -> str:
        """
        Atomic multi-file push using the GitHub Trees API.

        All files are committed in a single atomic operation — either all
        succeed or none are applied.

        Args:
            owner:   Repository owner.
            repo:    Repository name.
            files:   List of dicts with keys:
                       - "path": str  — file path in the repo
                       - "content": str — file content
                       (Optional: "mode", "type" for advanced use)
            message: Commit message.
            branch:  Target branch (default: "main").

        Returns:
            str — commit SHA of the resulting commit.

        Raises:
            CapabilityDeniedError:    Agent lacks github_write.
            ProviderUnavailableError: GitHubProvider not configured.
        """
        self._require(AgentCapability.GITHUB_WRITE)
        github = self._require_github()

        start, task_id = self._vera_start(
            "push_files", AgentCapability.GITHUB_WRITE,
            {
                "owner": owner, "repo": repo,
                "file_count": len(files),
                "branch": branch,
                "msg_preview": message[:80],
            },
        )
        await self._emit_dispatch(
            task_id, "push_files",
            {"repo": f"{owner}/{repo}", "file_count": len(files), "branch": branch}
        )

        try:
            result = await github.push_files(
                owner=owner,
                repo=repo,
                files=files,
                message=message,
                branch=branch,
            )

            commit_sha = (
                result.get("sha", "")
                if isinstance(result, dict)
                else getattr(result, "sha", str(result))
            )

            record = self._vera_end(
                "push_files", AgentCapability.GITHUB_WRITE,
                task_id, start, success=True,
                result_summary=f"files={len(files)} sha={commit_sha[:12] if commit_sha else '?'}",
            )
            await self._emit_complete(
                task_id, "push_files",
                f"sha={commit_sha[:12] if commit_sha else '?'}", True, record.latency_ms
            )
            return commit_sha

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "push_files", AgentCapability.GITHUB_WRITE,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "push_files", "", False, record.latency_ms
            )
            raise

    async def create_branch(
        self,
        owner: str,
        repo: str,
        name: str,
        from_branch: Optional[str] = None,
    ) -> str:
        """
        Create a new branch in a GitHub repository.

        Args:
            owner:       Repository owner.
            repo:        Repository name.
            name:        New branch name.
            from_branch: Source branch to branch from (defaults to repo default).

        Returns:
            str — SHA of the commit the new branch points to.

        Raises:
            CapabilityDeniedError:    Agent lacks github_write.
            ProviderUnavailableError: GitHubProvider not configured.
        """
        self._require(AgentCapability.GITHUB_WRITE)
        github = self._require_github()

        start, task_id = self._vera_start(
            "create_branch", AgentCapability.GITHUB_WRITE,
            {"owner": owner, "repo": repo, "name": name, "from": from_branch},
        )
        await self._emit_dispatch(
            task_id, "create_branch",
            {"repo": f"{owner}/{repo}", "branch": name}
        )

        try:
            result = await github.create_branch(
                owner=owner,
                repo=repo,
                branch_name=name,
                from_branch=from_branch,
            )

            sha = (
                result.get("sha", "")
                if isinstance(result, dict)
                else getattr(result, "sha", str(result))
            )

            record = self._vera_end(
                "create_branch", AgentCapability.GITHUB_WRITE,
                task_id, start, success=True,
                result_summary=f"branch={name} sha={sha[:12] if sha else '?'}",
            )
            await self._emit_complete(
                task_id, "create_branch",
                f"branch={name}", True, record.latency_ms
            )
            return sha

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "create_branch", AgentCapability.GITHUB_WRITE,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "create_branch", "", False, record.latency_ms
            )
            raise

    async def create_pr(
        self,
        owner: str,
        repo: str,
        title: str,
        head: str,
        base: str = "main",
        body: str = "",
    ) -> int:
        """
        Create a Pull Request.

        Args:
            owner: Repository owner.
            repo:  Repository name.
            title: PR title.
            head:  Source branch (the branch with changes).
            base:  Target branch (default: "main").
            body:  PR description / body text.

        Returns:
            int — pull request number.

        Raises:
            CapabilityDeniedError:    Agent lacks github_write.
            ProviderUnavailableError: GitHubProvider not configured.
        """
        self._require(AgentCapability.GITHUB_WRITE)
        github = self._require_github()

        start, task_id = self._vera_start(
            "create_pr", AgentCapability.GITHUB_WRITE,
            {
                "owner": owner, "repo": repo,
                "title": title[:80], "head": head, "base": base,
            },
        )
        await self._emit_dispatch(
            task_id, "create_pr",
            {"repo": f"{owner}/{repo}", "title": title[:80]}
        )

        try:
            pr = await github.create_pr(
                owner=owner,
                repo=repo,
                title=title,
                head=head,
                base=base,
                body=body,
            )

            pr_number = (
                pr.get("number", 0)
                if isinstance(pr, dict)
                else getattr(pr, "number", 0)
            )

            record = self._vera_end(
                "create_pr", AgentCapability.GITHUB_WRITE,
                task_id, start, success=True,
                result_summary=f"pr_number={pr_number}",
            )
            await self._emit_complete(
                task_id, "create_pr",
                f"pr_number={pr_number}", True, record.latency_ms
            )
            return int(pr_number)

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "create_pr", AgentCapability.GITHUB_WRITE,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "create_pr", "", False, record.latency_ms
            )
            raise

    async def create_issue(
        self,
        owner: str,
        repo: str,
        title: str,
        body: str = "",
        labels: Optional[List[str]] = None,
    ) -> int:
        """
        Create a GitHub Issue.

        Args:
            owner:  Repository owner.
            repo:   Repository name.
            title:  Issue title.
            body:   Issue body / description.
            labels: Optional list of label names to apply.

        Returns:
            int — issue number.

        Raises:
            CapabilityDeniedError:    Agent lacks github_write.
            ProviderUnavailableError: GitHubProvider not configured.
        """
        self._require(AgentCapability.GITHUB_WRITE)
        github = self._require_github()

        start, task_id = self._vera_start(
            "create_issue", AgentCapability.GITHUB_WRITE,
            {
                "owner": owner, "repo": repo,
                "title": title[:80], "labels": labels or [],
            },
        )
        await self._emit_dispatch(
            task_id, "create_issue",
            {"repo": f"{owner}/{repo}", "title": title[:80]}
        )

        try:
            issue = await github.create_issue(
                owner=owner,
                repo=repo,
                title=title,
                body=body,
                labels=labels,
            )

            issue_number = (
                issue.get("number", 0)
                if isinstance(issue, dict)
                else getattr(issue, "number", 0)
            )

            record = self._vera_end(
                "create_issue", AgentCapability.GITHUB_WRITE,
                task_id, start, success=True,
                result_summary=f"issue_number={issue_number}",
            )
            await self._emit_complete(
                task_id, "create_issue",
                f"issue_number={issue_number}", True, record.latency_ms
            )
            return int(issue_number)

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "create_issue", AgentCapability.GITHUB_WRITE,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "create_issue", "", False, record.latency_ms
            )
            raise

    async def list_directory(
        self,
        owner: str,
        repo: str,
        path: str = "",
        ref: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        List directory contents in a GitHub repository.

        Args:
            owner: Repository owner.
            repo:  Repository name.
            path:  Directory path (empty string = root).
            ref:   Git ref. Defaults to repo default branch.

        Returns:
            List[Dict] — each dict has keys: name, path, type, size, sha, url.

        Raises:
            CapabilityDeniedError:    Agent lacks github_read.
            ProviderUnavailableError: GitHubProvider not configured.
        """
        self._require(AgentCapability.GITHUB_READ)
        github = self._require_github()

        start, task_id = self._vera_start(
            "list_directory", AgentCapability.GITHUB_READ,
            {"owner": owner, "repo": repo, "path": path, "ref": ref},
        )
        await self._emit_dispatch(
            task_id, "list_directory",
            {"repo": f"{owner}/{repo}", "path": path}
        )

        try:
            tree = await github.get_directory_tree(
                owner=owner, repo=repo, path=path, ref=ref
            )

            # Normalise to list of dicts
            items: List[Dict[str, Any]] = []
            for item in (tree if isinstance(tree, list) else [tree]):
                if isinstance(item, dict):
                    items.append(item)
                else:
                    items.append({
                        "name": getattr(item, "name", str(item)),
                        "path": getattr(item, "path", ""),
                        "type": getattr(item, "type", ""),
                        "size": getattr(item, "size", 0),
                        "sha":  getattr(item, "sha", ""),
                        "url":  getattr(item, "html_url", ""),
                    })

            record = self._vera_end(
                "list_directory", AgentCapability.GITHUB_READ,
                task_id, start, success=True,
                result_summary=f"items={len(items)}",
            )
            await self._emit_complete(
                task_id, "list_directory",
                f"items={len(items)}", True, record.latency_ms
            )
            return items

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "list_directory", AgentCapability.GITHUB_READ,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "list_directory", "", False, record.latency_ms
            )
            raise

    async def trigger_workflow(
        self,
        owner: str,
        repo: str,
        workflow_id: int,
        ref: str = "main",
    ) -> None:
        """
        Dispatch a GitHub Actions workflow run.

        Args:
            owner:       Repository owner.
            repo:        Repository name.
            workflow_id: Numeric workflow ID (from list_workflows).
            ref:         Git ref to run the workflow against (default: "main").

        Raises:
            CapabilityDeniedError:    Agent lacks github_actions.
            ProviderUnavailableError: GitHubProvider not configured.
        """
        self._require(AgentCapability.GITHUB_ACTIONS)
        github = self._require_github()

        start, task_id = self._vera_start(
            "trigger_workflow", AgentCapability.GITHUB_ACTIONS,
            {
                "owner": owner, "repo": repo,
                "workflow_id": workflow_id, "ref": ref,
            },
        )
        await self._emit_dispatch(
            task_id, "trigger_workflow",
            {"repo": f"{owner}/{repo}", "workflow_id": workflow_id, "ref": ref}
        )

        try:
            await github.trigger_workflow(
                owner=owner,
                repo=repo,
                workflow_id=workflow_id,
                ref=ref,
            )

            record = self._vera_end(
                "trigger_workflow", AgentCapability.GITHUB_ACTIONS,
                task_id, start, success=True,
                result_summary=f"workflow_id={workflow_id} ref={ref}",
            )
            await self._emit_complete(
                task_id, "trigger_workflow",
                f"workflow_id={workflow_id}", True, record.latency_ms
            )

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "trigger_workflow", AgentCapability.GITHUB_ACTIONS,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "trigger_workflow", "", False, record.latency_ms
            )
            raise

    # ------------------------------------------------------------------
    # MEMORY METHODS — delegate to SCRIBEProviderBridge
    # ------------------------------------------------------------------

    async def remember(
        self,
        key: str,
        value: Any,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Store a key-value pair in SCRIBE memory.

        The value is serialized to JSON if it is not already a string.
        Metadata can include tags, session_id, priority, or any agent-defined
        context that aids later recall.

        Args:
            key:      Memory key / identifier string.
            value:    Value to store (any JSON-serializable type).
            metadata: Optional metadata dict attached to the memory entry.

        Raises:
            CapabilityDeniedError:    Agent lacks memory_store.
            ProviderUnavailableError: SCRIBEProviderBridge not configured.
        """
        self._require(AgentCapability.MEMORY_STORE)
        scribe = self._require_scribe()

        start, task_id = self._vera_start(
            "remember", AgentCapability.MEMORY_STORE,
            {"key": key, "value_type": type(value).__name__},
        )
        await self._emit_dispatch(task_id, "remember", {"key": key})

        try:
            content = (
                value if isinstance(value, str)
                else json.dumps(value, default=str)
            )
            meta = metadata or {}
            meta.setdefault("agent", self.agent_name)
            meta.setdefault("hive", self.hive)
            meta.setdefault("stored_at", time.time())

            # SCRIBEProviderBridge exposes store via the underlying scribe memory.
            # We call score_importance to determine priority, then delegate to
            # the SCRIBE memory's store method.
            await scribe._scribe.store(
                key=key,
                content=content,
                metadata=meta,
            )

            record = self._vera_end(
                "remember", AgentCapability.MEMORY_STORE,
                task_id, start, success=True,
                result_summary=f"key={key}",
            )
            await self._emit_complete(
                task_id, "remember",
                f"key={key}", True, record.latency_ms
            )

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except AttributeError:
            # Fallback: SCRIBEProviderBridge without direct _scribe.store access
            # Use the bridge's score_importance + manual storage if available
            try:
                content = (
                    value if isinstance(value, str)
                    else json.dumps(value, default=str)
                )
                meta = metadata or {}
                meta.setdefault("agent", self.agent_name)
                meta.setdefault("hive", self.hive)
                meta.setdefault("stored_at", time.time())

                # Try generic store method on scribe
                if hasattr(scribe, "store"):
                    await scribe.store(key=key, content=content, metadata=meta)
                elif hasattr(scribe, "_scribe") and hasattr(scribe._scribe, "add_episodic"):
                    scribe._scribe.add_episodic(
                        session_id=meta.get("session_id", "default"),
                        agent=self.agent_name,
                        event_type="memory_store",
                        content={"key": key, "value": content, **meta},
                    )
                else:
                    raise ProviderUnavailableError(
                        "SCRIBEProviderBridge",
                        "memory_store",
                        "No compatible store method found on SCRIBEProviderBridge",
                    )

                record = self._vera_end(
                    "remember", AgentCapability.MEMORY_STORE,
                    task_id, start, success=True,
                    result_summary=f"key={key} (fallback path)",
                )
                await self._emit_complete(
                    task_id, "remember",
                    f"key={key}", True, record.latency_ms
                )
            except Exception as inner_exc:
                record = self._vera_end(
                    "remember", AgentCapability.MEMORY_STORE,
                    task_id, start, success=False, error=str(inner_exc),
                )
                await self._emit_complete(
                    task_id, "remember", "", False, record.latency_ms
                )
                raise

        except Exception as exc:
            record = self._vera_end(
                "remember", AgentCapability.MEMORY_STORE,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "remember", "", False, record.latency_ms
            )
            raise

    async def recall(
        self,
        query: str,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Semantically search SCRIBE memory for entries matching the query.

        Uses embedding-based cosine similarity ranking via SCRIBEProviderBridge.

        Args:
            query: Natural language search query.
            limit: Maximum number of results to return (default 5).

        Returns:
            List[Dict] — memory entries sorted by descending relevance.
            Each dict contains the original memory fields plus a "similarity"
            key with the cosine similarity score.

        Raises:
            CapabilityDeniedError:    Agent lacks memory_recall.
            ProviderUnavailableError: SCRIBEProviderBridge not configured.
        """
        self._require(AgentCapability.MEMORY_RECALL)
        scribe = self._require_scribe()

        start, task_id = self._vera_start(
            "recall", AgentCapability.MEMORY_RECALL,
            {"query": query[:120], "limit": limit},
        )
        await self._emit_dispatch(task_id, "recall", {"query": query[:120]})

        try:
            results = await scribe.semantic_recall(
                query=query,
                top_k=limit,
            )

            record = self._vera_end(
                "recall", AgentCapability.MEMORY_RECALL,
                task_id, start, success=True,
                result_summary=f"results={len(results)}",
            )
            await self._emit_complete(
                task_id, "recall",
                f"results={len(results)}", True, record.latency_ms
            )
            return results

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "recall", AgentCapability.MEMORY_RECALL,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "recall", "", False, record.latency_ms
            )
            raise

    async def consolidate(
        self,
        session_id: str,
    ) -> Dict[str, Any]:
        """
        Trigger AI-powered memory consolidation for a session.

        Extracts semantic patterns from episodic memories, promotes entries
        to long-term semantic memory, and returns a consolidation report.

        Args:
            session_id: The session whose memories to consolidate.

        Returns:
            Dict — consolidation report with keys:
              - session_id, patterns_found, patterns, model,
                tokens_used, latency_ms, error (or None).

        Raises:
            CapabilityDeniedError:    Agent lacks memory_consolidate.
            ProviderUnavailableError: SCRIBEProviderBridge not configured.
        """
        self._require(AgentCapability.MEMORY_CONSOLIDATE)
        scribe = self._require_scribe()

        start, task_id = self._vera_start(
            "consolidate", AgentCapability.MEMORY_CONSOLIDATE,
            {"session_id": session_id},
        )
        await self._emit_dispatch(
            task_id, "consolidate", {"session_id": session_id}
        )

        try:
            report = await scribe.consolidate_with_ai(session_id=session_id)

            record = self._vera_end(
                "consolidate", AgentCapability.MEMORY_CONSOLIDATE,
                task_id, start, success=True,
                result_summary=(
                    f"session={session_id} "
                    f"patterns={report.get('patterns_found', 0)}"
                ),
            )
            await self._emit_complete(
                task_id, "consolidate",
                f"patterns={report.get('patterns_found', 0)}", True, record.latency_ms
            )
            return report

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "consolidate", AgentCapability.MEMORY_CONSOLIDATE,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "consolidate", "", False, record.latency_ms
            )
            raise

    # ------------------------------------------------------------------
    # BROWSER METHODS — delegate to BrowserOrchestrator
    # ------------------------------------------------------------------

    async def browse(
        self,
        url: str,
    ) -> Dict[str, Any]:
        """
        Navigate to a URL and return the page state.

        The returned dict contains the page content, title, URL, and any
        visible interactive elements.

        Args:
            url: The URL to navigate to (must include scheme, e.g. https://).

        Returns:
            Dict — page state with keys: url, title, content, elements, screenshot_id.

        Raises:
            CapabilityDeniedError:    Agent lacks browser_navigate.
            ProviderUnavailableError: BrowserOrchestrator not configured.
        """
        self._require(AgentCapability.BROWSER_NAVIGATE)
        browser = self._require_browser()

        start, task_id = self._vera_start(
            "browse", AgentCapability.BROWSER_NAVIGATE,
            {"url": url},
        )
        await self._emit_dispatch(task_id, "browse", {"url": url})

        try:
            page_state = await browser.navigate(url=url)

            result = (
                page_state if isinstance(page_state, dict)
                else {
                    "url": url,
                    "content": str(page_state),
                    "title": "",
                    "elements": [],
                    "screenshot_id": None,
                }
            )

            record = self._vera_end(
                "browse", AgentCapability.BROWSER_NAVIGATE,
                task_id, start, success=True,
                result_summary=f"url={url} title={result.get('title', '')[:60]}",
            )
            await self._emit_complete(
                task_id, "browse",
                f"url={url}", True, record.latency_ms
            )
            return result

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "browse", AgentCapability.BROWSER_NAVIGATE,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "browse", "", False, record.latency_ms
            )
            raise

    async def extract(
        self,
        url: str,
        schema: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Navigate to a URL and extract structured data matching a schema.

        Combines browser navigation with AI-powered structured extraction.

        Args:
            url:    The URL to navigate to.
            schema: JSON Schema describing the structure to extract.

        Returns:
            Dict — extracted data matching the provided schema.

        Raises:
            CapabilityDeniedError:    Agent lacks browser_extract.
            ProviderUnavailableError: BrowserOrchestrator not configured.
        """
        self._require(AgentCapability.BROWSER_EXTRACT)
        browser = self._require_browser()

        start, task_id = self._vera_start(
            "extract", AgentCapability.BROWSER_EXTRACT,
            {"url": url, "schema_keys": list(schema.get("properties", {}).keys())[:8]},
        )
        await self._emit_dispatch(
            task_id, "extract",
            {"url": url, "schema_summary": list(schema.get("properties", {}).keys())[:5]}
        )

        try:
            extracted = await browser.extract(url=url, schema=schema)

            result = (
                extracted if isinstance(extracted, dict)
                else {"raw": str(extracted)}
            )

            record = self._vera_end(
                "extract", AgentCapability.BROWSER_EXTRACT,
                task_id, start, success=True,
                result_summary=f"url={url} keys={list(result.keys())[:6]}",
            )
            await self._emit_complete(
                task_id, "extract",
                f"keys={list(result.keys())[:6]}", True, record.latency_ms
            )
            return result

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "extract", AgentCapability.BROWSER_EXTRACT,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "extract", "", False, record.latency_ms
            )
            raise

    # ------------------------------------------------------------------
    # EVENT METHODS — publish to EventBus
    # ------------------------------------------------------------------

    async def emit(
        self,
        channel: str,
        payload: Dict[str, Any],
        severity: str = "info",
    ) -> None:
        """
        Publish an event to the EventBus on the given channel.

        The agent is recorded as the source.  Any subscribers on that channel
        (WebSocket clients, internal callbacks) receive the event.

        Args:
            channel:  Channel name (any string; use Channel enum values for
                      predefined channels).
            payload:  Event payload dict (must be JSON-serializable).
            severity: "info" | "warning" | "error" | "critical" (default "info").

        Raises:
            CapabilityDeniedError: Agent lacks event_publish.
        """
        self._require(AgentCapability.EVENT_PUBLISH)

        start, task_id = self._vera_start(
            "emit", AgentCapability.EVENT_PUBLISH,
            {"channel": channel, "severity": severity},
        )

        try:
            if self._event_bus is not None and _EVENT_BUS_AVAILABLE:
                sev_map = {
                    "info":     Severity.INFO,
                    "warning":  Severity.WARNING,
                    "error":    Severity.ERROR,
                    "critical": Severity.CRITICAL,
                }
                sev = sev_map.get(severity.lower(), Severity.INFO)
                event = EngineEvent(
                    channel=channel,
                    source_agent=self.agent_name,
                    payload={
                        "agent": self.agent_name,
                        "hive": self.hive,
                        **payload,
                    },
                    severity=sev,
                )
                await self._event_bus.publish(channel, event)
                logger.debug(
                    f"[agent_bridge][emit] agent={self.agent_name} "
                    f"channel={channel} severity={severity}"
                )
            else:
                # Fallback: loguru-only event
                logger.log(
                    severity.upper() if severity.upper() in ("WARNING", "ERROR", "CRITICAL") else "INFO",
                    f"[agent_bridge][emit][fallback] agent={self.agent_name} "
                    f"channel={channel} payload={json.dumps(payload, default=str)[:256]}"
                )

            self._vera_end(
                "emit", AgentCapability.EVENT_PUBLISH,
                task_id, start, success=True,
                result_summary=f"channel={channel}",
            )

        except CapabilityDeniedError:
            raise
        except Exception as exc:
            self._vera_end(
                "emit", AgentCapability.EVENT_PUBLISH,
                task_id, start, success=False, error=str(exc),
            )
            raise

    async def log(
        self,
        message: str,
        level: str = "info",
    ) -> None:
        """
        Write a VERA audit log entry and publish an event.

        This is the canonical way for agents to produce observable output.
        The message is written to the loguru audit trail AND published to
        the EventBus (if event_publish capability is available).

        Args:
            message: Log message text.
            level:   Log level: "debug" | "info" | "warning" | "error" | "critical".

        Note:
            This method does NOT require event_publish capability.
            The EventBus publish is attempted only if the agent has that cap.
        """
        level_upper = level.upper()
        if level_upper not in ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"):
            level_upper = "INFO"

        logger.log(
            level_upper,
            f"[VERA][agent_log] agent={self.agent_name} hive={self.hive} | {message}"
        )

        # Attempt EventBus publish if capable (non-fatal if denied)
        if AgentCapability.EVENT_PUBLISH in self.capabilities and self._event_bus is not None:
            try:
                await self.emit(
                    channel="agent.log",
                    payload={
                        "message": message,
                        "level": level,
                        "agent": self.agent_name,
                        "hive": self.hive,
                    },
                    severity=level,
                )
            except Exception:
                pass  # log() must never raise

    # ------------------------------------------------------------------
    # WORKSPACE METHODS — delegate to GoogleProvider
    # ------------------------------------------------------------------

    async def create_doc(
        self,
        title: str,
        content: str,
    ) -> str:
        """
        Create a Google Doc with the given title and content.

        Args:
            title:   Document title.
            content: Document body text (plain text; the provider handles
                     Google Docs API formatting).

        Returns:
            str — URL of the created Google Doc.

        Raises:
            CapabilityDeniedError:    Agent lacks workspace_docs.
            ProviderUnavailableError: GoogleProvider not configured.
        """
        self._require(AgentCapability.WORKSPACE_DOCS)
        google = self._require_google()

        start, task_id = self._vera_start(
            "create_doc", AgentCapability.WORKSPACE_DOCS,
            {"title": title[:80], "content_len": len(content)},
        )
        await self._emit_dispatch(
            task_id, "create_doc", {"title": title[:80]}
        )

        try:
            # GoogleProvider.drive_upload_file can create Docs via MIME type
            # We use the workspace-specific method if available
            if hasattr(google, "drive_create_doc"):
                result = await google.drive_create_doc(
                    title=title, content=content
                )
            elif hasattr(google, "drive_upload_file"):
                result = await google.drive_upload_file(
                    file_name=title,
                    content=content.encode("utf-8"),
                    mime_type="application/vnd.google-apps.document",
                    parent_folder_id=None,
                )
            else:
                raise ProviderUnavailableError(
                    "GoogleProvider",
                    "workspace_docs",
                    "GoogleProvider does not expose a document creation method",
                )

            url = (
                result.get("webViewLink", result.get("id", ""))
                if isinstance(result, dict)
                else getattr(result, "web_view_link", str(result))
            )
            # Build a Google Docs URL if we only have a file ID
            if url and not url.startswith("http"):
                url = f"https://docs.google.com/document/d/{url}/edit"

            record = self._vera_end(
                "create_doc", AgentCapability.WORKSPACE_DOCS,
                task_id, start, success=True,
                result_summary=f"title={title[:40]} url={url[:60]}",
            )
            await self._emit_complete(
                task_id, "create_doc",
                f"url={url[:60]}", True, record.latency_ms
            )
            return url

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "create_doc", AgentCapability.WORKSPACE_DOCS,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "create_doc", "", False, record.latency_ms
            )
            raise

    async def send_email(
        self,
        to: str,
        subject: str,
        body: str,
    ) -> str:
        """
        Send an email via Gmail.

        Args:
            to:      Recipient email address.
            subject: Email subject line.
            body:    Email body (plain text).

        Returns:
            str — Gmail message ID of the sent email.

        Raises:
            CapabilityDeniedError:    Agent lacks workspace_email.
            ProviderUnavailableError: GoogleProvider not configured.
        """
        self._require(AgentCapability.WORKSPACE_EMAIL)
        google = self._require_google()

        start, task_id = self._vera_start(
            "send_email", AgentCapability.WORKSPACE_EMAIL,
            {"to": to, "subject": subject[:80], "body_len": len(body)},
        )
        await self._emit_dispatch(
            task_id, "send_email",
            {"to": to, "subject": subject[:80]}
        )

        try:
            result = await google.gmail_send(
                to=to, subject=subject, body=body
            )

            msg_id = (
                result.get("id", "")
                if isinstance(result, dict)
                else getattr(result, "id", str(result))
            )

            record = self._vera_end(
                "send_email", AgentCapability.WORKSPACE_EMAIL,
                task_id, start, success=True,
                result_summary=f"to={to} msg_id={msg_id}",
            )
            await self._emit_complete(
                task_id, "send_email",
                f"msg_id={msg_id}", True, record.latency_ms
            )
            return msg_id

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "send_email", AgentCapability.WORKSPACE_EMAIL,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "send_email", "", False, record.latency_ms
            )
            raise

    async def list_events(
        self,
        days: int = 7,
    ) -> List[Dict[str, Any]]:
        """
        List upcoming calendar events.

        Args:
            days: Number of days ahead to query (default 7).

        Returns:
            List[Dict] — calendar events, each with keys:
              id, summary, start, end, description, location, html_link.

        Raises:
            CapabilityDeniedError:    Agent lacks workspace_calendar.
            ProviderUnavailableError: GoogleProvider not configured.
        """
        self._require(AgentCapability.WORKSPACE_CALENDAR)
        google = self._require_google()

        start, task_id = self._vera_start(
            "list_events", AgentCapability.WORKSPACE_CALENDAR,
            {"days": days},
        )
        await self._emit_dispatch(task_id, "list_events", {"days": days})

        try:
            from datetime import datetime, timedelta, timezone
            time_min = datetime.now(timezone.utc)
            time_max = time_min + timedelta(days=days)

            result = await google.calendar_list_events(
                time_min=time_min.isoformat(),
                time_max=time_max.isoformat(),
            )

            events: List[Dict[str, Any]] = (
                result if isinstance(result, list)
                else result.get("items", []) if isinstance(result, dict)
                else []
            )

            record = self._vera_end(
                "list_events", AgentCapability.WORKSPACE_CALENDAR,
                task_id, start, success=True,
                result_summary=f"events={len(events)} days={days}",
            )
            await self._emit_complete(
                task_id, "list_events",
                f"events={len(events)}", True, record.latency_ms
            )
            return events

        except (CapabilityDeniedError, ProviderUnavailableError):
            raise
        except Exception as exc:
            record = self._vera_end(
                "list_events", AgentCapability.WORKSPACE_CALENDAR,
                task_id, start, success=False, error=str(exc),
            )
            await self._emit_complete(
                task_id, "list_events", "", False, record.latency_ms
            )
            raise

    # ------------------------------------------------------------------
    # Introspection / audit trail
    # ------------------------------------------------------------------

    def get_audit_log(
        self,
        limit: int = 100,
        operation_filter: Optional[str] = None,
        success_only: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Return recent VERA audit records for this agent.

        Args:
            limit:            Maximum number of records to return.
            operation_filter: If set, only return records matching this op name.
            success_only:     If True, exclude failed operations.

        Returns:
            List[Dict] — audit records, most recent first.
        """
        records = self._audit_log
        if operation_filter:
            records = [r for r in records if r.operation == operation_filter]
        if success_only:
            records = [r for r in records if r.success]
        return [r.model_dump() for r in records[-limit:]][::-1]

    def get_stats(self) -> Dict[str, Any]:
        """
        Return operational statistics for this toolkit instance.

        Returns:
            Dict with keys: agent_name, hive, total_ops, capabilities,
            error_count, avg_latency_ms, total_latency_ms.
        """
        total = len(self._audit_log)
        errors = sum(1 for r in self._audit_log if not r.success)
        total_latency = sum(r.latency_ms for r in self._audit_log)
        avg_latency = total_latency / total if total > 0 else 0.0

        return {
            "agent_name": self.agent_name,
            "hive": self.hive,
            "total_ops": total,
            "capabilities": [c.value for c in self.capabilities],
            "error_count": errors,
            "avg_latency_ms": round(avg_latency, 2),
            "total_latency_ms": round(total_latency, 2),
            "providers": {
                "model_router": self._router is not None,
                "github": self._github is not None,
                "scribe": self._scribe is not None,
                "google": self._google is not None,
                "browser": self._browser is not None,
                "event_bus": self._event_bus is not None,
            },
        }

    def __repr__(self) -> str:
        caps = [c.value for c in self.capabilities]
        return (
            f"<AgentToolkit agent={self.agent_name!r} hive={self.hive!r} "
            f"caps={len(caps)} ops={self._ops_count}>"
        )


# ---------------------------------------------------------------------------
# Hive Capability Maps
# ---------------------------------------------------------------------------

#: Capability sets indexed by hive name.
#: Used by AgentToolkitFactory.get_capabilities_for_hive().
_HIVE_CAPABILITIES: Dict[str, Set[AgentCapability]] = {

    # AURORA — design/build agents: create code, docs, assets, deploy
    "AURORA": {
        AgentCapability.AI_COMPLETION,
        AgentCapability.AI_SEARCH,
        AgentCapability.AI_STREAMING,
        AgentCapability.EMBEDDINGS,
        AgentCapability.GITHUB_READ,
        AgentCapability.GITHUB_WRITE,
        AgentCapability.GITHUB_ACTIONS,
        AgentCapability.BROWSER_NAVIGATE,
        AgentCapability.BROWSER_EXTRACT,
        AgentCapability.WORKSPACE_DOCS,
        AgentCapability.WORKSPACE_EMAIL,
        AgentCapability.WORKSPACE_CALENDAR,
        AgentCapability.WORKSPACE_DRIVE,
        AgentCapability.EVENT_PUBLISH,
    },

    # LEX — constitutional guard: review, classify, no write side-effects
    "LEX": {
        AgentCapability.AI_COMPLETION,
        AgentCapability.AI_SEARCH,
        AgentCapability.MEMORY_STORE,
        AgentCapability.MEMORY_RECALL,
        AgentCapability.MEMORY_CONSOLIDATE,
        AgentCapability.EVENT_PUBLISH,
    },

    # KEEPER — knowledge agents: read code/docs, maintain memory, embed
    "KEEPER": {
        AgentCapability.AI_COMPLETION,
        AgentCapability.AI_SEARCH,
        AgentCapability.AI_STREAMING,
        AgentCapability.EMBEDDINGS,
        AgentCapability.GITHUB_READ,
        AgentCapability.MEMORY_STORE,
        AgentCapability.MEMORY_RECALL,
        AgentCapability.MEMORY_CONSOLIDATE,
        AgentCapability.EVENT_PUBLISH,
    },

    # BROADCAST — media/comms agents: generate + stream content, workspace, events
    "BROADCAST": {
        AgentCapability.AI_COMPLETION,
        AgentCapability.AI_STREAMING,
        AgentCapability.WORKSPACE_DOCS,
        AgentCapability.WORKSPACE_EMAIL,
        AgentCapability.WORKSPACE_CALENDAR,
        AgentCapability.WORKSPACE_DRIVE,
        AgentCapability.EVENT_PUBLISH,
    },

    # SWITCHBOARD — ops/routing agents: all capabilities for coordination
    "SWITCHBOARD": {
        AgentCapability.AI_COMPLETION,
        AgentCapability.AI_SEARCH,
        AgentCapability.AI_STREAMING,
        AgentCapability.EMBEDDINGS,
        AgentCapability.GITHUB_READ,
        AgentCapability.GITHUB_WRITE,
        AgentCapability.GITHUB_ACTIONS,
        AgentCapability.BROWSER_NAVIGATE,
        AgentCapability.BROWSER_EXTRACT,
        AgentCapability.MEMORY_STORE,
        AgentCapability.MEMORY_RECALL,
        AgentCapability.MEMORY_CONSOLIDATE,
        AgentCapability.WORKSPACE_DOCS,
        AgentCapability.WORKSPACE_EMAIL,
        AgentCapability.WORKSPACE_CALENDAR,
        AgentCapability.WORKSPACE_DRIVE,
        AgentCapability.EVENT_PUBLISH,
    },

    # COMPASS — validation agents: review, search, read, remember
    "COMPASS": {
        AgentCapability.AI_COMPLETION,
        AgentCapability.AI_SEARCH,
        AgentCapability.GITHUB_READ,
        AgentCapability.MEMORY_STORE,
        AgentCapability.MEMORY_RECALL,
        AgentCapability.EVENT_PUBLISH,
    },

    # AVERI — strategist agents: all capabilities
    "AVERI": {
        AgentCapability.AI_COMPLETION,
        AgentCapability.AI_SEARCH,
        AgentCapability.AI_STREAMING,
        AgentCapability.EMBEDDINGS,
        AgentCapability.GITHUB_READ,
        AgentCapability.GITHUB_WRITE,
        AgentCapability.GITHUB_ACTIONS,
        AgentCapability.BROWSER_NAVIGATE,
        AgentCapability.BROWSER_EXTRACT,
        AgentCapability.MEMORY_STORE,
        AgentCapability.MEMORY_RECALL,
        AgentCapability.MEMORY_CONSOLIDATE,
        AgentCapability.WORKSPACE_DOCS,
        AgentCapability.WORKSPACE_EMAIL,
        AgentCapability.WORKSPACE_CALENDAR,
        AgentCapability.WORKSPACE_DRIVE,
        AgentCapability.EVENT_PUBLISH,
    },
}

# Alias: COMET = SWITCHBOARD (browser/ops orchestration hive)
_HIVE_CAPABILITIES["COMET"] = _HIVE_CAPABILITIES["SWITCHBOARD"]

# Alias: NEXUS = AVERI (full strategic access)
_HIVE_CAPABILITIES["NEXUS"] = _HIVE_CAPABILITIES["AVERI"]


# ---------------------------------------------------------------------------
# AgentToolkitFactory
# ---------------------------------------------------------------------------

class AgentToolkitFactory:
    """
    Creates pre-configured AgentToolkit instances for specific agents.

    The factory holds shared provider references and constructs toolkits
    with the correct capability set for each agent's hive.

    Usage:
        factory = AgentToolkitFactory(
            model_router=router,
            github=github_provider,
            scribe=scribe_bridge,
            google=google_provider,
            event_bus=event_bus,
        )

        toolkit = factory.create_toolkit("KEEPER-prime", "KEEPER")
        answer = await toolkit.think("What is the current PR diff?")

    The factory caches toolkits by agent_name for efficient reuse.
    Call ``invalidate(agent_name)`` to force a fresh toolkit on next access.
    """

    def __init__(
        self,
        *,
        model_router: Optional[Any] = None,
        github: Optional[Any] = None,
        scribe: Optional[Any] = None,
        google: Optional[Any] = None,
        browser: Optional[Any] = None,
        event_bus: Optional[Any] = None,
    ) -> None:
        self._router = model_router
        self._github = github
        self._scribe = scribe
        self._google = google
        self._browser = browser
        self._event_bus = event_bus

        # Toolkit cache: agent_name → AgentToolkit
        self._cache: Dict[str, AgentToolkit] = {}

        logger.info(
            "[VERA][toolkit_factory] AgentToolkitFactory initialised | "
            f"router={'yes' if model_router else 'no'} "
            f"github={'yes' if github else 'no'} "
            f"scribe={'yes' if scribe else 'no'} "
            f"google={'yes' if google else 'no'} "
            f"browser={'yes' if browser else 'no'} "
            f"event_bus={'yes' if event_bus else 'no'}"
        )

    def get_capabilities_for_hive(
        self,
        hive: str,
    ) -> Set[AgentCapability]:
        """
        Return the standard capability set for the given hive name.

        Falls back to a minimal read-only set if the hive is unrecognized
        to avoid accidentally granting full access to unknown hives.

        Args:
            hive: Hive name (case-insensitive).  e.g. "AURORA", "LEX".

        Returns:
            Set[AgentCapability] — capabilities granted to agents in this hive.
        """
        normalised = hive.upper().strip()
        caps = _HIVE_CAPABILITIES.get(normalised)

        if caps is None:
            logger.warning(
                f"[VERA][toolkit_factory] Unknown hive '{hive}' — "
                "falling back to minimal read-only capabilities. "
                "Register the hive in _HIVE_CAPABILITIES to suppress this warning."
            )
            # Minimal safe fallback: AI completion + read-only GitHub + recall
            caps = {
                AgentCapability.AI_COMPLETION,
                AgentCapability.GITHUB_READ,
                AgentCapability.MEMORY_RECALL,
                AgentCapability.EVENT_PUBLISH,
            }

        return set(caps)  # Return a mutable copy

    def create_toolkit(
        self,
        agent_name: str,
        hive: str,
        *,
        extra_capabilities: Optional[Set[AgentCapability]] = None,
        deny_capabilities: Optional[Set[AgentCapability]] = None,
        use_cache: bool = True,
    ) -> AgentToolkit:
        """
        Create (or retrieve from cache) an AgentToolkit for the given agent.

        Capability set is determined by the hive's default set, then modified
        by extra_capabilities (additions) and deny_capabilities (removals).

        Args:
            agent_name:          Unique agent identifier.
            hive:                Hive name — determines base capability set.
            extra_capabilities:  Additional capabilities to grant beyond the
                                 hive default (e.g. for temporary elevation).
            deny_capabilities:   Capabilities to strip from the hive default
                                 (e.g. for sandboxing a specific agent).
            use_cache:           If True (default), return a cached toolkit
                                 if one exists for this agent_name.

        Returns:
            AgentToolkit — ready-to-use toolkit for the agent.
        """
        if use_cache and agent_name in self._cache:
            logger.debug(
                f"[toolkit_factory] Cache hit for agent={agent_name}"
            )
            return self._cache[agent_name]

        capabilities = self.get_capabilities_for_hive(hive)

        if extra_capabilities:
            capabilities |= extra_capabilities
            logger.info(
                f"[VERA][toolkit_factory] Elevated capabilities for "
                f"agent={agent_name}: added={[c.value for c in extra_capabilities]}"
            )

        if deny_capabilities:
            capabilities -= deny_capabilities
            logger.warning(
                f"[VERA][toolkit_factory] Restricted capabilities for "
                f"agent={agent_name}: denied={[c.value for c in deny_capabilities]}"
            )

        toolkit = AgentToolkit(
            agent_name=agent_name,
            hive=hive,
            capabilities=capabilities,
            event_bus=self._event_bus,
            model_router=self._router,
            github=self._github,
            scribe=self._scribe,
            google=self._google,
            browser=self._browser,
        )

        if use_cache:
            self._cache[agent_name] = toolkit

        logger.info(
            "[VERA][toolkit_factory] Toolkit created | "
            f"agent={agent_name} hive={hive} "
            f"caps={len(capabilities)}"
        )
        return toolkit

    def invalidate(self, agent_name: str) -> bool:
        """
        Remove a cached toolkit, forcing fresh creation on next access.

        Args:
            agent_name: The agent whose toolkit to invalidate.

        Returns:
            bool — True if an entry was removed, False if not found.
        """
        existed = agent_name in self._cache
        self._cache.pop(agent_name, None)
        if existed:
            logger.info(
                f"[VERA][toolkit_factory] Invalidated cache for agent={agent_name}"
            )
        return existed

    def invalidate_all(self) -> int:
        """
        Clear all cached toolkits.

        Returns:
            int — number of toolkits evicted.
        """
        count = len(self._cache)
        self._cache.clear()
        logger.info(
            f"[VERA][toolkit_factory] Cache cleared ({count} toolkits evicted)"
        )
        return count

    def list_agents(self) -> List[str]:
        """Return agent names for all currently cached toolkits."""
        return list(self._cache.keys())

    def register_hive(
        self,
        hive_name: str,
        capabilities: Set[AgentCapability],
        overwrite: bool = False,
    ) -> None:
        """
        Register a custom hive with a specific capability set.

        Use this to extend the system with project-specific hives without
        modifying the module-level _HIVE_CAPABILITIES dict.

        Args:
            hive_name:    Name of the new hive (case-insensitive).
            capabilities: Set of AgentCapability values for this hive.
            overwrite:    If False (default), raises ValueError if the hive
                          already exists.

        Raises:
            ValueError: If hive_name already exists and overwrite is False.
        """
        normalised = hive_name.upper().strip()
        if normalised in _HIVE_CAPABILITIES and not overwrite:
            raise ValueError(
                f"Hive '{normalised}' already exists. "
                "Pass overwrite=True to replace it."
            )
        _HIVE_CAPABILITIES[normalised] = set(capabilities)
        logger.info(
            f"[VERA][toolkit_factory] Registered hive '{normalised}' "
            f"with {len(capabilities)} capabilities"
        )

    def __repr__(self) -> str:
        return (
            f"<AgentToolkitFactory "
            f"cached_agents={len(self._cache)} "
            f"hives={list(_HIVE_CAPABILITIES.keys())}>"
        )


# ---------------------------------------------------------------------------
# Module-level singleton factory (optional convenience)
# ---------------------------------------------------------------------------

_default_factory: Optional[AgentToolkitFactory] = None


def configure_default_factory(
    *,
    model_router: Optional[Any] = None,
    github: Optional[Any] = None,
    scribe: Optional[Any] = None,
    google: Optional[Any] = None,
    browser: Optional[Any] = None,
    event_bus: Optional[Any] = None,
) -> AgentToolkitFactory:
    """
    Create (or replace) the module-level default AgentToolkitFactory.

    Intended to be called once during application startup, e.g. in
    cle_engine.engine_os.EngineOS.boot().

    Args:
        model_router: Configured ModelRouter instance.
        github:       Configured GitHubProvider instance.
        scribe:       Configured SCRIBEProviderBridge instance.
        google:       Configured GoogleProvider instance.
        browser:      Configured BrowserOrchestrator instance.
        event_bus:    Running EventBus instance.

    Returns:
        AgentToolkitFactory — the new default factory.
    """
    global _default_factory
    _default_factory = AgentToolkitFactory(
        model_router=model_router,
        github=github,
        scribe=scribe,
        google=google,
        browser=browser,
        event_bus=event_bus,
    )
    logger.info("[VERA][agent_bridge] Default factory configured")
    return _default_factory


def get_default_factory() -> AgentToolkitFactory:
    """
    Return the module-level default factory.

    Raises:
        RuntimeError: If configure_default_factory() has not been called yet.
    """
    if _default_factory is None:
        raise RuntimeError(
            "AgentToolkitFactory has not been configured. "
            "Call configure_default_factory() during engine boot."
        )
    return _default_factory


def get_toolkit(agent_name: str, hive: str) -> AgentToolkit:
    """
    Convenience wrapper: get a toolkit from the default factory.

    Args:
        agent_name: Agent identifier.
        hive:       Hive name.

    Returns:
        AgentToolkit

    Raises:
        RuntimeError: If the default factory has not been configured.
    """
    return get_default_factory().create_toolkit(agent_name, hive)


# ---------------------------------------------------------------------------
# Public exports
# ---------------------------------------------------------------------------

__all__ = [
    # Core classes
    "AgentCapability",
    "AgentToolkit",
    "AgentToolkitFactory",
    # Exceptions
    "CapabilityDeniedError",
    "ProviderUnavailableError",
    # Models
    "VERARecord",
    # Factory helpers
    "configure_default_factory",
    "get_default_factory",
    "get_toolkit",
    # Constants
    "_HIVE_CAPABILITIES",
]
