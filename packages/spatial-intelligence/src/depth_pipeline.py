"""Depth estimation pipeline for Creative Liberation Engine spatial intelligence.

Provides two depth backends:
- DA3 (Depth Anything 3 Mono-Large): Relative monocular depth, multi-view
- DepthPro (Apple): Metric depth + focal length estimation in 0.3s

Usage:
    pipe = DepthPipeline()
    result = pipe.estimate(rgb_image, method='depthpro')  # DepthResult
    result = pipe.estimate_multiview(frames)              # list[DepthResult]
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Literal, Optional, Tuple

import cv2
import numpy as np
import torch

from config import config, DepthConfig

logger = logging.getLogger(__name__)

DepthMethod = Literal["da3", "depthpro", "da3_multiview"]


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class DepthResult:
    """Output of a depth estimation call."""
    depth: np.ndarray          # (H, W) float32, metric metres or relative
    focal_length_px: Optional[float] = None  # estimated focal length (DepthPro)
    is_metric: bool = False    # True if metric (DepthPro), False if relative (DA3)
    confidence: Optional[np.ndarray] = None  # (H, W) float32 in [0, 1]
    method: str = "unknown"
    latency_ms: float = 0.0

    @property
    def height(self) -> int:
        return self.depth.shape[0]

    @property
    def width(self) -> int:
        return self.depth.shape[1]

    def normalise_to_uint8(self) -> np.ndarray:
        """Normalise depth to 0-255 uint8 for visualisation."""
        mn, mx = self.depth.min(), self.depth.max()
        if mx - mn < 1e-8:
            return np.zeros_like(self.depth, dtype=np.uint8)
        return ((self.depth - mn) / (mx - mn) * 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# DA3 (Depth Anything 3) backend
# ---------------------------------------------------------------------------

class _DA3Backend:
    """Depth Anything 3 Mono-Large wrapper.

    Loads from HuggingFace cache or local weights path.
    Falls back to a synthetic gradient depth map if weights are absent.
    """

    def __init__(self, cfg: DepthConfig):
        self.cfg = cfg
        self.device = torch.device(cfg.device if torch.cuda.is_available() else "cpu")
        self._pipe = None
        self._using_stub = False

    def _load(self) -> None:
        if self._pipe is not None:
            return
        try:
            from transformers import pipeline as hf_pipeline
            weights = str(self.cfg.da3_weights_path)
            if not self.cfg.da3_weights_path.exists():
                weights = self.cfg.da3_model_id
                logger.info("DA3 weights not found locally, using HF id: %s", weights)
            self._pipe = hf_pipeline(
                task="depth-estimation",
                model=weights,
                device=0 if self.device.type == "cuda" else -1,
            )
            logger.info("DA3 Mono-Large loaded on %s", self.device)
        except Exception as exc:
            logger.warning("DA3 load failed: %s -- using stub", exc)
            self._using_stub = True

    def estimate(self, rgb_image: np.ndarray) -> DepthResult:
        """Estimate relative depth from a single RGB frame.

        Args:
            rgb_image: (H, W, 3) uint8 numpy array in RGB order

        Returns:
            DepthResult with relative depth map
        """
        t0 = time.perf_counter()
        self._load()

        if self._using_stub:
            # Gradient stub: depth increases from top (far) to bottom (close)
            h, w = rgb_image.shape[:2]
            depth = np.linspace(10.0, 1.0, h, dtype=np.float32)[:, None] * np.ones(w)
            return DepthResult(
                depth=depth, is_metric=False, method="da3_stub",
                latency_ms=(time.perf_counter() - t0) * 1000
            )

        from PIL import Image
        pil = Image.fromarray(rgb_image)
        out = self._pipe(pil)
        depth = np.array(out["depth"], dtype=np.float32)
        return DepthResult(
            depth=depth, is_metric=False, method="da3",
            latency_ms=(time.perf_counter() - t0) * 1000
        )

    def estimate_multiview(
        self, frames: List[np.ndarray]
    ) -> List[DepthResult]:
        """Estimate depth for a sequence of frames with consistent scale.

        DA3 Multi-view uses geometric consistency across frames when the
        DA3Nested-Giant-Large model is available. Falls back to per-frame
        mono estimation otherwise.
        """
        results = [self.estimate(f) for f in frames]
        # Scale-align: normalise all depths to median of first frame
        if results:
            ref_median = np.median(results[0].depth)
            for r in results[1:]:
                cur_median = np.median(r.depth)
                if cur_median > 1e-8:
                    r.depth = r.depth * (ref_median / cur_median)
        return results


# ---------------------------------------------------------------------------
# DepthPro (Apple) backend
# ---------------------------------------------------------------------------

class _DepthProBackend:
    """Apple DepthPro wrapper -- metric depth + focal length in 0.3s.

    Loads from HuggingFace transformers pipeline. If unavailable, falls
    back to DA3 metric-scaled estimate.
    """

    def __init__(self, cfg: DepthConfig):
        self.cfg = cfg
        self.device = torch.device(cfg.device if torch.cuda.is_available() else "cpu")
        self._model = None
        self._processor = None
        self._using_stub = False

    def _load(self) -> None:
        if self._model is not None:
            return
        try:
            from transformers import DepthProForDepthEstimation, DepthProImageProcessorFast
            weights = str(self.cfg.depth_pro_weights_path)
            if not self.cfg.depth_pro_weights_path.exists():
                weights = self.cfg.depth_pro_model_id
                logger.info("DepthPro weights not found locally, using HF id: %s", weights)
            self._processor = DepthProImageProcessorFast.from_pretrained(weights)
            self._model = DepthProForDepthEstimation.from_pretrained(weights)
            self._model = self._model.to(self.device).eval()
            logger.info("Apple DepthPro loaded on %s", self.device)
        except Exception as exc:
            logger.warning("DepthPro load failed: %s -- falling back to stub", exc)
            self._using_stub = True

    def estimate(self, rgb_image: np.ndarray) -> DepthResult:
        """Estimate metric depth from a single RGB frame.

        Args:
            rgb_image: (H, W, 3) uint8 numpy array in RGB order

        Returns:
            DepthResult with metric depth (metres) and focal_length_px
        """
        t0 = time.perf_counter()
        self._load()

        if self._using_stub:
            h, w = rgb_image.shape[:2]
            # Synthetic metric depth: 0.5m–5m range based on luminance
            gray = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
            depth = 0.5 + (1.0 - gray) * 4.5
            focal_px = float(max(h, w))  # crude estimate
            return DepthResult(
                depth=depth, focal_length_px=focal_px, is_metric=True,
                method="depthpro_stub",
                latency_ms=(time.perf_counter() - t0) * 1000
            )

        from PIL import Image
        pil = Image.fromarray(rgb_image)
        inputs = self._processor(images=pil, return_tensors="pt").to(self.device)
        with torch.no_grad():
            outputs = self._model(**inputs)

        # Post-process: get metric depth and focal length
        pp = self._processor.post_process_depth_estimation(
            outputs,
            target_sizes=[(rgb_image.shape[0], rgb_image.shape[1])],
        )[0]
        depth = pp["predicted_depth"].cpu().numpy().astype(np.float32)
        focal_px = float(pp.get("focal_length_px", max(rgb_image.shape[:2])))

        return DepthResult(
            depth=depth,
            focal_length_px=focal_px,
            is_metric=True,
            method="depthpro",
            latency_ms=(time.perf_counter() - t0) * 1000,
        )


# ---------------------------------------------------------------------------
# Public pipeline
# ---------------------------------------------------------------------------

class DepthPipeline:
    """Unified depth estimation pipeline.

    Manages both DA3 and DepthPro backends. Lazily initialises on first use.

    Args:
        cfg: DepthConfig instance (defaults to global config)
        preferred_method: Default method when none is specified
    """

    def __init__(
        self,
        cfg: Optional[DepthConfig] = None,
        preferred_method: DepthMethod = "depthpro",
    ):
        self.cfg = cfg or config.depth
        self.preferred_method = preferred_method
        self._da3 = _DA3Backend(self.cfg)
        self._depthpro = _DepthProBackend(self.cfg)

    def estimate(
        self,
        rgb_image: np.ndarray,
        method: Optional[DepthMethod] = None,
    ) -> DepthResult:
        """Estimate depth from a single RGB frame.

        Args:
            rgb_image: (H, W, 3) uint8 numpy array in RGB order.
                       If BGR (OpenCV default), convert with cv2.cvtColor first.
            method: 'da3' | 'depthpro' | None (uses preferred_method)

        Returns:
            DepthResult
        """
        m = method or self.preferred_method
        if m == "depthpro":
            return self._depthpro.estimate(rgb_image)
        elif m == "da3" or m == "da3_multiview":
            return self._da3.estimate(rgb_image)
        else:
            raise ValueError(f"Unknown depth method: {m}")

    def estimate_multiview(
        self,
        frames: List[np.ndarray],
        method: Optional[DepthMethod] = None,
    ) -> List[DepthResult]:
        """Estimate depth for multiple frames with scale consistency.

        Args:
            frames: list of (H, W, 3) uint8 RGB arrays
            method: 'da3' | 'depthpro' | None

        Returns:
            list of DepthResult, one per frame
        """
        m = method or self.preferred_method
        if m == "depthpro":
            return [self._depthpro.estimate(f) for f in frames]
        else:
            return self._da3.estimate_multiview(frames)

    def resize_to_model_input(
        self, rgb_image: np.ndarray, size: int = 1024
    ) -> np.ndarray:
        """Resize image to square size while preserving aspect ratio with padding."""
        h, w = rgb_image.shape[:2]
        scale = size / max(h, w)
        nh, nw = int(h * scale), int(w * scale)
        resized = cv2.resize(rgb_image, (nw, nh), interpolation=cv2.INTER_LINEAR)
        # Pad to square
        pad_h = size - nh
        pad_w = size - nw
        padded = cv2.copyMakeBorder(
            resized, 0, pad_h, 0, pad_w,
            cv2.BORDER_CONSTANT, value=0
        )
        return padded

    def bgr_to_rgb(self, bgr_image: np.ndarray) -> np.ndarray:
        """Convert OpenCV BGR image to RGB."""
        return cv2.cvtColor(bgr_image, cv2.COLOR_BGR2RGB)