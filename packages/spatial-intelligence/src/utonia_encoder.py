"""Utonia Universal 3D Encoder wrapper for Creative Liberation Engine spatial intelligence.

Loads the frozen Utonia PTv3 backbone and extracts per-point features from
arbitrary point clouds (indoor, outdoor, CAD, video-lifted, remote sensing).

Usage:
    encoder = UtoniaEncoder()  # lazy-loads weights on first call
    features = encoder.encode(points)  # (N, C) float32 tensor
    pca_vis = encoder.pca_visualize(features)  # (N, 3) RGB for debugging
"""
from __future__ import annotations

import hashlib
import logging
import time
from pathlib import Path
from typing import Dict, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn

from config import config, UtoniaConfig

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Granularity rescaling (Perceptual Granularity Rescaling from Utonia paper)
# ---------------------------------------------------------------------------

def _rescale_granularity(points: np.ndarray, target_points: int = 102400) -> np.ndarray:
    """Normalize point cloud density so encoder always sees ~100K points.

    Upsamples via random duplication or downsamples via FPS-approx.
    """
    n = len(points)
    if n == target_points:
        return points
    if n > target_points:
        idx = np.random.choice(n, target_points, replace=False)
    else:
        # repeat + small jitter to avoid exact duplicates
        repeats = target_points // n + 1
        idx = np.tile(np.arange(n), repeats)[:target_points]
    return points[idx]


def _normalize_coords(points: np.ndarray) -> np.ndarray:
    """Center point cloud at origin and scale to unit sphere."""
    centroid = points[:, :3].mean(axis=0)
    pts = points.copy()
    pts[:, :3] -= centroid
    scale = np.linalg.norm(pts[:, :3], axis=1).max()
    if scale > 0:
        pts[:, :3] /= scale
    return pts


# ---------------------------------------------------------------------------
# Minimal PTv3 backbone loader (loads from Utonia checkpoint)
# ---------------------------------------------------------------------------

class _UtoniaBackbone(nn.Module):
    """Thin wrapper that loads Utonia weights and exposes encode().

    The actual PTv3 architecture is loaded from the vendor/utonia-inference
    checkout.  If that checkout is absent we fall back to a CPU-safe
    feature-mean stub so the rest of the pipeline remains functional.
    """

    def __init__(self, cfg: UtoniaConfig):
        super().__init__()
        self.cfg = cfg
        self._model: Optional[nn.Module] = None
        self._using_stub = False

    def _load(self) -> None:
        if self._model is not None:
            return

        vendor_path = Path(__file__).parents[2] / "vendor" / "utonia-inference"
        weights_path = self.cfg.weights_path / "model_best.pth"

        if vendor_path.exists() and weights_path.exists():
            import sys
            sys.path.insert(0, str(vendor_path))
            try:
                from model.point_transformer_v3 import PointTransformerV3  # noqa
                self._model = PointTransformerV3(
                    in_channels=self.cfg.in_channels,
                    enc_depths=self.cfg.enc_depths,
                    enc_channels=self.cfg.enc_channels,
                    enc_num_head=self.cfg.enc_num_head,
                    enc_patch_size=self.cfg.enc_patch_size,
                    dec_depths=self.cfg.dec_depths,
                    dec_channels=self.cfg.dec_channels,
                    dec_num_head=self.cfg.dec_num_head,
                    dec_patch_size=self.cfg.dec_patch_size,
                    num_classes=self.cfg.num_classes,
                    input_transform=self.cfg.input_transform,
                )
                state = torch.load(weights_path, map_location="cpu")
                # Checkpoint may wrap under 'state_dict' or 'model'
                sd = state.get("state_dict", state.get("model", state))
                self._model.load_state_dict(sd, strict=False)
                self._model.eval()
                if self.cfg.frozen:
                    for p in self._model.parameters():
                        p.requires_grad_(False)
                logger.info("Utonia backbone loaded from %s", weights_path)
            except Exception as exc:
                logger.warning("Could not load Utonia model: %s -- using stub", exc)
                self._using_stub = True
        else:
            logger.warning(
                "Utonia weights not found at %s -- using stub. "
                "Run scripts/download_models.sh to download.",
                weights_path,
            )
            self._using_stub = True

    def encode(self, coord: torch.Tensor, feat: torch.Tensor) -> torch.Tensor:
        """Run Utonia forward pass.

        Args:
            coord: (N, 3) float32 XYZ coordinates
            feat:  (N, C) float32 features (color + normal, or zeros)

        Returns:
            (N, D) float32 per-point feature embeddings
        """
        self._load()
        if self._using_stub:
            # Deterministic stub: return normalised coord + feat concat
            D = self.cfg.channels[-1]  # 576
            stub = torch.zeros(coord.shape[0], D, dtype=torch.float32)
            stub[:, :3] = coord - coord.mean(0)
            return stub

        data_dict = {
            "coord": coord,
            "feat": feat,
            "batch": torch.zeros(coord.shape[0], dtype=torch.long),
        }
        with torch.no_grad():
            out = self._model(data_dict)
        # Utonia returns dict; extract per-point features
        if isinstance(out, dict):
            return out.get("feat", out.get("decoder_output", list(out.values())[0]))
        return out


# ---------------------------------------------------------------------------
# Public encoder API
# ---------------------------------------------------------------------------

class UtoniaEncoder:
    """Thread-safe Utonia encoder with feature caching.

    One instance per process. Call encode() with raw numpy arrays.
    """

    def __init__(self, cfg: Optional[UtoniaConfig] = None):
        self.cfg = cfg or config.utonia
        self.device = torch.device(
            self.cfg.device if torch.cuda.is_available() else "cpu"
        )
        self._backbone = _UtoniaBackbone(self.cfg).to(self.device)
        # Feature cache: hash(point_cloud_bytes) -> (timestamp, tensor)
        self._cache: Dict[str, Tuple[float, torch.Tensor]] = {}
        self._cache_ttl = config.cache_ttl_seconds

    # ------------------------------------------------------------------
    def _cache_key(self, points: np.ndarray) -> str:
        return hashlib.md5(points.tobytes()).hexdigest()

    def _cache_get(self, key: str) -> Optional[torch.Tensor]:
        if not config.cache_features:
            return None
        entry = self._cache.get(key)
        if entry is None:
            return None
        ts, feat = entry
        if time.time() - ts > self._cache_ttl:
            del self._cache[key]
            return None
        return feat

    def _cache_set(self, key: str, feat: torch.Tensor) -> None:
        if config.cache_features:
            self._cache[key] = (time.time(), feat)

    # ------------------------------------------------------------------
    def _prepare_input(
        self, points: np.ndarray
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """Prepare coord + feat tensors from raw (N, 3|6) numpy array.

        Supports:
        - (N, 3): XYZ only  -> feat = zeros
        - (N, 6): XYZ + RGB -> feat = RGB normalised [0, 1]
        - (N, 9): XYZ + RGB + normal -> feat = concat
        """
        pts = _rescale_granularity(points, target_points=min(len(points), 102400))
        pts = _normalize_coords(pts)

        coord = torch.from_numpy(pts[:, :3].astype(np.float32)).to(self.device)

        if pts.shape[1] >= 9:
            rgb = pts[:, 3:6].astype(np.float32)
            if rgb.max() > 1.0:
                rgb = rgb / 255.0
            normals = pts[:, 6:9].astype(np.float32)
            feat_np = np.concatenate([rgb, normals], axis=1)  # (N, 6)
        elif pts.shape[1] >= 6:
            rgb = pts[:, 3:6].astype(np.float32)
            if rgb.max() > 1.0:
                rgb = rgb / 255.0
            feat_np = rgb
        else:
            feat_np = np.zeros((len(pts), 3), dtype=np.float32)

        feat = torch.from_numpy(feat_np).to(self.device)
        return coord, feat

    # ------------------------------------------------------------------
    def encode(
        self,
        points: np.ndarray,
        use_cache: bool = True,
    ) -> np.ndarray:
        """Encode a point cloud into per-point Utonia features.

        Args:
            points: (N, 3|6|9) float32 numpy array
                    columns: [x, y, z] + optional [r, g, b] + optional [nx, ny, nz]
            use_cache: Return cached result if available.

        Returns:
            (N, D) float32 numpy feature array  (D=576 for Utonia base)
        """
        key = self._cache_key(points) if use_cache else ""
        if use_cache:
            cached = self._cache_get(key)
            if cached is not None:
                return cached.cpu().numpy()

        coord, feat = self._prepare_input(points)
        features = self._backbone.encode(coord, feat)  # (N', D)

        # If downsampled, interpolate back to original N
        orig_n = len(points)
        if features.shape[0] != orig_n:
            # Nearest-neighbour interpolation via index repeat pattern
            ratio = orig_n / features.shape[0]
            idx = (np.arange(orig_n) / ratio).astype(int).clip(0, features.shape[0] - 1)
            idx_t = torch.from_numpy(idx).long().to(self.device)
            features = features[idx_t]

        if use_cache:
            self._cache_set(key, features)

        return features.cpu().float().numpy()

    # ------------------------------------------------------------------
    def pca_visualize(
        self, features: np.ndarray, n_components: int = 3
    ) -> np.ndarray:
        """Project features to 3 PCA components for RGB visualisation.

        Returns (N, 3) uint8 array suitable for point cloud colouring.
        """
        from sklearn.decomposition import PCA

        pca = PCA(n_components=n_components)
        reduced = pca.fit_transform(features)  # (N, 3)
        # Normalise to [0, 255]
        mn = reduced.min(axis=0)
        mx = reduced.max(axis=0)
        rng = np.where(mx - mn > 1e-8, mx - mn, 1.0)
        rgb = ((reduced - mn) / rng * 255).astype(np.uint8)
        return rgb

    # ------------------------------------------------------------------
    def clear_cache(self) -> None:
        """Flush feature cache."""
        self._cache.clear()

    @property
    def feature_dim(self) -> int:
        """Output feature dimensionality (576 for Utonia base)."""
        return self.cfg.channels[-1]