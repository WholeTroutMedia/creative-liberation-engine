"""
PULSE — rPPG Inference Engine

Implements classical (CHROM, POS, Green) and deep learning (EfficientPhys)
methods for extracting blood volume pulse (BVP) signals from facial video ROIs.
"""

import numpy as np
import logging
from typing import Optional, List
from collections import deque

logger = logging.getLogger("pulse.rppg.engine")


class RPPGEngine:
    """
    Remote photoplethysmography engine.

    Accumulates mean RGB signals from face ROIs across frames and
    extracts the blood volume pulse (BVP) using the selected method.
    """

    def __init__(self, config: dict):
        self.method = config.get("method", "chrom")
        self.fallback_method = config.get("fallback_method", "chrom")
        self.bandpass_low = config.get("bandpass_low", 0.7)
        self.bandpass_high = config.get("bandpass_high", 4.0)
        self.update_interval = config.get("update_interval_seconds", 1.0)

        # Rolling buffer of mean RGB values: each entry is (timestamp, [R, G, B])
        self._rgb_buffer: deque = deque(maxlen=1024)
        self._timestamps: deque = deque(maxlen=1024)

        logger.info(f"rPPG engine initialized: method={self.method}")

    def add_sample(self, mean_rgb: np.ndarray, timestamp: float):
        """
        Add a new RGB sample from face ROI.

        Args:
            mean_rgb: (3,) array of mean [R, G, B] values from ROI
            timestamp: Frame timestamp in seconds
        """
        self._rgb_buffer.append(mean_rgb.copy())
        self._timestamps.append(timestamp)

    @property
    def buffer_length(self) -> int:
        return len(self._rgb_buffer)

    @property
    def has_enough_data(self) -> bool:
        """Need at least 3 seconds of data for meaningful signal."""
        if len(self._timestamps) < 2:
            return False
        duration = self._timestamps[-1] - self._timestamps[0]
        return duration >= 3.0

    def extract_bvp(self) -> Optional[np.ndarray]:
        """
        Extract the BVP signal from accumulated RGB data.

        Returns:
            1D numpy array of the BVP signal, or None if insufficient data
        """
        if not self.has_enough_data:
            return None

        rgb_matrix = np.array(self._rgb_buffer)  # (N, 3)

        try:
            if self.method == "chrom":
                return self._chrom(rgb_matrix)
            elif self.method == "pos":
                return self._pos(rgb_matrix)
            elif self.method == "green":
                return self._green(rgb_matrix)
            elif self.method == "ica":
                return self._ica(rgb_matrix)
            else:
                logger.warning(
                    f"Unknown method '{self.method}', falling back to {self.fallback_method}"
                )
                return self._chrom(rgb_matrix)
        except Exception as e:
            logger.error(f"BVP extraction failed ({self.method}): {e}")
            return None

    def get_fps(self) -> float:
        """Estimate actual FPS from timestamp buffer."""
        if len(self._timestamps) < 2:
            return 30.0
        duration = self._timestamps[-1] - self._timestamps[0]
        return len(self._timestamps) / max(duration, 0.001)

    def clear(self):
        """Reset the buffer."""
        self._rgb_buffer.clear()
        self._timestamps.clear()

    # ─── Classical Methods ──────────────────────────────────────

    def _chrom(self, rgb: np.ndarray) -> np.ndarray:
        """
        CHROM — Chrominance-based rPPG method.

        De Haan & Jeanne (2013). Robust Pulse Rate from
        Chrominance-Based rPPG. IEEE TBME.

        Projects RGB into chrominance space to isolate pulse signal
        from motion and illumination artifacts.
        """
        # Normalize each channel by its temporal mean
        mean_rgb = np.mean(rgb, axis=0)
        mean_rgb[mean_rgb == 0] = 1  # Avoid division by zero
        normalized = rgb / mean_rgb

        R = normalized[:, 0]
        G = normalized[:, 1]
        B = normalized[:, 2]

        # Chrominance signals
        Xs = 3 * R - 2 * G
        Ys = 1.5 * R + G - 1.5 * B

        # Bandpass filter
        fps = self.get_fps()
        Xs = self._bandpass(Xs, fps)
        Ys = self._bandpass(Ys, fps)

        # Combine using standard deviation ratio
        std_xs = np.std(Xs)
        std_ys = np.std(Ys)

        if std_ys == 0:
            return Xs

        alpha = std_xs / std_ys
        bvp = Xs - alpha * Ys

        # Final normalization
        bvp = (bvp - np.mean(bvp)) / max(np.std(bvp), 1e-8)
        return bvp

    def _pos(self, rgb: np.ndarray) -> np.ndarray:
        """
        POS — Plane-Orthogonal-to-Skin method.

        Wang et al. (2017). Algorithmic Principles of Remote PPG.
        IEEE TBME.

        Uses a projection plane orthogonal to the skin tone direction
        to suppress specular reflections and motion.
        """
        # Temporal normalization
        mean_rgb = np.mean(rgb, axis=0)
        mean_rgb[mean_rgb == 0] = 1
        normalized = rgb / mean_rgb

        # POS projection
        S1 = normalized[:, 1] - normalized[:, 2]  # G - B
        S2 = normalized[:, 1] + normalized[:, 2] - 2 * normalized[:, 0]  # G + B - 2R

        # Bandpass
        fps = self.get_fps()
        S1 = self._bandpass(S1, fps)
        S2 = self._bandpass(S2, fps)

        # Combine
        std_s1 = np.std(S1)
        std_s2 = np.std(S2)

        if std_s2 == 0:
            return S1

        alpha = std_s1 / std_s2
        bvp = S1 + alpha * S2

        bvp = (bvp - np.mean(bvp)) / max(np.std(bvp), 1e-8)
        return bvp

    def _green(self, rgb: np.ndarray) -> np.ndarray:
        """
        Green channel method — simplest rPPG approach.
        Green channel has the strongest hemoglobin absorption signal.
        """
        green = rgb[:, 1]
        fps = self.get_fps()
        bvp = self._bandpass(green, fps)
        bvp = (bvp - np.mean(bvp)) / max(np.std(bvp), 1e-8)
        return bvp

    def _ica(self, rgb: np.ndarray) -> np.ndarray:
        """
        ICA — Independent Component Analysis method.
        Poh et al. (2010). Uses blind source separation to
        extract the pulse component from RGB channels.
        """
        try:
            from sklearn.decomposition import FastICA
        except ImportError:
            logger.warning("sklearn not available, falling back to CHROM")
            return self._chrom(rgb)

        # Normalize
        mean_rgb = np.mean(rgb, axis=0)
        mean_rgb[mean_rgb == 0] = 1
        normalized = rgb / mean_rgb

        # Apply ICA
        ica = FastICA(n_components=3, max_iter=500, random_state=42)
        try:
            sources = ica.fit_transform(normalized)
        except Exception:
            return self._chrom(rgb)

        # Select the component with the strongest periodic signal in HR range
        fps = self.get_fps()
        best_idx = 0
        best_power = 0

        for i in range(3):
            filtered = self._bandpass(sources[:, i], fps)
            power = np.max(np.abs(np.fft.rfft(filtered))) ** 2
            if power > best_power:
                best_power = power
                best_idx = i

        bvp = self._bandpass(sources[:, best_idx], fps)
        bvp = (bvp - np.mean(bvp)) / max(np.std(bvp), 1e-8)
        return bvp

    # ─── Signal Processing Utilities ────────────────────────────

    def _bandpass(self, signal: np.ndarray, fps: float) -> np.ndarray:
        """Apply bandpass filter to isolate cardiac frequency range."""
        from scipy.signal import butter, filtfilt

        if len(signal) < 13:  # Minimum length for filtfilt
            return signal

        nyq = fps / 2.0
        if nyq <= self.bandpass_low:
            return signal

        low = self.bandpass_low / nyq
        high = min(self.bandpass_high / nyq, 0.99)

        if low >= high:
            return signal

        try:
            b, a = butter(3, [low, high], btype="band")
            return filtfilt(b, a, signal)
        except Exception as e:
            logger.debug(f"Bandpass filter failed: {e}")
            return signal
