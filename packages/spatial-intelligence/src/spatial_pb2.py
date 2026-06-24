"""Proto-generated stubs for cle.spatial gRPC service.

This file is a development placeholder. In production, the Docker build
runs `grpc_tools.protoc` against proto/spatial.proto to generate the
real serialization code. This stub allows imports to resolve for linting,
testing, and IDE support outside the container.
"""
# AUTO-GENERATED PLACEHOLDER — real file produced by:
#   python -m grpc_tools.protoc -I proto --python_out=src --grpc_python_out=src proto/spatial.proto
#
# Message classes defined in spatial.proto:
#   PointCloud, FeatureTensor, DepthRequest, DepthResponse,
#   EncodeRequest, EncodeResponse, SpatialQuery, SpatialQueryResponse,
#   Region, SceneGraphRequest, SceneGraph, SceneNode, SceneEdge

from __future__ import annotations


class _Stub:
    """Placeholder for proto-generated message classes."""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    def SerializeToString(self) -> bytes:
        raise NotImplementedError("Use Docker build to generate real proto stubs")

    @classmethod
    def FromString(cls, s: bytes):
        raise NotImplementedError("Use Docker build to generate real proto stubs")


# Message stubs
PointCloud = type("PointCloud", (_Stub,), {})
FeatureTensor = type("FeatureTensor", (_Stub,), {})
DepthRequest = type("DepthRequest", (_Stub,), {})
DepthResponse = type("DepthResponse", (_Stub,), {})
EncodeRequest = type("EncodeRequest", (_Stub,), {})
EncodeResponse = type("EncodeResponse", (_Stub,), {})
SpatialQuery = type("SpatialQuery", (_Stub,), {})
SpatialQueryResponse = type("SpatialQueryResponse", (_Stub,), {})
Region = type("Region", (_Stub,), {})
SceneGraphRequest = type("SceneGraphRequest", (_Stub,), {})
SceneGraph = type("SceneGraph", (_Stub,), {})
SceneNode = type("SceneNode", (_Stub,), {})
SceneEdge = type("SceneEdge", (_Stub,), {})

DESCRIPTOR = None  # protobuf descriptor placeholder
