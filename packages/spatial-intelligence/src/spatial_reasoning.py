"""Spatial reasoning — scene graph construction and natural language queries."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
import numpy as np


@dataclass
class BBox3D:
    center: np.ndarray   # (3,)
    extents: np.ndarray  # (3,) half-widths

    def contains(self, point: np.ndarray) -> bool:
        return bool(np.all(np.abs(point - self.center) <= self.extents))

    def volume(self) -> float:
        return float(np.prod(self.extents * 2))


@dataclass
class SceneNode:
    label: str
    bbox: BBox3D
    confidence: float = 1.0
    feature_centroid: Optional[np.ndarray] = None  # (D,) mean Utonia feature
    point_indices: List[int] = field(default_factory=list)


class SceneGraph:
    """Lightweight scene graph built from Utonia features + point cloud."""

    def __init__(self):
        self.nodes: List[SceneNode] = []
        self._points: Optional[np.ndarray] = None
        self._features: Optional[np.ndarray] = None

    # ------------------------------------------------------------------
    def build_from_features(
        self,
        points: np.ndarray,
        features: np.ndarray,
        n_clusters: int = 16,
    ) -> "SceneGraph":
        """Cluster Utonia features into scene nodes via k-means.

        Args:
            points:   (N, 3+) float32 point cloud
            features: (N, D) Utonia feature array
            n_clusters: number of object regions to discover

        Returns:
            self (for chaining)
        """
        self._points = points
        self._features = features
        self.nodes = []

        try:
            from sklearn.cluster import MiniBatchKMeans
            km = MiniBatchKMeans(n_clusters=min(n_clusters, len(points)),
                                 random_state=42, n_init=3)
            labels = km.fit_predict(features)
        except ImportError:
            # Fallback: random assignment
            labels = np.random.randint(0, n_clusters, size=len(points))

        for cid in range(n_clusters):
            idx = np.where(labels == cid)[0]
            if len(idx) == 0:
                continue
            cluster_pts = points[idx, :3]
            center = cluster_pts.mean(axis=0)
            extents = (cluster_pts.max(axis=0) - cluster_pts.min(axis=0)) / 2.0
            extents = np.maximum(extents, 0.01)  # min 1cm
            feat_centroid = features[idx].mean(axis=0)
            node = SceneNode(
                label=f"region_{cid}",
                bbox=BBox3D(center=center, extents=extents),
                feature_centroid=feat_centroid,
                point_indices=idx.tolist(),
            )
            self.nodes.append(node)
        return self

    # ------------------------------------------------------------------
    def query_direction(
        self, reference_label: str, direction: str
    ) -> List[SceneNode]:
        """Find nodes in a cardinal direction relative to a reference node.

        direction: 'left' | 'right' | 'above' | 'below' | 'front' | 'behind'
        """
        ref = next((n for n in self.nodes if n.label == reference_label), None)
        if ref is None:
            return []
        rc = ref.bbox.center
        axis_map = {
            "left":   (0, -1), "right":  (0,  1),
            "above":  (1,  1), "below":  (1, -1),
            "front":  (2, -1), "behind": (2,  1),
        }
        axis, sign = axis_map.get(direction, (0, 1))
        return [
            n for n in self.nodes
            if n.label != reference_label
            and sign * (n.bbox.center[axis] - rc[axis]) > 0
        ]

    # ------------------------------------------------------------------
    def nearest_to_point(
        self, point: np.ndarray, k: int = 3
    ) -> List[Tuple[float, SceneNode]]:
        """Return k scene nodes closest to a 3D query point."""
        scored = [
            (float(np.linalg.norm(n.bbox.center - point)), n)
            for n in self.nodes
        ]
        scored.sort(key=lambda x: x[0])
        return scored[:k]

    # ------------------------------------------------------------------
    def estimate_distances(
        self, anchor_label: str
    ) -> Dict[str, float]:
        """Return distance in metres from anchor node to all other nodes."""
        anchor = next((n for n in self.nodes if n.label == anchor_label), None)
        if anchor is None:
            return {}
        return {
            n.label: float(np.linalg.norm(n.bbox.center - anchor.bbox.center))
            for n in self.nodes if n.label != anchor_label
        }

    # ------------------------------------------------------------------
    def to_dict(self) -> dict:
        """Serialise to plain dict for JSON transport."""
        return {
            "nodes": [
                {
                    "label": n.label,
                    "center": n.bbox.center.tolist(),
                    "extents": n.bbox.extents.tolist(),
                    "confidence": n.confidence,
                }
                for n in self.nodes
            ]
        }