"""
PULSE — OSC Output

Broadcasts biometric signals via Open Sound Control protocol.
Compatible with DaVinci Resolve, Ableton Live, TouchDesigner,
Max/MSP, and any OSC-capable creative tool.
"""

import logging
from pythonosc import udp_client
from typing import Optional

logger = logging.getLogger("pulse.output.osc")


class OSCOutput:
    """
    OSC client that broadcasts vital signs to creative applications.
    """

    def __init__(self, config: dict):
        self.enabled = config.get("enabled", True)
        self.host = config.get("host", "127.0.0.1")
        self.port = config.get("port", 9000)
        self.addresses = config.get("addresses", {
            "heart_rate": "/pulse/hr",
            "hrv": "/pulse/hrv",
            "respiratory_rate": "/pulse/rr",
            "stress_index": "/pulse/stress",
            "raw_bvp": "/pulse/bvp",
            "confidence": "/pulse/confidence",
        })

        self._client: Optional[udp_client.SimpleUDPClient] = None

        if self.enabled:
            self._connect()

    def _connect(self):
        """Initialize the OSC UDP client."""
        try:
            self._client = udp_client.SimpleUDPClient(self.host, self.port)
            logger.info(f"OSC output → {self.host}:{self.port}")
        except Exception as e:
            logger.error(f"OSC client failed to initialize: {e}")
            self._client = None

    def send(self, vitals: dict):
        """
        Send vital signs as OSC messages.

        Args:
            vitals: dict from VitalSigns.to_dict()
        """
        if not self.enabled or self._client is None:
            return

        try:
            # Heart Rate
            if "heart_rate" in vitals and "heart_rate" in self.addresses:
                self._client.send_message(
                    self.addresses["heart_rate"],
                    float(vitals["heart_rate"])
                )

            # HRV (RMSSD)
            if "hrv_rmssd" in vitals and "hrv" in self.addresses:
                self._client.send_message(
                    self.addresses["hrv"],
                    float(vitals["hrv_rmssd"])
                )

            # Respiratory Rate
            if "respiratory_rate" in vitals and "respiratory_rate" in self.addresses:
                self._client.send_message(
                    self.addresses["respiratory_rate"],
                    float(vitals["respiratory_rate"])
                )

            # Stress Index
            if "stress_index" in vitals and "stress_index" in self.addresses:
                self._client.send_message(
                    self.addresses["stress_index"],
                    float(vitals["stress_index"])
                )

            # Confidence
            if "confidence" in vitals and "confidence" in self.addresses:
                self._client.send_message(
                    self.addresses["confidence"],
                    float(vitals["confidence"])
                )

        except Exception as e:
            logger.debug(f"OSC send error: {e}")

    def send_raw_bvp(self, bvp_sample: float):
        """Send a single raw BVP sample (high frequency)."""
        if not self.enabled or self._client is None:
            return
        try:
            self._client.send_message(
                self.addresses.get("raw_bvp", "/pulse/bvp"),
                float(bvp_sample)
            )
        except Exception:
            pass

    def close(self):
        """Clean shutdown."""
        self._client = None
        logger.info("OSC output closed")
