"""
PULSE — Main Orchestrator

Entry point for the PULSE biometric vision service.
Orchestrates: Video Capture → Face Detection → rPPG → Signal Processing → Output
"""

import asyncio
import logging
import signal
import sys
import time
from pathlib import Path
from typing import Optional

import yaml
import numpy as np

from pulse.capture import VideoCapture, FramePacket
from pulse.face_detect import FaceDetector, FaceDetection
from pulse.rppg.engine import RPPGEngine
from pulse.rppg.signal import SignalProcessor, VitalSigns
from pulse.output.osc_out import OSCOutput
from pulse.output.midi_out import MIDIOutput
from pulse.output.websocket_out import WebSocketOutput
from pulse.output.sse_out import SSEOutput

# ─── Logging Setup ──────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-24s │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("pulse.main")


class PulseService:
    """
    Main orchestrator for the PULSE biometric vision pipeline.

    Pipeline: Camera → Face Detect → ROI Extract → rPPG → Signal → Output
    """

    def __init__(self, config_path: str = "config.yaml"):
        # Load configuration
        self.config = self._load_config(config_path)
        self._running = False

        # ── Pipeline components ──
        self.capture = VideoCapture(self.config.get("capture", {}))
        self.face_detector = FaceDetector(self.config.get("face_detection", {}))
        self.rppg_engine = RPPGEngine(self.config.get("rppg", {}))
        self.signal_processor = SignalProcessor(self.config.get("rppg", {}))

        # ── Output layer ──
        self.osc = OSCOutput(self.config.get("osc", {}))
        self.midi = MIDIOutput(self.config.get("midi", {}))
        self.ws = WebSocketOutput(self.config.get("websocket", {}))
        self.sse = SSEOutput(
            self.config.get("sse", {}),
            self.config.get("dashboard", {}),
        )

        # ── Signal config ──
        self.signal_config = self.config.get("signals", {})
        self.include_raw_bvp = self.signal_config.get("raw_bvp", False)

        # ── Timing ──
        self.update_interval = self.config.get("rppg", {}).get(
            "update_interval_seconds", 1.0
        )
        self._last_update = 0.0

        # ── Stats ──
        self._frames_processed = 0
        self._faces_detected = 0
        self._vitals_emitted = 0

    def _load_config(self, path: str) -> dict:
        """Load YAML configuration."""
        config_path = Path(path)
        if not config_path.exists():
            logger.warning(f"Config not found at {path}, using defaults")
            return {}

        with open(config_path, "r") as f:
            config = yaml.safe_load(f)

        svc = config.get("service", {})
        logger.info(
            f"Loaded config: {svc.get('name', 'pulse')} "
            f"v{svc.get('version', '0.1.0')}"
        )
        return config

    async def start(self):
        """Initialize and start the full pipeline."""
        logger.info("═" * 60)
        logger.info("  PULSE — Video-Based Biometric Sensing")
        logger.info("  Part of the Creative Liberation Engine V6")
        logger.info("═" * 60)

        # Start output servers
        await self.ws.start()
        await self.sse.start()

        # Open video capture
        if not self.capture.open():
            logger.error("Failed to open video capture — aborting")
            return

        self._running = True

        logger.info("Pipeline ready. Starting capture loop...")
        logger.info(
            f"  Outputs: OSC={self.osc.enabled} MIDI={self.midi.enabled} "
            f"WS={self.ws.enabled} SSE={self.sse.enabled}"
        )
        logger.info(f"  rPPG method: {self.rppg_engine.method}")
        logger.info(f"  Update interval: {self.update_interval}s")

        # Run the main processing loop
        try:
            await self._processing_loop()
        except KeyboardInterrupt:
            logger.info("Interrupted by user")
        except Exception as e:
            logger.error(f"Pipeline error: {e}", exc_info=True)
        finally:
            await self.stop()

    async def _processing_loop(self):
        """
        Main frame processing loop.

        For each frame:
        1. Capture frame from camera
        2. Detect face and extract ROIs
        3. Feed mean RGB into rPPG engine
        4. At update intervals, extract BVP and compute vital signs
        5. Broadcast via all output protocols
        """
        async for packet in self.capture.stream():
            if not self._running:
                break

            self._frames_processed += 1

            # ── Face Detection ──
            detection = self.face_detector.detect(packet.frame)

            if not detection.detected:
                # No face — skip but keep the loop alive
                if self._frames_processed % 60 == 0:
                    logger.debug(
                        f"No face detected (frame {self._frames_processed})"
                    )
                continue

            self._faces_detected += 1

            # ── Extract mean RGB from ROIs ──
            mean_rgb = detection.mean_rgb
            if mean_rgb is None:
                continue

            # ── Feed into rPPG engine ──
            self.rppg_engine.add_sample(mean_rgb, packet.timestamp)

            # ── Periodic vital sign extraction ──
            now = time.time()
            if now - self._last_update >= self.update_interval:
                self._last_update = now
                await self._extract_and_broadcast(packet.timestamp)

    async def _extract_and_broadcast(self, timestamp: float):
        """Extract BVP, compute vital signs, broadcast to all outputs."""
        if not self.rppg_engine.has_enough_data:
            return

        # Extract BVP signal
        bvp = self.rppg_engine.extract_bvp()
        if bvp is None:
            return

        # Compute vital signs
        fps = self.rppg_engine.get_fps()
        vitals = self.signal_processor.process(
            bvp, fps, timestamp, include_raw=self.include_raw_bvp
        )

        if vitals.confidence < 0.1:
            return  # Signal too noisy to report

        self._vitals_emitted += 1
        vitals_dict = vitals.to_dict()

        # Log periodic status
        if self._vitals_emitted % 5 == 0:
            logger.info(
                f"♥ HR={vitals.heart_rate:.0f} BPM  "
                f"HRV={vitals.hrv_rmssd:.0f}ms  "
                f"RR={vitals.respiratory_rate:.0f}/min  "
                f"Stress={vitals.stress_index:.0f}  "
                f"Conf={vitals.confidence:.2f}  "
                f"│ WS:{self.ws.client_count} SSE:{self.sse.client_count}"
            )

        # ── Broadcast to all outputs ──
        # OSC (synchronous, UDP)
        self.osc.send(vitals_dict)

        # MIDI (synchronous)
        self.midi.send(vitals_dict)

        # WebSocket (async)
        await self.ws.send(vitals_dict)

        # SSE / Telemetry (async)
        await self.sse.send(vitals_dict)

    async def stop(self):
        """Graceful shutdown."""
        logger.info("Shutting down PULSE...")
        self._running = False

        self.capture.close()
        self.face_detector.close()
        self.osc.close()
        self.midi.close()
        await self.ws.close()
        await self.sse.close()

        logger.info(
            f"Session stats: {self._frames_processed} frames, "
            f"{self._faces_detected} faces, "
            f"{self._vitals_emitted} vitals emitted"
        )
        logger.info("PULSE shutdown complete")


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="PULSE — Video-Based Biometric Sensing Service"
    )
    parser.add_argument(
        "-c", "--config",
        default="config.yaml",
        help="Path to config.yaml (default: config.yaml)",
    )
    parser.add_argument(
        "--source",
        choices=["webcam", "rtsp", "file"],
        help="Override video source",
    )
    parser.add_argument(
        "--device", type=int,
        help="Override webcam device index",
    )
    parser.add_argument(
        "--method",
        choices=["chrom", "pos", "green", "ica"],
        help="Override rPPG method",
    )
    args = parser.parse_args()

    service = PulseService(config_path=args.config)

    # Apply CLI overrides
    if args.source:
        service.capture.source = args.source
    if args.device is not None:
        service.capture.device_index = args.device
    if args.method:
        service.rppg_engine.method = args.method

    # Handle graceful shutdown
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    def shutdown_handler():
        service._running = False

    try:
        if sys.platform != "win32":
            loop.add_signal_handler(signal.SIGINT, shutdown_handler)
            loop.add_signal_handler(signal.SIGTERM, shutdown_handler)
    except NotImplementedError:
        pass  # Windows doesn't support add_signal_handler

    try:
        loop.run_until_complete(service.start())
    except KeyboardInterrupt:
        loop.run_until_complete(service.stop())
    finally:
        loop.close()


if __name__ == "__main__":
    main()
