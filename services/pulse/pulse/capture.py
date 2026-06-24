"""
PULSE — Video Capture Module

Handles video acquisition from USB webcam, RTSP stream, or file.
Provides async frame iterator for the processing pipeline.
"""

import cv2
import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import AsyncIterator, Optional
import numpy as np

logger = logging.getLogger("pulse.capture")


@dataclass
class FramePacket:
    """A single video frame with metadata."""
    frame: np.ndarray
    timestamp: float
    frame_number: int
    width: int
    height: int
    fps: float


class VideoCapture:
    """
    Unified video capture from webcam, RTSP, or file sources.
    Yields FramePackets asynchronously for the rPPG pipeline.
    """

    def __init__(self, config: dict):
        self.source = config.get("source", "webcam")
        self.device_index = config.get("device_index", 0)
        self.rtsp_url = config.get("rtsp_url", "")
        self.file_path = config.get("file_path", "")
        self.width = config.get("width", 1280)
        self.height = config.get("height", 720)
        self.target_fps = config.get("fps", 30)
        self.buffer_seconds = config.get("buffer_seconds", 10)

        self._cap: Optional[cv2.VideoCapture] = None
        self._frame_count = 0
        self._running = False
        self._actual_fps = self.target_fps

    def _get_source(self):
        """Resolve the capture source."""
        if self.source == "webcam":
            return self.device_index
        elif self.source == "rtsp":
            if not self.rtsp_url:
                raise ValueError("RTSP URL required when source='rtsp'")
            return self.rtsp_url
        elif self.source == "file":
            if not self.file_path:
                raise ValueError("File path required when source='file'")
            return self.file_path
        else:
            raise ValueError(f"Unknown capture source: {self.source}")

    def open(self) -> bool:
        """Open the video capture device."""
        source = self._get_source()
        logger.info(f"Opening video capture: {self.source} → {source}")

        if self.source == "webcam":
            # Use DirectShow on Windows for better performance
            self._cap = cv2.VideoCapture(source, cv2.CAP_DSHOW)
        else:
            self._cap = cv2.VideoCapture(source)

        if not self._cap.isOpened():
            logger.error(f"Failed to open video capture: {source}")
            return False

        # Set resolution
        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        self._cap.set(cv2.CAP_PROP_FPS, self.target_fps)

        # Read actual properties
        actual_w = int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_h = int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self._actual_fps = self._cap.get(cv2.CAP_PROP_FPS) or self.target_fps

        logger.info(
            f"Capture opened: {actual_w}x{actual_h} @ {self._actual_fps:.1f} fps"
        )
        self._running = True
        return True

    def read_frame(self) -> Optional[FramePacket]:
        """Read a single frame synchronously."""
        if self._cap is None or not self._cap.isOpened():
            return None

        ret, frame = self._cap.read()
        if not ret:
            if self.source == "file":
                logger.info("End of video file reached")
            else:
                logger.warning("Failed to read frame")
            return None

        self._frame_count += 1

        return FramePacket(
            frame=frame,
            timestamp=time.time(),
            frame_number=self._frame_count,
            width=frame.shape[1],
            height=frame.shape[0],
            fps=self._actual_fps,
        )

    async def stream(self) -> AsyncIterator[FramePacket]:
        """Async generator yielding frames at the target rate."""
        if not self._running:
            if not self.open():
                return

        frame_interval = 1.0 / self.target_fps

        while self._running:
            t0 = time.time()

            packet = self.read_frame()
            if packet is None:
                if self.source == "file":
                    break
                await asyncio.sleep(0.1)
                continue

            yield packet

            # Throttle to target FPS
            elapsed = time.time() - t0
            sleep_time = max(0, frame_interval - elapsed)
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)

    def close(self):
        """Release the capture device."""
        self._running = False
        if self._cap is not None:
            self._cap.release()
            self._cap = None
            logger.info("Video capture released")

    @property
    def buffer_size(self) -> int:
        """Number of frames in the rolling buffer window."""
        return int(self._actual_fps * self.buffer_seconds)

    @property
    def is_open(self) -> bool:
        return self._cap is not None and self._cap.isOpened()

    def __del__(self):
        self.close()
