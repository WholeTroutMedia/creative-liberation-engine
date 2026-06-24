"""
PULSE — Physiological Signal Processor

Extracts meaningful physiological metrics from the raw BVP signal:
- Heart Rate (HR) in BPM
- Heart Rate Variability (HRV) as RMSSD in ms
- Respiratory Rate (RR) in breaths/min
- Stress Index (composite HRV-derived metric)
- Signal quality / confidence score
"""

import numpy as np
from scipy.signal import find_peaks, welch
from dataclasses import dataclass
import logging
from typing import Optional

logger = logging.getLogger("pulse.rppg.signal")


@dataclass
class VitalSigns:
    """Container for all extracted physiological signals."""
    heart_rate: float = 0.0           # BPM
    hrv_rmssd: float = 0.0            # ms — Root Mean Square of Successive Differences
    hrv_sdnn: float = 0.0             # ms — Standard Deviation of NN intervals
    respiratory_rate: float = 0.0     # breaths per minute
    stress_index: float = 0.0         # 0-100 composite
    confidence: float = 0.0           # 0-1 signal quality
    raw_bvp: Optional[np.ndarray] = None  # Raw BVP if requested
    timestamp: float = 0.0

    def to_dict(self) -> dict:
        """Serialize for output protocols."""
        return {
            "heart_rate": round(self.heart_rate, 1),
            "hrv_rmssd": round(self.hrv_rmssd, 1),
            "hrv_sdnn": round(self.hrv_sdnn, 1),
            "respiratory_rate": round(self.respiratory_rate, 1),
            "stress_index": round(self.stress_index, 1),
            "confidence": round(self.confidence, 3),
            "timestamp": self.timestamp,
        }


class SignalProcessor:
    """
    Processes raw BVP signals into physiological metrics.
    """

    def __init__(self, config: dict):
        self.bandpass_low = config.get("bandpass_low", 0.7)
        self.bandpass_high = config.get("bandpass_high", 4.0)
        self.welch_window = config.get("welch_window_seconds", 6)

        # Smoothing buffer for output stability
        self._hr_buffer = []
        self._smooth_window = 5  # Number of estimates to average

    def process(
        self,
        bvp: np.ndarray,
        fps: float,
        timestamp: float,
        include_raw: bool = False,
    ) -> VitalSigns:
        """
        Extract all vital signs from a BVP signal.

        Args:
            bvp: 1D BVP signal from rPPG engine
            fps: Sampling rate in Hz
            timestamp: Current timestamp
            include_raw: Whether to include raw BVP in output

        Returns:
            VitalSigns with all extracted metrics
        """
        vitals = VitalSigns(timestamp=timestamp)

        if bvp is None or len(bvp) < int(fps * 3):
            return vitals

        # ── Heart Rate via Welch PSD ──
        hr, hr_confidence = self._estimate_heart_rate(bvp, fps)
        vitals.heart_rate = hr
        vitals.confidence = hr_confidence

        # ── HRV from peak detection ──
        ibi_ms = self._extract_ibi(bvp, fps)
        if len(ibi_ms) >= 3:
            vitals.hrv_rmssd = self._calc_rmssd(ibi_ms)
            vitals.hrv_sdnn = self._calc_sdnn(ibi_ms)

        # ── Respiratory Rate ──
        vitals.respiratory_rate = self._estimate_respiratory_rate(bvp, fps)

        # ── Stress Index (composite) ──
        vitals.stress_index = self._calc_stress_index(
            vitals.hrv_rmssd, vitals.hrv_sdnn, hr
        )

        # ── Raw BVP if requested ──
        if include_raw:
            vitals.raw_bvp = bvp

        return vitals

    def _estimate_heart_rate(
        self, bvp: np.ndarray, fps: float
    ) -> tuple[float, float]:
        """
        Estimate heart rate using Welch's method power spectral density.

        Returns:
            (heart_rate_bpm, confidence)
        """
        # Welch PSD
        nperseg = min(len(bvp), int(fps * self.welch_window))
        if nperseg < 4:
            return 0.0, 0.0

        try:
            freqs, psd = welch(
                bvp, fs=fps, nperseg=nperseg, noverlap=nperseg // 2
            )
        except Exception as e:
            logger.debug(f"Welch PSD failed: {e}")
            return 0.0, 0.0

        # Restrict to cardiac frequency range
        mask = (freqs >= self.bandpass_low) & (freqs <= self.bandpass_high)
        cardiac_freqs = freqs[mask]
        cardiac_psd = psd[mask]

        if len(cardiac_psd) == 0:
            return 0.0, 0.0

        # Peak frequency → HR
        peak_idx = np.argmax(cardiac_psd)
        peak_freq = cardiac_freqs[peak_idx]
        hr_bpm = peak_freq * 60.0

        # Confidence: ratio of peak power to total power in cardiac band
        peak_power = cardiac_psd[peak_idx]
        total_power = np.sum(cardiac_psd)

        if total_power == 0:
            confidence = 0.0
        else:
            # Use spectral concentration ratio
            # A clean signal has a sharp peak (high ratio)
            confidence = float(np.clip(peak_power / total_power * 5.0, 0.0, 1.0))

        # Smooth HR output
        self._hr_buffer.append(hr_bpm)
        if len(self._hr_buffer) > self._smooth_window:
            self._hr_buffer.pop(0)

        smoothed_hr = np.median(self._hr_buffer)

        # Sanity check
        if smoothed_hr < 40 or smoothed_hr > 200:
            confidence *= 0.3

        return float(smoothed_hr), float(confidence)

    def _extract_ibi(self, bvp: np.ndarray, fps: float) -> np.ndarray:
        """
        Extract inter-beat intervals (IBI) from BVP peaks.

        Returns:
            Array of IBI values in milliseconds
        """
        # Find peaks with minimum distance of ~300ms (200 BPM max)
        min_distance = int(fps * 0.3)
        if min_distance < 1:
            min_distance = 1

        try:
            peaks, properties = find_peaks(
                bvp,
                distance=min_distance,
                prominence=0.3 * np.std(bvp),
            )
        except Exception:
            return np.array([])

        if len(peaks) < 2:
            return np.array([])

        # Convert peak intervals to milliseconds
        ibi_samples = np.diff(peaks)
        ibi_ms = (ibi_samples / fps) * 1000.0

        # Filter physiologically plausible IBIs (300ms - 1500ms = 40-200 BPM)
        valid = (ibi_ms >= 300) & (ibi_ms <= 1500)
        return ibi_ms[valid]

    def _calc_rmssd(self, ibi_ms: np.ndarray) -> float:
        """Root Mean Square of Successive Differences — primary HRV metric."""
        if len(ibi_ms) < 2:
            return 0.0
        diffs = np.diff(ibi_ms)
        return float(np.sqrt(np.mean(diffs ** 2)))

    def _calc_sdnn(self, ibi_ms: np.ndarray) -> float:
        """Standard Deviation of NN intervals."""
        if len(ibi_ms) < 2:
            return 0.0
        return float(np.std(ibi_ms))

    def _estimate_respiratory_rate(
        self, bvp: np.ndarray, fps: float
    ) -> float:
        """
        Estimate respiratory rate from BVP amplitude modulation.

        Respiratory Sinus Arrhythmia (RSA) modulates the BVP amplitude
        at the breathing frequency (typically 0.1-0.5 Hz = 6-30 breaths/min).
        """
        # Get the amplitude envelope of the BVP
        analytic = np.abs(self._hilbert(bvp))

        # Welch PSD of the envelope in respiratory frequency range
        nperseg = min(len(analytic), int(fps * 10))
        if nperseg < 4:
            return 0.0

        try:
            freqs, psd = welch(analytic, fs=fps, nperseg=nperseg)
        except Exception:
            return 0.0

        # Respiratory frequency range: 0.1 - 0.5 Hz (6 - 30 breaths/min)
        resp_mask = (freqs >= 0.1) & (freqs <= 0.5)
        resp_freqs = freqs[resp_mask]
        resp_psd = psd[resp_mask]

        if len(resp_psd) == 0:
            return 0.0

        peak_idx = np.argmax(resp_psd)
        resp_freq = resp_freqs[peak_idx]
        rr = resp_freq * 60.0

        return float(np.clip(rr, 6, 30))

    def _calc_stress_index(
        self, rmssd: float, sdnn: float, hr: float
    ) -> float:
        """
        Composite stress index (0-100).

        Based on Baevsky's Stress Index concept:
        - Lower HRV (RMSSD, SDNN) → higher stress
        - Higher HR → higher stress (above resting)
        """
        if rmssd == 0 and sdnn == 0:
            return 50.0  # Unknown → neutral

        # HRV component: low HRV = high stress
        # Typical RMSSD: 20-60ms (healthy adult at rest)
        hrv_stress = np.clip(1.0 - (rmssd / 60.0), 0, 1) * 50

        # HR component: elevated HR = stress indicator
        # Resting HR ~60-80 for average adult
        hr_stress = np.clip((hr - 60) / 80.0, 0, 1) * 30

        # SDNN component
        sdnn_stress = np.clip(1.0 - (sdnn / 100.0), 0, 1) * 20

        stress = hrv_stress + hr_stress + sdnn_stress
        return float(np.clip(stress, 0, 100))

    def _hilbert(self, signal: np.ndarray) -> np.ndarray:
        """Simple Hilbert transform for envelope extraction."""
        from scipy.signal import hilbert
        try:
            return hilbert(signal)
        except Exception:
            return signal
