"""
cle_engine/agents/agent_registry_v2.py

HELIX-M: Agent Registry V2
Discovers agents from .agent-status.json and gives them live provider
capabilities via AgentToolkitFactory.

This module is the authoritative source-of-truth for every agent in the
Creative Liberation Engine fleet.  It:

  1. Reads the flat .agent-status.json registry written by BootSystem.
  2. Builds a typed AgentRecord (Pydantic) for every agent — including
     hive-derived capabilities.
  3. Provisions AgentToolkits via AgentToolkitFactory for active agents.
  4. Provides async query helpers: by name, hive, mode, capability.
  5. Emits EventBus notifications at every lifecycle inflection point.
  6. Maintains per-agent health state with a lightweight async health-check.

Constitutional Compliance:
  - Article II:   Separation of Powers — capability sets scoped per hive
  - Article IX:   No MVPs — full implementation, zero stubs
  - Article XII:  OISE — provider-agnostic; degrades gracefully
  - Article XVII: VERA — every mutation and query emits an audit log line
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from loguru import logger
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Graceful imports — registry stays functional even with missing providers
# ---------------------------------------------------------------------------

try:
    from cle_engine.agents.agent_provider_bridge import (
        AgentCapability as _BridgeCapability,
        AgentToolkit,
        AgentToolkitFactory,
        CapabilityDeniedError,
        ProviderUnavailableError,
    )
    _BRIDGE_AVAILABLE = True
except ImportError:
    try:
        from agents.agent_provider_bridge import (  # type: ignore[no-redef]
            AgentCapability as _BridgeCapability,
            AgentToolkit,
            AgentToolkitFactory,
            CapabilityDeniedError,
            ProviderUnavailableError,
        )
        _BRIDGE_AVAILABLE = True
    except ImportError:
        _BRIDGE_AVAILABLE = False
        AgentToolkit = None          # type: ignore[assignment,misc]
        AgentToolkitFactory = None   # type: ignore[assignment,misc]
        CapabilityDeniedError = None # type: ignore[assignment,misc]
        ProviderUnavailableError = None  # type: ignore[assignment,misc]
        logger.warning(
            "[agent_registry_v2] agent_provider_bridge not found — "
            "toolkit provisioning will be disabled"
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
        from websocket.event_bus import (  # type: ignore[no-redef]
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
            "[agent_registry_v2] EventBus not found — "
            "events will use loguru-only fallback"
        )


# ---------------------------------------------------------------------------
# AgentCapability — local enum used by AgentRecord
# (Mirrors the bridge's enum but defined here so the registry is self-contained
#  when the bridge package is absent.)
# ---------------------------------------------------------------------------

class AgentCapability(str, Enum):
    """
    Enumeration of all capabilities an agent may hold.

    Capability names are intentionally coarser-grained than the bridge's
    internal enum so that the registry JSON can describe capabilities in a
    human-readable way without hard-coupling to provider internals.
    """

    # ── AI ──────────────────────────────────────────────────────────────────
    AI_COMPLETE    = "ai_complete"
    AI_STREAM      = "ai_stream"
    AI_SEARCH      = "ai_search"
    AI_EMBEDDINGS  = "ai_embeddings"

    # ── GitHub ───────────────────────────────────────────────────────────────
    GITHUB_READ    = "github_read"
    GITHUB_WRITE   = "github_write"

    # ── Google Workspace ─────────────────────────────────────────────────────
    GOOGLE_DOCS     = "google_docs"
    GOOGLE_DRIVE    = "google_drive"
    GOOGLE_CALENDAR = "google_calendar"

    # ── Memory ───────────────────────────────────────────────────────────────
    MEMORY_READ    = "memory_read"
    MEMORY_WRITE   = "memory_write"

    # ── Events ───────────────────────────────────────────────────────────────
    EVENT_PUBLISH   = "event_publish"
    EVENT_SUBSCRIBE = "event_subscribe"

    # ── Browser ──────────────────────────────────────────────────────────────
    BROWSER        = "browser"


# ---------------------------------------------------------------------------
# Hive → Capability mapping
# ---------------------------------------------------------------------------

# Keys match the group names found in .agent-status.json (lowercase).
# Capability sets follow the principle of least privilege per hive.
HIVE_CAPABILITIES: Dict[str, Set[AgentCapability]] = {
    "averi_triad": {
        AgentCapability.AI_COMPLETE,
        AgentCapability.AI_STREAM,
        AgentCapability.AI_SEARCH,
        AgentCapability.MEMORY_READ,
        AgentCapability.MEMORY_WRITE,
        AgentCapability.EVENT_PUBLISH,
    },
    "coordination": {
        AgentCapability.AI_COMPLETE,
        AgentCapability.MEMORY_READ,
        AgentCapability.MEMORY_WRITE,
        AgentCapability.EVENT_PUBLISH,
        AgentCapability.EVENT_SUBSCRIBE,
    },
    "advisory": {
        AgentCapability.AI_COMPLETE,
        AgentCapability.AI_SEARCH,
        AgentCapability.MEMORY_READ,
    },
    "hive_aurora": {
        AgentCapability.AI_COMPLETE,
        AgentCapability.AI_STREAM,
        AgentCapability.GITHUB_READ,
        AgentCapability.GITHUB_WRITE,
        AgentCapability.GOOGLE_DOCS,
        AgentCapability.BROWSER,
        AgentCapability.EVENT_PUBLISH,
    },
    "hive_lex": {
        AgentCapability.AI_COMPLETE,
        AgentCapability.AI_SEARCH,
        AgentCapability.MEMORY_READ,
        AgentCapability.EVENT_PUBLISH,
    },
    "hive_keeper": {
        AgentCapability.AI_COMPLETE,
        AgentCapability.AI_SEARCH,
        AgentCapability.AI_EMBEDDINGS,
        AgentCapability.MEMORY_READ,
        AgentCapability.MEMORY_WRITE,
        AgentCapability.GITHUB_READ,
        AgentCapability.EVENT_PUBLISH,
    },
    "hive_broadcast": {
        AgentCapability.AI_COMPLETE,
        AgentCapability.AI_STREAM,
        AgentCapability.GOOGLE_DRIVE,
        AgentCapability.EVENT_PUBLISH,
        AgentCapability.EVENT_SUBSCRIBE,
    },
    "hive_switchboard": {
        AgentCapability.AI_COMPLETE,
        AgentCapability.EVENT_PUBLISH,
        AgentCapability.EVENT_SUBSCRIBE,
        AgentCapability.MEMORY_READ,
    },
    "validators": {
        AgentCapability.AI_COMPLETE,
        AgentCapability.AI_SEARCH,
        AgentCapability.MEMORY_READ,
        AgentCapability.EVENT_PUBLISH,
    },
}

# Minimal read-only fallback for unrecognized hives
_FALLBACK_CAPABILITIES: Set[AgentCapability] = {
    AgentCapability.AI_COMPLETE,
    AgentCapability.MEMORY_READ,
    AgentCapability.EVENT_PUBLISH,
}


# ---------------------------------------------------------------------------
# Pydantic data models
# ---------------------------------------------------------------------------

class AgentRecord(BaseModel):
    """
    A fully-typed record representing one agent in the registry.

    Fields populated from the JSON:
        name, function, type, mode, group, status

    Fields derived by AgentRegistryV2:
        capabilities  — hive-derived capability set
        toolkit       — AgentToolkit once provisioned (None until then)
        health        — last known health state string
        last_health_check — UTC datetime of most recent health check
    """

    # ── From JSON ────────────────────────────────────────────────────────────
    name:     str = Field(..., description="Unique agent identifier, e.g. 'AURORA-7'")
    function: str = Field(..., description="Human-readable description of agent role")
    type:     str = Field(..., description="Agent archetype: leader, builder, validator, advisor, etc.")
    mode:     str = Field(..., description="Operational mode: build, validate, advisory")
    group:    str = Field(..., description="Hive/group name from registry JSON, e.g. 'hive_aurora'")
    status:   str = Field(..., description="Lifecycle status: active, inactive")

    # ── Derived ──────────────────────────────────────────────────────────────
    capabilities:      Set[AgentCapability] = Field(default_factory=set)
    toolkit:           Optional[Any]        = Field(default=None, exclude=True)
    health:            str                  = Field(default="unknown")
    last_health_check: Optional[datetime]   = Field(default=None)

    model_config = {"arbitrary_types_allowed": True, "use_enum_values": False}

    # ── Convenience ──────────────────────────────────────────────────────────

    @property
    def is_active(self) -> bool:
        """Return True if the agent's status is 'active'."""
        return self.status.lower() == "active"

    @property
    def is_provisioned(self) -> bool:
        """Return True if the agent has a live AgentToolkit."""
        return self.toolkit is not None

    def has_capability(self, cap: AgentCapability) -> bool:
        """Return True if *cap* is in this agent's capability set."""
        return cap in self.capabilities

    def to_summary(self) -> Dict[str, Any]:
        """Return a lightweight dict suitable for health reports / API responses."""
        return {
            "name":         self.name,
            "function":     self.function,
            "type":         self.type,
            "mode":         self.mode,
            "group":        self.group,
            "status":       self.status,
            "capabilities": [c.value for c in self.capabilities],
            "provisioned":  self.is_provisioned,
            "health":       self.health,
            "last_health_check": (
                self.last_health_check.isoformat()
                if self.last_health_check else None
            ),
        }


class RegistryInitEvent(BaseModel):
    """Event payload emitted on successful registry initialisation."""
    event:          str      = "agent.registry.init"
    registry_path:  str      = ""
    total_agents:   int      = 0
    active_agents:  int      = 0
    hives_found:    List[str] = Field(default_factory=list)
    timestamp:      float    = Field(default_factory=time.time)


class ToolkitProvisionedEvent(BaseModel):
    """Event payload emitted when a toolkit is created for an agent."""
    event:        str   = "agent.toolkit.provisioned"
    agent_name:   str   = ""
    hive:         str   = ""
    capabilities: List[str] = Field(default_factory=list)
    timestamp:    float = Field(default_factory=time.time)


# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------

class AgentNotFoundError(KeyError):
    """Raised when an agent name is not found in the registry."""

    def __init__(self, name: str) -> None:
        self.agent_name = name
        super().__init__(
            f"Agent '{name}' not found in registry. "
            "Ensure the agent exists in .agent-status.json and that "
            "initialize() has been called."
        )


class AgentNotProvisionedError(RuntimeError):
    """Raised when get_agent_toolkit() is called for an unprovisioned agent."""

    def __init__(self, name: str) -> None:
        self.agent_name = name
        super().__init__(
            f"Agent '{name}' exists but has no provisioned toolkit. "
            "Call provision_toolkits() before accessing agent toolkits, "
            "or verify the agent is active."
        )


class RegistryNotInitializedError(RuntimeError):
    """Raised when query methods are called before initialize() completes."""

    def __init__(self) -> None:
        super().__init__(
            "AgentRegistryV2 has not been initialized. "
            "Await initialize() before making registry queries."
        )


# ---------------------------------------------------------------------------
# AgentRegistryV2 — the main registry class
# ---------------------------------------------------------------------------

class AgentRegistryV2:
    """
    Authoritative agent registry for Creative Liberation Engine.

    Combines BootSystem's flat-file agent discovery with AgentToolkitFactory's
    live capability injection.  All public methods are async-safe.

    Lifecycle
    ---------
    1. Construct:    registry = AgentRegistryV2(registry_path, event_bus)
    2. Initialize:   await registry.initialize()
    3. Provision:    await registry.provision_toolkits(model_router=..., ...)
    4. Query:        await registry.get_agent("AURORA-7")

    Thread/task safety
    ------------------
    The internal _agents dict is written only during initialize() and
    provision_toolkits().  Once boot is complete both methods are idempotent
    and only append; concurrent reads from query helpers are safe.

    Args:
        registry_path: Path to .agent-status.json.  Defaults to the canonical
                       CORE_FOUNDATION location relative to this file.
        event_bus:     Optional EventBus instance.  If provided, lifecycle
                       events are broadcast to the appropriate channels.
    """

    def __init__(
        self,
        registry_path: Optional[Path] = None,
        event_bus: Optional[Any] = None,
    ) -> None:
        # ── Registry path ────────────────────────────────────────────────────
        if registry_path is None:
            # Default: <repo-root>/CORE_FOUNDATION/agents/.agent-status.json
            # Walk up three levels from this file's location:
            #   agents/ → cle_engine/ → <repo-root>
            base = Path(__file__).resolve().parent.parent.parent
            registry_path = base / "CORE_FOUNDATION" / "agents" / ".agent-status.json"

        self.registry_path: Path = registry_path
        self._event_bus: Optional[Any] = event_bus

        # ── Internal state ───────────────────────────────────────────────────
        # agent_name → AgentRecord
        self._agents: Dict[str, AgentRecord] = {}
        # raw JSON from disk (retained for diagnostic access)
        self._raw_registry: Dict[str, Any] = {}
        # toolkit factory (set during provision_toolkits)
        self._factory: Optional[Any] = None  # AgentToolkitFactory | None

        # ── Lifecycle flags ──────────────────────────────────────────────────
        self._initialized:  bool = False
        self._provisioned:  bool = False

        # ── VERA audit counters ──────────────────────────────────────────────
        self._registry_id: str = str(uuid.uuid4())
        self._init_time: Optional[float] = None

        logger.info(
            "[VERA][agent_registry_v2] AgentRegistryV2 created | "
            f"id={self._registry_id} path={registry_path}"
        )

    # =========================================================================
    # Initialization
    # =========================================================================

    async def initialize(self) -> None:
        """
        Load .agent-status.json and build AgentRecord objects.

        Safe to call multiple times — subsequent calls reload from disk and
        merge new agents while preserving existing toolkit references.

        Emits: ``agent.registry.init`` on the EventBus.

        Raises:
            Nothing — file-not-found and JSON parse errors are logged and
            the registry falls back to an empty state.
        """
        _t0 = time.perf_counter()
        logger.info(
            "[VERA][agent_registry_v2] initialize() | "
            f"id={self._registry_id} path={self.registry_path}"
        )

        raw = self._load_registry_file()
        self._raw_registry = raw
        agents_map: Dict[str, Any] = raw.get("agents", {})

        new_records: Dict[str, AgentRecord] = {}
        hives_found: List[str] = []

        for group_name, group_data in agents_map.items():
            if not isinstance(group_data, dict):
                logger.warning(
                    f"[agent_registry_v2] Skipping non-dict group '{group_name}' "
                    "in registry JSON"
                )
                continue

            if group_name not in hives_found:
                hives_found.append(group_name)

            for agent_name, agent_data in group_data.items():
                if not isinstance(agent_data, dict):
                    logger.warning(
                        f"[agent_registry_v2] Skipping malformed entry "
                        f"'{group_name}.{agent_name}'"
                    )
                    continue

                capabilities = self._resolve_capabilities(group_name)

                record = AgentRecord(
                    name=agent_name,
                    function=agent_data.get("function", "No description"),
                    type=agent_data.get("type", "agent"),
                    mode=agent_data.get("mode", "build"),
                    group=group_name,
                    status=agent_data.get("status", "inactive"),
                    capabilities=capabilities,
                    health="unknown",
                    last_health_check=None,
                )

                # Preserve existing toolkit reference on re-initialization
                existing = self._agents.get(agent_name)
                if existing is not None and existing.toolkit is not None:
                    record.toolkit = existing.toolkit
                    record.health = existing.health
                    record.last_health_check = existing.last_health_check

                new_records[agent_name] = record

                logger.debug(
                    "[agent_registry_v2] Registered agent | "
                    f"name={agent_name} group={group_name} "
                    f"mode={record.mode} status={record.status} "
                    f"caps={len(capabilities)}"
                )

        self._agents = new_records
        self._initialized = True
        self._init_time = time.perf_counter() - _t0

        active_count = sum(1 for r in self._agents.values() if r.is_active)

        logger.info(
            "[VERA][agent_registry_v2] Initialized | "
            f"total={len(self._agents)} active={active_count} "
            f"hives={hives_found} latency_ms={round(self._init_time * 1000, 2)}"
        )

        await self._emit_event(
            channel="agent.registry.init",
            payload=RegistryInitEvent(
                registry_path=str(self.registry_path),
                total_agents=len(self._agents),
                active_agents=active_count,
                hives_found=hives_found,
            ).model_dump(),
        )

    # =========================================================================
    # Toolkit Provisioning
    # =========================================================================

    async def provision_toolkits(
        self,
        *,
        model_router: Optional[Any] = None,
        github_provider: Optional[Any] = None,
        google_provider: Optional[Any] = None,
        scribe_bridge: Optional[Any] = None,
        event_bus: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Create an AgentToolkit for each active agent in the registry.

        Requires AgentToolkitFactory from the agent_provider_bridge module.
        If the bridge is unavailable, logs a warning and returns a summary
        indicating zero provisioned agents.

        Args:
            model_router:    ModelRouter instance for AI capabilities.
            github_provider: GitHubProvider instance for GitHub capabilities.
            google_provider: GoogleProvider instance for Workspace capabilities.
            scribe_bridge:   SCRIBEProviderBridge instance for memory capabilities.
            event_bus:       EventBus override (falls back to self._event_bus).

        Returns:
            Dict with provisioning summary:
            ``{"provisioned": int, "skipped": int, "errors": List[str]}``

        Emits: ``agent.toolkit.provisioned`` for each successfully provisioned agent.
        """
        self._assert_initialized()

        if not _BRIDGE_AVAILABLE or AgentToolkitFactory is None:
            logger.error(
                "[VERA][agent_registry_v2] provision_toolkits() — "
                "AgentToolkitFactory unavailable; skipping all provisioning"
            )
            return {"provisioned": 0, "skipped": len(self._agents), "errors": [
                "AgentToolkitFactory not available — install agent_provider_bridge"
            ]}

        _t0 = time.perf_counter()
        effective_bus = event_bus or self._event_bus

        # Build a single shared factory
        self._factory = AgentToolkitFactory(
            model_router=model_router,
            github=github_provider,
            scribe=scribe_bridge,
            google=google_provider,
            event_bus=effective_bus,
        )

        provisioned = 0
        skipped = 0
        errors: List[str] = []

        for agent_name, record in self._agents.items():
            if not record.is_active:
                skipped += 1
                logger.debug(
                    f"[agent_registry_v2] Skipping inactive agent: {agent_name}"
                )
                continue

            try:
                # Map our AgentCapability set to bridge capabilities
                bridge_caps = self._map_to_bridge_capabilities(record.capabilities)

                toolkit = self._factory.create_toolkit(
                    agent_name=agent_name,
                    hive=record.group,
                    extra_capabilities=bridge_caps if bridge_caps else None,
                    use_cache=True,
                )
                record.toolkit = toolkit
                provisioned += 1

                logger.info(
                    "[VERA][agent_registry_v2] Toolkit provisioned | "
                    f"agent={agent_name} hive={record.group} "
                    f"caps={len(record.capabilities)}"
                )

                await self._emit_event(
                    channel="agent.toolkit.provisioned",
                    payload=ToolkitProvisionedEvent(
                        agent_name=agent_name,
                        hive=record.group,
                        capabilities=[c.value for c in record.capabilities],
                    ).model_dump(),
                )

            except Exception as exc:  # noqa: BLE001
                err_msg = (
                    f"Failed to provision toolkit for '{agent_name}': "
                    f"{type(exc).__name__}: {exc}"
                )
                errors.append(err_msg)
                logger.error(f"[VERA][agent_registry_v2] {err_msg}")

        self._provisioned = provisioned > 0
        latency_ms = round((time.perf_counter() - _t0) * 1000, 2)

        summary = {"provisioned": provisioned, "skipped": skipped, "errors": errors}
        logger.info(
            "[VERA][agent_registry_v2] provision_toolkits() complete | "
            f"provisioned={provisioned} skipped={skipped} "
            f"errors={len(errors)} latency_ms={latency_ms}"
        )
        return summary

    # =========================================================================
    # Query helpers
    # =========================================================================

    async def get_agent(self, name: str) -> Optional[AgentRecord]:
        """
        Return the AgentRecord for *name*, or None if not found.

        Args:
            name: Exact agent name as it appears in .agent-status.json.

        Returns:
            AgentRecord | None
        """
        self._assert_initialized()
        record = self._agents.get(name)
        if record is None:
            logger.debug(
                f"[VERA][agent_registry_v2] get_agent('{name}') — not found"
            )
        return record

    async def get_agents_by_hive(self, hive: str) -> List[AgentRecord]:
        """
        Return all AgentRecords whose group matches *hive* (case-insensitive).

        Args:
            hive: Hive/group name, e.g. ``"hive_aurora"``.

        Returns:
            List of AgentRecord (may be empty).
        """
        self._assert_initialized()
        hive_lower = hive.lower()
        results = [
            r for r in self._agents.values()
            if r.group.lower() == hive_lower
        ]
        logger.debug(
            f"[VERA][agent_registry_v2] get_agents_by_hive('{hive}') → "
            f"{len(results)} agents"
        )
        return results

    async def get_agents_by_mode(self, mode: str) -> List[AgentRecord]:
        """
        Return all AgentRecords operating in *mode* (case-insensitive).

        Args:
            mode: Operational mode — ``"build"``, ``"validate"``, or ``"advisory"``.

        Returns:
            List of AgentRecord (may be empty).
        """
        self._assert_initialized()
        mode_lower = mode.lower()
        results = [
            r for r in self._agents.values()
            if r.mode.lower() == mode_lower
        ]
        logger.debug(
            f"[VERA][agent_registry_v2] get_agents_by_mode('{mode}') → "
            f"{len(results)} agents"
        )
        return results

    async def get_agents_by_capability(
        self, cap: AgentCapability
    ) -> List[AgentRecord]:
        """
        Return all AgentRecords that have *cap* in their capability set.

        Args:
            cap: An AgentCapability enum value.

        Returns:
            List of AgentRecord (may be empty).
        """
        self._assert_initialized()
        results = [
            r for r in self._agents.values()
            if r.has_capability(cap)
        ]
        logger.debug(
            f"[VERA][agent_registry_v2] get_agents_by_capability('{cap.value}') → "
            f"{len(results)} agents"
        )
        return results

    async def get_agent_toolkit(self, name: str) -> Any:
        """
        Return the provisioned AgentToolkit for agent *name*.

        Args:
            name: Exact agent name.

        Returns:
            AgentToolkit instance.

        Raises:
            AgentNotFoundError:      If agent is not in the registry.
            AgentNotProvisionedError: If agent exists but has no toolkit yet.
        """
        self._assert_initialized()
        record = self._agents.get(name)
        if record is None:
            raise AgentNotFoundError(name)
        if record.toolkit is None:
            raise AgentNotProvisionedError(name)

        logger.debug(
            f"[VERA][agent_registry_v2] get_agent_toolkit('{name}') → toolkit"
        )
        return record.toolkit

    async def get_active_agents(self) -> List[AgentRecord]:
        """Return all agents with status == 'active'."""
        self._assert_initialized()
        return [r for r in self._agents.values() if r.is_active]

    async def get_all_agents(self) -> List[AgentRecord]:
        """Return all agents regardless of status."""
        self._assert_initialized()
        return list(self._agents.values())

    # =========================================================================
    # Status mutation helpers
    # =========================================================================

    async def activate_agent(self, name: str) -> AgentRecord:
        """
        Mark an agent as active and emit ``agent.activated``.

        Args:
            name: Agent name.

        Returns:
            Updated AgentRecord.

        Raises:
            AgentNotFoundError: If agent is not in the registry.
        """
        self._assert_initialized()
        record = self._agents.get(name)
        if record is None:
            raise AgentNotFoundError(name)

        if record.status != "active":
            record.status = "active"
            logger.info(
                f"[VERA][agent_registry_v2] Agent activated: {name}"
            )
            await self._emit_event(
                channel="agent.activated",
                payload={"agent_name": name, "group": record.group,
                         "timestamp": time.time()},
            )

        return record

    async def deactivate_agent(self, name: str) -> AgentRecord:
        """
        Mark an agent as inactive and emit ``agent.deactivated``.

        Args:
            name: Agent name.

        Returns:
            Updated AgentRecord.

        Raises:
            AgentNotFoundError: If agent is not in the registry.
        """
        self._assert_initialized()
        record = self._agents.get(name)
        if record is None:
            raise AgentNotFoundError(name)

        if record.status != "inactive":
            record.status = "inactive"
            logger.info(
                f"[VERA][agent_registry_v2] Agent deactivated: {name}"
            )
            await self._emit_event(
                channel="agent.deactivated",
                payload={"agent_name": name, "group": record.group,
                         "timestamp": time.time()},
            )

        return record

    # =========================================================================
    # Health check
    # =========================================================================

    async def health_check(self) -> Dict[str, Any]:
        """
        Perform a lightweight health assessment of the registry and each agent.

        For each active agent the check verifies:
          - Agent record is present and parseable.
          - Toolkit is provisioned (if provision_toolkits() was called).
          - Capability set is non-empty.

        Returns:
            Dict with the following keys:

            .. code-block:: python

                {
                    "registry_id":         str,          # UUID of this registry instance
                    "initialized":         bool,
                    "provisioned":         bool,
                    "registry_path":       str,
                    "total_agents":        int,
                    "active_agents":       int,
                    "provisioned_agents":  int,
                    "hives":               List[str],    # unique hive names
                    "agent_health":        {             # per-agent summary
                        "<agent_name>": {
                            "status":      str,
                            "health":      str,
                            "provisioned": bool,
                            "caps":        int,
                        },
                        ...
                    },
                    "overall_health":      str,          # "healthy" | "degraded" | "unhealthy"
                    "timestamp":           float,
                }
        """
        _t0 = time.perf_counter()

        if not self._initialized:
            return {
                "registry_id":   self._registry_id,
                "initialized":   False,
                "provisioned":   False,
                "registry_path": str(self.registry_path),
                "overall_health": "unhealthy",
                "reason":        "registry not initialized",
                "timestamp":     time.time(),
            }

        total       = len(self._agents)
        active      = [r for r in self._agents.values() if r.is_active]
        provisioned = [r for r in active if r.is_provisioned]
        hives       = list({r.group for r in self._agents.values()})

        agent_health: Dict[str, Any] = {}
        for record in self._agents.values():
            # Update health field on the record
            if record.is_active and record.is_provisioned:
                record.health = "healthy"
            elif record.is_active and not record.is_provisioned:
                record.health = "degraded"
            else:
                record.health = "inactive"
            record.last_health_check = datetime.utcnow()

            agent_health[record.name] = {
                "status":      record.status,
                "health":      record.health,
                "provisioned": record.is_provisioned,
                "caps":        len(record.capabilities),
            }

        # Determine overall health
        if len(active) == 0:
            overall = "unhealthy"
        elif len(provisioned) < len(active):
            overall = "degraded"
        else:
            overall = "healthy"

        latency_ms = round((time.perf_counter() - _t0) * 1000, 2)

        report: Dict[str, Any] = {
            "registry_id":        self._registry_id,
            "initialized":        self._initialized,
            "provisioned":        self._provisioned,
            "registry_path":      str(self.registry_path),
            "total_agents":       total,
            "active_agents":      len(active),
            "provisioned_agents": len(provisioned),
            "hives":              sorted(hives),
            "agent_health":       agent_health,
            "overall_health":     overall,
            "health_check_ms":    latency_ms,
            "timestamp":          time.time(),
        }

        logger.info(
            "[VERA][agent_registry_v2] health_check() | "
            f"overall={overall} total={total} active={len(active)} "
            f"provisioned={len(provisioned)} latency_ms={latency_ms}"
        )
        return report

    # =========================================================================
    # Internal helpers
    # =========================================================================

    def _load_registry_file(self) -> Dict[str, Any]:
        """
        Read and parse .agent-status.json from disk.

        Returns an empty registry skeleton on any read/parse error so the
        registry never hard-fails during boot.
        """
        try:
            with self.registry_path.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
            logger.debug(
                f"[agent_registry_v2] Loaded registry from {self.registry_path} | "
                f"version={data.get('registry_version', 'unknown')} "
                f"declared_total={data.get('total_agents', 'N/A')}"
            )
            return data
        except FileNotFoundError:
            logger.warning(
                f"[agent_registry_v2] Registry file not found: {self.registry_path} — "
                "proceeding with empty registry"
            )
            return {"registry_version": "unknown", "total_agents": 0, "agents": {}}
        except json.JSONDecodeError as exc:
            logger.error(
                f"[agent_registry_v2] JSON parse error in {self.registry_path}: {exc} — "
                "proceeding with empty registry"
            )
            return {"registry_version": "unknown", "total_agents": 0, "agents": {}}
        except OSError as exc:
            logger.error(
                f"[agent_registry_v2] OS error reading {self.registry_path}: {exc}"
            )
            return {"registry_version": "unknown", "total_agents": 0, "agents": {}}

    def _resolve_capabilities(self, group_name: str) -> Set[AgentCapability]:
        """
        Return the AgentCapability set for *group_name*.

        Lookup is case-insensitive.  Falls back to _FALLBACK_CAPABILITIES for
        unrecognized hives and emits a warning.
        """
        lower = group_name.lower().strip()
        caps = HIVE_CAPABILITIES.get(lower)
        if caps is not None:
            return set(caps)  # mutable copy

        # Try stripping common prefixes/suffixes for resilience
        # e.g. "the_advisory" → "advisory"
        for known_hive, known_caps in HIVE_CAPABILITIES.items():
            if lower.endswith(known_hive) or lower.startswith(known_hive):
                logger.debug(
                    f"[agent_registry_v2] Hive '{group_name}' matched via "
                    f"partial key '{known_hive}'"
                )
                return set(known_caps)

        logger.warning(
            f"[agent_registry_v2] Unknown hive '{group_name}' — "
            f"applying fallback capabilities: {[c.value for c in _FALLBACK_CAPABILITIES]}"
        )
        return set(_FALLBACK_CAPABILITIES)

    def _map_to_bridge_capabilities(
        self,
        caps: Set[AgentCapability],
    ) -> Optional[Set[Any]]:
        """
        Translate local AgentCapability values to bridge AgentCapability values.

        Returns None (no extra caps) if the bridge is unavailable or the
        mapping yields an empty set.  The factory will still apply the hive's
        native capability set from _HIVE_CAPABILITIES.
        """
        if not _BRIDGE_AVAILABLE or _BridgeCapability is None:
            return None

        # Mapping table: local enum value → bridge enum value(s)
        _CAP_MAP: Dict[str, List[str]] = {
            AgentCapability.AI_COMPLETE.value:    ["ai_completion"],
            AgentCapability.AI_STREAM.value:      ["ai_streaming"],
            AgentCapability.AI_SEARCH.value:      ["ai_search"],
            AgentCapability.AI_EMBEDDINGS.value:  ["embeddings"],
            AgentCapability.GITHUB_READ.value:    ["github_read"],
            AgentCapability.GITHUB_WRITE.value:   ["github_write"],
            AgentCapability.GOOGLE_DOCS.value:    ["workspace_docs"],
            AgentCapability.GOOGLE_DRIVE.value:   ["workspace_drive"],
            AgentCapability.GOOGLE_CALENDAR.value: ["workspace_calendar"],
            AgentCapability.MEMORY_READ.value:    ["memory_recall"],
            AgentCapability.MEMORY_WRITE.value:   ["memory_store", "memory_consolidate"],
            AgentCapability.EVENT_PUBLISH.value:  ["event_publish"],
            AgentCapability.EVENT_SUBSCRIBE.value: [],   # no direct bridge analog
            AgentCapability.BROWSER.value:        ["browser_navigate", "browser_extract"],
        }

        bridge_caps: Set[Any] = set()
        for local_cap in caps:
            for bridge_val in _CAP_MAP.get(local_cap.value, []):
                try:
                    bridge_caps.add(_BridgeCapability(bridge_val))
                except ValueError:
                    logger.debug(
                        f"[agent_registry_v2] Bridge capability '{bridge_val}' "
                        "not found in AgentCapability enum — skipping"
                    )

        return bridge_caps if bridge_caps else None

    async def _emit_event(
        self,
        channel: str,
        payload: Dict[str, Any],
    ) -> None:
        """
        Emit a structured event to the EventBus (if available).

        Falls back to loguru if the EventBus is not connected.  Never raises —
        event emission failures must not disrupt registry operations.
        """
        if self._event_bus is None or not _EVENT_BUS_AVAILABLE:
            logger.info(
                f"[VERA][agent_registry_v2] EVENT {channel} | "
                f"payload={json.dumps(payload, default=str)[:512]}"
            )
            return

        try:
            if hasattr(self._event_bus, "publish"):
                # EventBus.publish(channel, payload) — async or sync
                result = self._event_bus.publish(channel, payload)
                if asyncio.iscoroutine(result):
                    await result
            elif hasattr(self._event_bus, "emit"):
                result = self._event_bus.emit(channel, payload)
                if asyncio.iscoroutine(result):
                    await result
            else:
                logger.warning(
                    f"[agent_registry_v2] EventBus has no publish/emit method — "
                    f"event '{channel}' dropped"
                )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                f"[VERA][agent_registry_v2] EventBus emit failed for "
                f"channel='{channel}': {exc}"
            )

    def _assert_initialized(self) -> None:
        """Raise RegistryNotInitializedError if initialize() has not been awaited."""
        if not self._initialized:
            raise RegistryNotInitializedError()

    # =========================================================================
    # Properties / dunder helpers
    # =========================================================================

    @property
    def is_initialized(self) -> bool:
        """True if initialize() has completed at least once."""
        return self._initialized

    @property
    def is_provisioned(self) -> bool:
        """True if provision_toolkits() provisioned at least one toolkit."""
        return self._provisioned

    @property
    def agent_count(self) -> int:
        """Total number of agents in the registry (all statuses)."""
        return len(self._agents)

    @property
    def active_agent_count(self) -> int:
        """Number of agents with status == 'active'."""
        return sum(1 for r in self._agents.values() if r.is_active)

    @property
    def factory(self) -> Optional[Any]:
        """Return the underlying AgentToolkitFactory (may be None)."""
        return self._factory

    def __len__(self) -> int:
        return len(self._agents)

    def __contains__(self, name: str) -> bool:
        return name in self._agents

    def __repr__(self) -> str:
        return (
            f"<AgentRegistryV2 "
            f"initialized={self._initialized} "
            f"agents={len(self._agents)} "
            f"provisioned={self._provisioned} "
            f"path={self.registry_path}>"
        )


# ---------------------------------------------------------------------------
# Module-level singleton helpers  (mirrors agent_provider_bridge pattern)
# ---------------------------------------------------------------------------

_default_registry: Optional[AgentRegistryV2] = None


def configure_default_registry(
    registry_path: Optional[Path] = None,
    event_bus: Optional[Any] = None,
) -> AgentRegistryV2:
    """
    Create (or replace) the module-level default AgentRegistryV2.

    Intended for use in engine_os_v3.EngineOS.boot() — call once at startup.

    Args:
        registry_path: Path to .agent-status.json.
        event_bus:     Running EventBus instance.

    Returns:
        AgentRegistryV2 — the new default registry (not yet initialized).
    """
    global _default_registry
    _default_registry = AgentRegistryV2(
        registry_path=registry_path,
        event_bus=event_bus,
    )
    logger.info(
        "[VERA][agent_registry_v2] Default registry configured | "
        f"path={registry_path}"
    )
    return _default_registry


def get_default_registry() -> AgentRegistryV2:
    """
    Return the module-level default AgentRegistryV2.

    Raises:
        RuntimeError: If configure_default_registry() has not been called.
    """
    if _default_registry is None:
        raise RuntimeError(
            "AgentRegistryV2 has not been configured. "
            "Call configure_default_registry() during engine boot."
        )
    return _default_registry


async def get_agent(name: str) -> Optional[AgentRecord]:
    """
    Convenience wrapper: look up an agent by name from the default registry.

    Args:
        name: Agent name.

    Returns:
        AgentRecord | None

    Raises:
        RuntimeError: If the default registry is not configured.
    """
    return await get_default_registry().get_agent(name)


async def get_agent_toolkit(name: str) -> Any:
    """
    Convenience wrapper: get a provisioned toolkit from the default registry.

    Args:
        name: Agent name.

    Returns:
        AgentToolkit

    Raises:
        RuntimeError:             Default registry not configured.
        AgentNotFoundError:       Agent not in registry.
        AgentNotProvisionedError: Agent exists but not provisioned.
    """
    return await get_default_registry().get_agent_toolkit(name)


# ---------------------------------------------------------------------------
# Public exports
# ---------------------------------------------------------------------------

__all__ = [
    # Core class
    "AgentRegistryV2",
    # Enums & models
    "AgentCapability",
    "AgentRecord",
    "RegistryInitEvent",
    "ToolkitProvisionedEvent",
    # Exceptions
    "AgentNotFoundError",
    "AgentNotProvisionedError",
    "RegistryNotInitializedError",
    # Constants
    "HIVE_CAPABILITIES",
    # Singleton helpers
    "configure_default_registry",
    "get_default_registry",
    "get_agent",
    "get_agent_toolkit",
]
