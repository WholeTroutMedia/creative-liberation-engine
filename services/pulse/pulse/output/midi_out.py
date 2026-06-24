"""
PULSE — MIDI Output

Broadcasts biometric signals as MIDI CC messages.
Creates a virtual MIDI port that any DAW or creative tool can receive from.
Compatible with Ableton Live, Logic Pro, FL Studio, etc.
"""

import logging
import threading
from typing import Optional

logger = logging.getLogger("pulse.output.midi")


def _clamp_cc(value: float, in_min: float, in_max: float) -> int:
    """Map a value from an input range to MIDI CC range (0-127)."""
    if in_max <= in_min:
        return 0
    normalized = (value - in_min) / (in_max - in_min)
    return max(0, min(127, int(normalized * 127)))


class MIDIOutput:
    """
    Virtual MIDI port that broadcasts vital signs as CC messages.
    """

    def __init__(self, config: dict):
        self.enabled = config.get("enabled", True)
        self.port_name = config.get("port_name", "PULSE Biometric")
        self.channel = config.get("channel", 0)
        self.cc_mappings = config.get("cc_mappings", {
            "heart_rate": 1,
            "hrv": 2,
            "respiratory_rate": 3,
            "stress_index": 4,
            "confidence": 5,
        })

        self._port = None
        self._lock = threading.Lock()

        if self.enabled:
            self._open_port()

    def _open_port(self):
        """Open a virtual MIDI output port."""
        try:
            import mido
            import rtmidi  # noqa: F401 — needed by mido backend

            self._port = mido.open_output(self.port_name, virtual=True)
            logger.info(f"MIDI virtual port opened: '{self.port_name}'")
        except Exception as e:
            logger.warning(
                f"MIDI port failed (virtual ports may not be supported on Windows "
                f"without loopMIDI): {e}"
            )
            self._try_fallback()

    def _try_fallback(self):
        """Try to open an existing MIDI port as fallback."""
        try:
            import mido
            available = mido.get_output_names()
            if available:
                self._port = mido.open_output(available[0])
                logger.info(f"MIDI fallback port: '{available[0]}'")
            else:
                logger.warning(
                    "No MIDI ports available. Install loopMIDI for virtual ports on Windows. "
                    "MIDI output disabled."
                )
                self.enabled = False
        except Exception as e:
            logger.warning(f"MIDI fallback failed: {e}")
            self.enabled = False

    def send(self, vitals: dict):
        """
        Send vital signs as MIDI CC messages.

        Mappings:
            HR:    40-200 BPM  → CC 0-127
            HRV:   0-200 ms   → CC 0-127
            RR:    4-30 BrPM  → CC 0-127
            Stress: 0-100     → CC 0-127
            Confidence: 0-1   → CC 0-127
        """
        if not self.enabled or self._port is None:
            return

        try:
            import mido

            with self._lock:
                # Heart Rate (40-200 BPM → 0-127)
                if "heart_rate" in self.cc_mappings:
                    cc_val = _clamp_cc(vitals.get("heart_rate", 0), 40, 200)
                    msg = mido.Message(
                        "control_change",
                        channel=self.channel,
                        control=self.cc_mappings["heart_rate"],
                        value=cc_val,
                    )
                    self._port.send(msg)

                # HRV RMSSD (0-200 ms → 0-127)
                if "hrv" in self.cc_mappings:
                    cc_val = _clamp_cc(vitals.get("hrv_rmssd", 0), 0, 200)
                    msg = mido.Message(
                        "control_change",
                        channel=self.channel,
                        control=self.cc_mappings["hrv"],
                        value=cc_val,
                    )
                    self._port.send(msg)

                # Respiratory Rate (4-30 BrPM → 0-127)
                if "respiratory_rate" in self.cc_mappings:
                    cc_val = _clamp_cc(vitals.get("respiratory_rate", 0), 4, 30)
                    msg = mido.Message(
                        "control_change",
                        channel=self.channel,
                        control=self.cc_mappings["respiratory_rate"],
                        value=cc_val,
                    )
                    self._port.send(msg)

                # Stress Index (0-100 → 0-127)
                if "stress_index" in self.cc_mappings:
                    cc_val = _clamp_cc(vitals.get("stress_index", 0), 0, 100)
                    msg = mido.Message(
                        "control_change",
                        channel=self.channel,
                        control=self.cc_mappings["stress_index"],
                        value=cc_val,
                    )
                    self._port.send(msg)

                # Confidence (0-1 → 0-127)
                if "confidence" in self.cc_mappings:
                    cc_val = _clamp_cc(vitals.get("confidence", 0), 0, 1)
                    msg = mido.Message(
                        "control_change",
                        channel=self.channel,
                        control=self.cc_mappings["confidence"],
                        value=cc_val,
                    )
                    self._port.send(msg)

        except Exception as e:
            logger.debug(f"MIDI send error: {e}")

    def close(self):
        """Close the MIDI port."""
        if self._port is not None:
            try:
                self._port.close()
            except Exception:
                pass
            self._port = None
        logger.info("MIDI output closed")
