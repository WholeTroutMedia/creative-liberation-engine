"""gRPC inference server for spatial intelligence pipeline.

Wires Utonia encoder, DA3/DepthPro depth estimation, and
Spatial VLM adapter into a production gRPC service.
"""
import argparse
import logging
from concurrent import futures
import threading
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

import grpc
import numpy as np
import torch

from ..config import config
from .utonia_encoder import UtoniaEncoder
from .depth_pipeline import DepthPipeline
from .spatial_vlm_adapter import SpatialVLMAdapter
from .eon_reality_bridge import EONRealityBridge
from . import spatial_pb2
from . import spatial_pb2_grpc

logger = logging.getLogger(__name__)

eon_bridge = EONRealityBridge()

class EONWebhookHandler(BaseHTTPRequestHandler):
    """Minimal HTTP server for EON Reality webhooks (zero extra dependencies)."""
    
    def do_GET(self):
        if self.path == '/eon-reality/status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(eon_bridge.status()).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/eon-reality/ingest':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8')
            try:
                payload = json.loads(post_data)
                sop = payload.get("sop_content", "")
                dry_run = payload.get("dry_run", False)
                
                result = eon_bridge.ingest_sop(sop, dry_run=dry_run)
                
                self.send_response(200)
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        elif self.path == '/eon-reality/ingest-codex':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length).decode('utf-8')
            try:
                payload = json.loads(post_data)
                query = payload.get("query", "")
                dry_run = payload.get("dry_run", False)
                
                result = eon_bridge.ingest_from_codex(query, dry_run=dry_run)
                
                status_code = 400 if "error" in result else 200
                self.send_response(status_code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))


def run_eon_webhook_server(port: int = 5200):
    server = HTTPServer(('0.0.0.0', port), EONWebhookHandler)
    logger.info(f"EON Reality Webhook Server starting on port {port}")
    server.serve_forever()


class SpatialIntelligenceServicer(spatial_pb2_grpc.SpatialIntelligenceServicer):
    """Handles spatial inference requests from Creative Liberation Engine agents."""

    def __init__(self):
        self.device = torch.device(
            config.utonia.device if torch.cuda.is_available() else "cpu"
        )
        self.encoder = None
        self.depth = None
        self.vlm_adapter = None
        self._loaded = False
        logger.info(f"Spatial server initializing on {self.device}")

    def load_models(self):
        """Lazy-load all models into GPU memory."""
        if self._loaded:
            return
        logger.info("Loading Utonia encoder...")
        self.encoder = UtoniaEncoder(device=str(self.device))
        logger.info("Loading depth estimation pipeline...")
        self.depth = DepthPipeline(device=str(self.device))
        logger.info("Loading Spatial VLM adapter...")
        self.vlm_adapter = SpatialVLMAdapter(device=str(self.device))
        self._loaded = True
        logger.info("All models ready.")

    # ── gRPC method implementations ──────────────────────────────

    def EncodePointCloud(self, request, context):
        """Encode a point cloud into Utonia feature space."""
        self.load_models()
        pc = request.point_cloud
        n = pc.num_points
        coords = np.array(pc.coords, dtype=np.float32).reshape(n, 3)
        colors = np.array(pc.colors, dtype=np.float32).reshape(n, 3) if pc.colors else None
        normals = np.array(pc.normals, dtype=np.float32).reshape(n, 3) if pc.normals else None

        result = self.encoder.encode(coords, colors, normals)
        feat = result["feat"]  # (N, C)
        flat_feat = feat.cpu().numpy().flatten().tolist() if torch.is_tensor(feat) else feat.flatten().tolist()

        return spatial_pb2.EncodeResponse(
            features=spatial_pb2.FeatureTensor(
                data=flat_feat,
                num_points=feat.shape[0],
                channels=feat.shape[1],
            ),
            grid_points=result.get("grid_points", 0),
        )

    def EstimateDepth(self, request, context):
        """Estimate depth from an RGB image."""
        self.load_models()
        import io
        from PIL import Image

        image = Image.open(io.BytesIO(request.image_data)).convert("RGB")
        if request.width and request.height:
            image = image.resize((request.width, request.height))

        result = self.depth.estimate(image, method=request.method or "da3")
        depth_map = result["depth_map"]
        flat_depth = depth_map.flatten().tolist()

        resp = spatial_pb2.DepthResponse(
            depth_map=flat_depth,
            width=depth_map.shape[1],
            height=depth_map.shape[0],
        )
        if "confidence" in result and request.return_confidence:
            resp.confidence.extend(result["confidence"].flatten().tolist())
        if "focal_length" in result:
            resp.focal_length = result["focal_length"]
        if "field_of_view" in result:
            resp.field_of_view = result["field_of_view"]
        return resp

    def QueryScene(self, request, context):
        """Answer spatial queries about a 3D scene."""
        self.load_models()
        scene = request.scene
        n = scene.num_points
        coords = np.array(scene.coords, dtype=np.float32).reshape(n, 3)
        colors = np.array(scene.colors, dtype=np.float32).reshape(n, 3) if scene.colors else None

        features = self.encoder.encode(coords, colors)
        spatial_tokens = self.vlm_adapter.encode_scene(
            features["feat"],
            torch.from_numpy(coords).float(),
        )
        result = self.vlm_adapter.build_spatial_prompt(spatial_tokens, request.query)

        resp = spatial_pb2.SpatialQueryResponse(answer=result.get("answer", ""))
        for region in result.get("regions", []):
            resp.regions.append(spatial_pb2.Region(
                label=region.get("label", ""),
                bbox_min=region.get("bbox_min", []),
                bbox_max=region.get("bbox_max", []),
                confidence=region.get("confidence", 0.0),
            ))
        return resp

    def BuildSceneGraph(self, request, context):
        """Build a scene graph from a point cloud."""
        self.load_models()
        scene = request.scene
        n = scene.num_points
        coords = np.array(scene.coords, dtype=np.float32).reshape(n, 3)
        colors = np.array(scene.colors, dtype=np.float32).reshape(n, 3) if scene.colors else None

        features = self.encoder.encode(coords, colors)
        spatial_tokens = self.vlm_adapter.encode_scene(
            features["feat"],
            torch.from_numpy(coords).float(),
        )
        graph_data = self.vlm_adapter.build_scene_graph(
            spatial_tokens, include_relationships=request.include_relationships
        )

        graph = spatial_pb2.SceneGraph()
        for node_data in graph_data.get("nodes", []):
            graph.nodes.append(spatial_pb2.SceneNode(
                id=node_data.get("id", 0),
                label=node_data.get("label", ""),
                centroid=node_data.get("centroid", []),
                bbox_min=node_data.get("bbox_min", []),
                bbox_max=node_data.get("bbox_max", []),
                confidence=node_data.get("confidence", 0.0),
            ))
        for edge_data in graph_data.get("edges", []):
            graph.edges.append(spatial_pb2.SceneEdge(
                source_id=edge_data.get("source_id", 0),
                target_id=edge_data.get("target_id", 0),
                relationship=edge_data.get("relationship", ""),
                confidence=edge_data.get("confidence", 0.0),
            ))
        return graph

    def StreamEncode(self, request_iterator, context):
        """Streaming encode for large point clouds."""
        self.load_models()
        for request in request_iterator:
            yield self.EncodePointCloud(request, context)


def serve(port: int = None):
    """Start the gRPC spatial intelligence server."""
    port = port or config.server.port
    servicer = SpatialIntelligenceServicer()
    # Pre-load models on startup
    servicer.load_models()
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=config.server.max_workers)
    )
    spatial_pb2_grpc.add_SpatialIntelligenceServicer_to_server(servicer, server)
    server.add_insecure_port(f"{config.server.host}:{port}")
    
    # Start EON Webhook server on port 5200 in background
    webhook_thread = threading.Thread(target=run_eon_webhook_server, args=(5200,), daemon=True)
    webhook_thread.start()
    
    logger.info(f"Spatial Intelligence server starting on port {port}")
    server.start()
    logger.info("Server ready. Waiting for requests...")
    server.wait_for_termination()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description="Spatial Intelligence gRPC Server")
    parser.add_argument("--port", type=int, default=50051)
    args = parser.parse_args()
    serve(port=args.port)
