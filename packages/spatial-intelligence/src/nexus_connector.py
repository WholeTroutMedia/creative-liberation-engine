"""NEXUS Agent Bus connector for Spatial Intelligence service.

Bridges the gRPC spatial server to the Creative Liberation Engine's
WebSocket-based NEXUS agent communication bus, enabling
other agents to request spatial reasoning capabilities.
"""
import asyncio
import json
import logging
import os
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

NEXUS_HOST = os.getenv("NEXUS_HOST", "localhost")
NEXUS_PORT = int(os.getenv("NEXUS_PORT", "8765"))
AGENT_ID = os.getenv("AGENT_ID", "spatial-intelligence")
RECONNECT_DELAY = 5


class NexusConnector:
    """Async WebSocket client that registers with NEXUS and
    translates agent requests into gRPC calls on the local
    SpatialIntelligenceServicer.
    """

    CAPABILITIES = [
        "encode_point_cloud",
        "estimate_depth",
        "query_scene",
        "build_scene_graph",
        "stream_encode",
    ]

    def __init__(self, servicer, agent_id: str = AGENT_ID):
        self.servicer = servicer
        self.agent_id = agent_id
        self.ws: Optional[object] = None
        self._running = False

    async def connect(self):
        """Connect to NEXUS bus and register capabilities."""
        import websockets

        uri = f"ws://{NEXUS_HOST}:{NEXUS_PORT}/agents"
        logger.info(f"Connecting to NEXUS at {uri}...")

        while self._running:
            try:
                async with websockets.connect(uri) as ws:
                    self.ws = ws
                    await self._register()
                    await self._listen()
            except Exception as e:
                logger.warning(f"NEXUS connection lost: {e}. Reconnecting in {RECONNECT_DELAY}s...")
                await asyncio.sleep(RECONNECT_DELAY)

    async def _register(self):
        """Send registration message to NEXUS."""
        msg = {
            "type": "agent.register",
            "agent_id": self.agent_id,
            "capabilities": self.CAPABILITIES,
            "protocol": "spatial-intelligence/v1",
            "metadata": {
                "grpc_port": 50051,
                "models": ["utonia-ptv3", "da3", "depthpro", "spatial-vlm"],
            },
        }
        await self.ws.send(json.dumps(msg))
        logger.info(f"Registered as '{self.agent_id}' with {len(self.CAPABILITIES)} capabilities")

    async def _listen(self):
        """Listen for incoming requests from other agents."""
        async for raw in self.ws:
            try:
                msg = json.loads(raw)
                if msg.get("type") == "agent.request":
                    response = await self._handle_request(msg)
                    await self.ws.send(json.dumps(response))
                elif msg.get("type") == "agent.ping":
                    await self.ws.send(json.dumps({
                        "type": "agent.pong",
                        "agent_id": self.agent_id,
                    }))
            except Exception as e:
                logger.error(f"Error handling message: {e}")

    async def _handle_request(self, msg: dict) -> dict:
        """Dispatch an incoming request to the appropriate servicer method."""
        action = msg.get("action")
        payload = msg.get("payload", {})
        request_id = msg.get("request_id")

        try:
            if action == "encode_point_cloud":
                result = await self._encode(payload)
            elif action == "estimate_depth":
                result = await self._depth(payload)
            elif action == "query_scene":
                result = await self._query(payload)
            elif action == "build_scene_graph":
                result = await self._scene_graph(payload)
            else:
                return self._error_response(request_id, f"Unknown action: {action}")

            return {
                "type": "agent.response",
                "request_id": request_id,
                "agent_id": self.agent_id,
                "status": "success",
                "result": result,
            }
        except Exception as e:
            logger.error(f"Request {request_id} failed: {e}")
            return self._error_response(request_id, str(e))

    async def _encode(self, payload: dict) -> dict:
        """Handle encode_point_cloud via servicer."""
        coords = np.array(payload["coords"], dtype=np.float32).reshape(-1, 3)
        colors = np.array(payload.get("colors"), dtype=np.float32).reshape(-1, 3) if payload.get("colors") else None
        result = self.servicer.encoder.encode(coords, colors)
        feat = result["feat"]
        return {
            "num_points": int(feat.shape[0]),
            "channels": int(feat.shape[1]),
            "features_shape": list(feat.shape),
        }

    async def _depth(self, payload: dict) -> dict:
        """Handle estimate_depth via servicer."""
        import base64
        import io
        from PIL import Image

        image_b64 = payload["image_b64"]
        image = Image.open(io.BytesIO(base64.b64decode(image_b64))).convert("RGB")
        method = payload.get("method", "da3")
        result = self.servicer.depth.estimate(image, method=method)
        return {
            "width": int(result["depth_map"].shape[1]),
            "height": int(result["depth_map"].shape[0]),
            "depth_range": [float(result["depth_map"].min()), float(result["depth_map"].max())],
        }

    async def _query(self, payload: dict) -> dict:
        """Handle query_scene via servicer."""
        import torch
        coords = np.array(payload["coords"], dtype=np.float32).reshape(-1, 3)
        colors = np.array(payload.get("colors"), dtype=np.float32).reshape(-1, 3) if payload.get("colors") else None
        features = self.servicer.encoder.encode(coords, colors)
        spatial_tokens = self.servicer.vlm_adapter.encode_scene(
            features["feat"], torch.from_numpy(coords).float()
        )
        result = self.servicer.vlm_adapter.build_spatial_prompt(
            spatial_tokens, payload["query"]
        )
        return result

    async def _scene_graph(self, payload: dict) -> dict:
        """Handle build_scene_graph via servicer."""
        import torch
        coords = np.array(payload["coords"], dtype=np.float32).reshape(-1, 3)
        colors = np.array(payload.get("colors"), dtype=np.float32).reshape(-1, 3) if payload.get("colors") else None
        features = self.servicer.encoder.encode(coords, colors)
        spatial_tokens = self.servicer.vlm_adapter.encode_scene(
            features["feat"], torch.from_numpy(coords).float()
        )
        return self.servicer.vlm_adapter.build_scene_graph(
            spatial_tokens, include_relationships=payload.get("include_relationships", True)
        )

    def _error_response(self, request_id, error_msg):
        return {
            "type": "agent.response",
            "request_id": request_id,
            "agent_id": self.agent_id,
            "status": "error",
            "error": error_msg,
        }

    async def start(self):
        """Start the NEXUS connector."""
        self._running = True
        await self.connect()

    async def stop(self):
        """Gracefully disconnect."""
        self._running = False
        if self.ws:
            await self.ws.close()
            logger.info("Disconnected from NEXUS")
