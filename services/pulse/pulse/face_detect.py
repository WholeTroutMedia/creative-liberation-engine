"""
PULSE — Face Detection & ROI Extraction

Uses MediaPipe Face Mesh (468 landmarks) to detect faces and extract
regions of interest (ROI) for rPPG signal extraction. Supports multiple
ROI strategies: forehead, cheeks, full face, and multi-ROI fusion.
"""

import cv2
import numpy as np
import mediapipe as mp
import logging
from dataclasses import dataclass, field
from typing import Optional, List, Tuple

logger = logging.getLogger("pulse.face_detect")

# ─── MediaPipe Face Mesh landmark indices for ROI regions ───
# These indices define skin-dominant regions optimal for rPPG
FOREHEAD_LANDMARKS = [
    10, 67, 69, 104, 108, 109, 151, 338, 337, 297, 299, 333
]
LEFT_CHEEK_LANDMARKS = [
    50, 101, 116, 117, 118, 119, 123, 187, 192, 196, 203, 206, 207, 216
]
RIGHT_CHEEK_LANDMARKS = [
    280, 330, 345, 346, 347, 348, 352, 411, 416, 420, 423, 426, 427, 436
]
NOSE_BRIDGE_LANDMARKS = [
    6, 122, 168, 197, 351, 419
]


@dataclass
class ROIRegion:
    """A region of interest extracted from a face."""
    name: str
    pixels: np.ndarray          # (N, 3) array of RGB pixel values
    mask: np.ndarray            # Binary mask of the region
    bbox: Tuple[int, int, int, int]  # (x, y, w, h)
    center: Tuple[int, int]     # Center point
    confidence: float           # Detection confidence


@dataclass
class FaceDetection:
    """Complete face detection result for a single frame."""
    detected: bool
    face_bbox: Optional[Tuple[int, int, int, int]] = None
    rois: List[ROIRegion] = field(default_factory=list)
    landmarks: Optional[np.ndarray] = None
    confidence: float = 0.0

    @property
    def mean_rgb(self) -> Optional[np.ndarray]:
        """Mean RGB across all ROIs — the primary rPPG input signal."""
        if not self.rois:
            return None
        all_pixels = np.concatenate([roi.pixels for roi in self.rois], axis=0)
        return np.mean(all_pixels, axis=0)  # (3,) — [R, G, B]


class FaceDetector:
    """
    MediaPipe Face Mesh based face detector and ROI extractor.
    Extracts skin-dominant regions for rPPG signal analysis.
    """

    def __init__(self, config: dict):
        self.min_detection_confidence = config.get("min_detection_confidence", 0.7)
        self.min_tracking_confidence = config.get("min_tracking_confidence", 0.5)
        self.roi_strategy = config.get("roi_strategy", "multi_roi")
        self.refine_landmarks = config.get("refine_landmarks", True)

        # Initialize MediaPipe Face Mesh
        self._mp_face_mesh = mp.solutions.face_mesh
        self._face_mesh = self._mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=self.refine_landmarks,
            min_detection_confidence=self.min_detection_confidence,
            min_tracking_confidence=self.min_tracking_confidence,
        )

        logger.info(
            f"Face detector initialized: strategy={self.roi_strategy}, "
            f"det_conf={self.min_detection_confidence}, "
            f"track_conf={self.min_tracking_confidence}"
        )

    def detect(self, frame: np.ndarray) -> FaceDetection:
        """
        Detect face and extract ROI regions from a BGR frame.

        Args:
            frame: BGR image from OpenCV (H, W, 3)

        Returns:
            FaceDetection with ROIs containing skin pixel samples
        """
        h, w, _ = frame.shape
        # MediaPipe expects RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        results = self._face_mesh.process(rgb_frame)

        if not results.multi_face_landmarks:
            return FaceDetection(detected=False)

        face_landmarks = results.multi_face_landmarks[0]

        # Convert normalized landmarks to pixel coordinates
        landmarks_px = np.array([
            (int(lm.x * w), int(lm.y * h))
            for lm in face_landmarks.landmark
        ])

        # Compute face bounding box from landmarks
        x_min, y_min = landmarks_px.min(axis=0)
        x_max, y_max = landmarks_px.max(axis=0)
        face_bbox = (x_min, y_min, x_max - x_min, y_max - y_min)

        # Extract ROIs based on strategy
        rois = self._extract_rois(rgb_frame, landmarks_px)

        return FaceDetection(
            detected=True,
            face_bbox=face_bbox,
            rois=rois,
            landmarks=landmarks_px,
            confidence=1.0,  # MediaPipe doesn't expose per-frame confidence easily
        )

    def _extract_rois(
        self, rgb_frame: np.ndarray, landmarks: np.ndarray
    ) -> List[ROIRegion]:
        """Extract ROI regions based on the configured strategy."""
        if self.roi_strategy == "forehead":
            return [self._extract_region(rgb_frame, landmarks, FOREHEAD_LANDMARKS, "forehead")]
        elif self.roi_strategy == "cheeks":
            return [
                self._extract_region(rgb_frame, landmarks, LEFT_CHEEK_LANDMARKS, "left_cheek"),
                self._extract_region(rgb_frame, landmarks, RIGHT_CHEEK_LANDMARKS, "right_cheek"),
            ]
        elif self.roi_strategy == "full_face":
            all_landmarks = (
                FOREHEAD_LANDMARKS + LEFT_CHEEK_LANDMARKS +
                RIGHT_CHEEK_LANDMARKS + NOSE_BRIDGE_LANDMARKS
            )
            return [self._extract_region(rgb_frame, landmarks, all_landmarks, "full_face")]
        elif self.roi_strategy == "multi_roi":
            return [
                self._extract_region(rgb_frame, landmarks, FOREHEAD_LANDMARKS, "forehead"),
                self._extract_region(rgb_frame, landmarks, LEFT_CHEEK_LANDMARKS, "left_cheek"),
                self._extract_region(rgb_frame, landmarks, RIGHT_CHEEK_LANDMARKS, "right_cheek"),
            ]
        else:
            raise ValueError(f"Unknown ROI strategy: {self.roi_strategy}")

    def _extract_region(
        self,
        rgb_frame: np.ndarray,
        landmarks: np.ndarray,
        landmark_indices: List[int],
        name: str,
    ) -> ROIRegion:
        """Extract a single ROI region from landmark indices."""
        h, w, _ = rgb_frame.shape
        points = landmarks[landmark_indices]

        # Create convex hull from landmark points
        hull = cv2.convexHull(points)

        # Create binary mask
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillConvexPoly(mask, hull, 255)

        # Extract pixels within the mask
        pixels = rgb_frame[mask == 255]

        # Bounding box of the hull
        x, y, bw, bh = cv2.boundingRect(hull)

        # Center
        cx = x + bw // 2
        cy = y + bh // 2

        # Confidence based on pixel count (more pixels = better signal)
        expected_pixels = bw * bh * 0.6  # ~60% fill expected
        pixel_confidence = min(1.0, len(pixels) / max(expected_pixels, 1))

        return ROIRegion(
            name=name,
            pixels=pixels,
            mask=mask,
            bbox=(x, y, bw, bh),
            center=(cx, cy),
            confidence=pixel_confidence,
        )

    def close(self):
        """Release MediaPipe resources."""
        self._face_mesh.close()
        logger.info("Face detector closed")

    def __del__(self):
        self.close()
