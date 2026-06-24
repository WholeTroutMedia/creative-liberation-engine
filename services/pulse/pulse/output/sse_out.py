"""
PULSE — SSE Output (Server-Sent Events)

Broadcasts biometric signals via SSE for integration with the
Creative Liberation Engine telemetry bus (port 5160) and Mission Control.
Also serves the real-time dashboard as static files.
"""

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Set, Optional

from aiohttp import web
from aiohttp_sse import sse_response

logger = logging.getLogger("pulse.output.sse")


class SSEOutput:
    """
    HTTP server providing:
    1. SSE stream at /events for telemetry integration
    2. JSON endpoint at /api/vitals for polling
    3. Static dashboard at /dashboard
    4. Health check at /health
    """

    def __init__(self, config: dict, dashboard_config: dict = None):
        self.enabled = config.get("enabled", True)
        self.host = config.get("host", "0.0.0.0")
        self.port = config.get("port", 8766)
        self.event_type = config.get("event_type", "pulse-biometric")

        # Dashboard config
        dashboard_config = dashboard_config or {}
        self.dashboard_enabled = dashboard_config.get("enabled", True)
        self.dashboard_dir = dashboard_config.get(
            "static_dir", str(Path(__file__).parent.parent / "dashboard")
        )

        self._app: Optional[web.Application] = None
        self._runner: Optional[web.AppRunner] = None
        self._latest_vitals: Optional[dict] = None
        self._sse_queues: Set[asyncio.Queue] = set()
        self._start_time = time.time()

    async def start(self):
        """Start the HTTP/SSE server."""
        if not self.enabled:
            return

        self._app = web.Application()
        self._app.router.add_get("/events", self._handle_sse)
        self._app.router.add_get("/api/vitals", self._handle_vitals_api)
        self._app.router.add_get("/health", self._handle_health)

        # Serve dashboard static files
        if self.dashboard_enabled:
            dashboard_path = Path(self.dashboard_dir)
            if dashboard_path.exists():
                self._app.router.add_static("/dashboard", dashboard_path)
                self._app.router.add_get("/", self._redirect_dashboard)
                logger.info(f"Dashboard served at /dashboard from {dashboard_path}")
            else:
                logger.warning(f"Dashboard directory not found: {dashboard_path}")

        self._runner = web.AppRunner(self._app)
        await self._runner.setup()
        site = web.TCPSite(self._runner, self.host, self.port)
        await site.start()

        logger.info(
            f"SSE/HTTP server started → http://{self.host}:{self.port} "
            f"(SSE: /events, API: /api/vitals, Dashboard: /dashboard)"
        )

    async def _redirect_dashboard(self, request: web.Request) -> web.Response:
        """Redirect root to dashboard."""
        raise web.HTTPFound("/dashboard/index.html")

    async def _handle_sse(self, request: web.Request) -> web.StreamResponse:
        """Handle SSE client connection."""
        queue = asyncio.Queue(maxsize=100)
        self._sse_queues.add(queue)

        logger.info(f"SSE client connected ({len(self._sse_queues)} total)")

        try:
            async with sse_response(request) as resp:
                # Send initial state
                if self._latest_vitals:
                    await resp.send(
                        json.dumps(self._latest_vitals),
                        event=self.event_type,
                    )

                while True:
                    data = await queue.get()
                    if data is None:
                        break
                    await resp.send(data, event=self.event_type)
        finally:
            self._sse_queues.discard(queue)
            logger.info(f"SSE client disconnected ({len(self._sse_queues)} remaining)")

        return resp

    async def _handle_vitals_api(self, request: web.Request) -> web.Response:
        """JSON endpoint for polling current vitals."""
        if self._latest_vitals is None:
            return web.json_response(
                {"status": "waiting", "message": "No biometric data yet"},
                status=202,
            )
        return web.json_response({
            "status": "active",
            "vitals": self._latest_vitals,
            "uptime_seconds": round(time.time() - self._start_time, 1),
            "sse_clients": len(self._sse_queues),
        })

    async def _handle_health(self, request: web.Request) -> web.Response:
        """Health check endpoint."""
        return web.json_response({
            "service": "pulse",
            "status": "healthy",
            "uptime_seconds": round(time.time() - self._start_time, 1),
            "sse_clients": len(self._sse_queues),
            "has_data": self._latest_vitals is not None,
        })

    async def send(self, vitals: dict):
        """
        Broadcast vital signs to all SSE clients.

        Args:
            vitals: dict from VitalSigns.to_dict()
        """
        if not self.enabled:
            return

        self._latest_vitals = vitals
        message = json.dumps(vitals)

        dead_queues = set()
        for queue in self._sse_queues.copy():
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                dead_queues.add(queue)

        self._sse_queues -= dead_queues

    @property
    def client_count(self) -> int:
        return len(self._sse_queues)

    async def close(self):
        """Shut down the HTTP server."""
        # Signal all SSE clients to disconnect
        for queue in self._sse_queues:
            try:
                queue.put_nowait(None)
            except asyncio.QueueFull:
                pass
        self._sse_queues.clear()

        if self._runner:
            await self._runner.cleanup()
        logger.info("SSE/HTTP server closed")
