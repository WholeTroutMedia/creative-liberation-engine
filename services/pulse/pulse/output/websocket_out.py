"""
PULSE — WebSocket Output

Broadcasts biometric signals via WebSocket for web-based tools,
NEXUS Canvas, and custom dashboards. Supports multiple concurrent clients.
"""

import asyncio
import json
import logging
import time
from typing import Set, Optional

import websockets
from websockets.server import WebSocketServerProtocol

logger = logging.getLogger("pulse.output.websocket")


class WebSocketOutput:
    """
    WebSocket server broadcasting vital signs to all connected clients.
    Designed for NEXUS Canvas, dashboards, and web-based creative tools.
    """

    def __init__(self, config: dict):
        self.enabled = config.get("enabled", True)
        self.host = config.get("host", "0.0.0.0")
        self.port = config.get("port", 8765)
        self.broadcast_interval_ms = config.get("broadcast_interval_ms", 100)

        self._clients: Set[WebSocketServerProtocol] = set()
        self._server = None
        self._latest_vitals: Optional[dict] = None
        self._running = False

    async def start(self):
        """Start the WebSocket server."""
        if not self.enabled:
            return

        self._running = True
        self._server = await websockets.serve(
            self._handle_client,
            self.host,
            self.port,
            ping_interval=20,
            ping_timeout=10,
        )
        logger.info(f"WebSocket server started → ws://{self.host}:{self.port}")

    async def _handle_client(self, ws: WebSocketServerProtocol):
        """Handle a new WebSocket connection."""
        self._clients.add(ws)
        client_addr = ws.remote_address
        logger.info(f"WebSocket client connected: {client_addr} ({len(self._clients)} total)")

        try:
            # Send initial state if available
            if self._latest_vitals:
                await ws.send(json.dumps({
                    "type": "vitals",
                    "data": self._latest_vitals,
                }))

            # Keep connection alive, handle incoming messages
            async for message in ws:
                try:
                    data = json.loads(message)
                    # Handle client commands (e.g., subscribe to specific signals)
                    if data.get("type") == "ping":
                        await ws.send(json.dumps({"type": "pong", "ts": time.time()}))
                except json.JSONDecodeError:
                    pass
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self._clients.discard(ws)
            logger.info(f"WebSocket client disconnected: {client_addr} ({len(self._clients)} remaining)")

    async def send(self, vitals: dict):
        """
        Broadcast vital signs to all connected WebSocket clients.

        Args:
            vitals: dict from VitalSigns.to_dict()
        """
        if not self.enabled or not self._clients:
            return

        self._latest_vitals = vitals

        message = json.dumps({
            "type": "vitals",
            "data": vitals,
            "ts": time.time(),
        })

        # Broadcast to all connected clients
        disconnected = set()
        for client in self._clients.copy():
            try:
                await client.send(message)
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)
            except Exception as e:
                logger.debug(f"WebSocket send error: {e}")
                disconnected.add(client)

        # Clean up disconnected clients
        self._clients -= disconnected

    async def send_raw_bvp(self, bvp_sample: float):
        """Send a single raw BVP sample (high frequency stream)."""
        if not self.enabled or not self._clients:
            return

        message = json.dumps({
            "type": "bvp",
            "value": round(bvp_sample, 4),
            "ts": time.time(),
        })

        for client in self._clients.copy():
            try:
                await client.send(message)
            except Exception:
                pass

    @property
    def client_count(self) -> int:
        return len(self._clients)

    async def close(self):
        """Shut down the WebSocket server."""
        self._running = False
        if self._server:
            self._server.close()
            await self._server.wait_closed()
        # Close all client connections
        for client in self._clients.copy():
            try:
                await client.close()
            except Exception:
                pass
        self._clients.clear()
        logger.info("WebSocket server closed")
