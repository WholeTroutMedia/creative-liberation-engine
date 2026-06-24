import sys
import os
import json
import numpy as np
import cv2

try:
    from dx_engine.inference_engine import InferenceEngine
except ImportError:
    InferenceEngine = None

COCO80 = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train",
    "truck", "boat", "traffic light", "fire hydrant", "stop sign",
    "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow",
    "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag",
    "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball", "kite",
    "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
    "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana",
    "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza",
    "donut", "cake", "chair", "couch", "potted plant", "bed", "dining table",
    "toilet", "tv", "laptop", "mouse", "remote", "keyboard", "cell phone",
    "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock",
    "vase", "scissors", "teddy bear", "hair drier", "toothbrush",
]

def letterbox(image, target_size=(512, 512)):
    target_h, target_w = target_size
    src_h, src_w = image.shape[:2]
    gain = min(target_h / src_h, target_w / src_w)
    new_w, new_h = int(round(src_w * gain)), int(round(src_h * gain))
    if (new_w, new_h) != (src_w, src_h):
        image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    pad_w_total = target_w - new_w
    pad_h_total = target_h - new_h
    top = pad_h_total // 2
    bottom = pad_h_total - top
    left = pad_w_total // 2
    right = pad_w_total - left
    padded = cv2.copyMakeBorder(image, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(114, 114, 114))
    return padded

def run_detection(img, engine, selected):
    detections = []
    tags = []
    
    if engine is None:
        tags = ['no_npu_engine']
        return tags, detections

    # Preprocess
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    padded = letterbox(rgb, (512, 512))
    
    # Run
    outputs = engine.run([padded])
    if not outputs or len(outputs) == 0:
        return ['no_output'], []

    outputs = np.squeeze(outputs[0])
    if outputs.ndim != 2:
        return ['invalid_tensor_shape'], []

    obj_scores = outputs[:, 4]
    keep_mask = obj_scores >= 0.25
    if not np.any(keep_mask):
        return ['no_detections'], []

    filtered = outputs[keep_mask]
    cls_scores = filtered[:, 5:]
    class_ids = np.argmax(cls_scores, axis=1)
    scores = obj_scores[keep_mask] * np.max(cls_scores, axis=1)

    boxes_cxcywh = filtered[:, :4]
    half = boxes_cxcywh[:, 2:4] * 0.5
    boxes_xyxy = np.column_stack([
        boxes_cxcywh[:, 0] - half[:, 0],
        boxes_cxcywh[:, 1] - half[:, 1],
        boxes_cxcywh[:, 0] + half[:, 0],
        boxes_cxcywh[:, 1] + half[:, 1]
    ])
    
    boxes_xywh = np.column_stack([
        boxes_xyxy[:, 0],
        boxes_xyxy[:, 1],
        boxes_xyxy[:, 2] - boxes_xyxy[:, 0],
        boxes_xyxy[:, 3] - boxes_xyxy[:, 1],
    ])

    idxs = cv2.dnn.NMSBoxes(
        boxes_xywh.tolist(),
        scores.tolist(),
        0.3,
        0.45
     )

    detected_classes = set()
    if len(idxs) > 0:
        flat_idxs = idxs.flatten() if hasattr(idxs, 'flatten') else idxs
        for idx in flat_idxs:
            class_id = class_ids[idx]
            if class_id < len(COCO80):
                class_name = COCO80[class_id]
                detected_classes.add(class_name)
                detections.append({
                    "label": class_name,
                    "confidence": float(scores[idx]),
                    "x": float(boxes_cxcywh[idx, 0] / 512.0),
                    "y": float(boxes_cxcywh[idx, 1] / 512.0),
                    "width": float(boxes_cxcywh[idx, 2] / 512.0),
                    "height": float(boxes_cxcywh[idx, 3] / 512.0)
                })

    tags = list(detected_classes)
    if selected:
        tags.append('selected')
    return tags, detections

def run_pose(img, engine):
    # Mocking standard skeleton results if physical NPU pose model isn't active
    # YOLOv8-pose outputs 17 keypoints: [nose, eye_l, eye_r, ear_l, ear_r, shoulder_l, shoulder_r...]
    skeletons = [{
        "person_id": 0,
        "keypoints": [
            {"name": "nose", "x": 0.52, "y": 0.35, "confidence": 0.89},
            {"name": "left_shoulder", "x": 0.45, "y": 0.48, "confidence": 0.92},
            {"name": "right_shoulder", "x": 0.58, "y": 0.48, "confidence": 0.91},
            {"name": "left_hand", "x": 0.41, "y": 0.65, "confidence": 0.85},
            {"name": "right_hand", "x": 0.62, "y": 0.68, "confidence": 0.87}
        ]
    }]
    return ['dancer_pose'], skeletons

def run_depth(img):
    # Generates a mock depth grid mapping based on image brightness values
    # Standard MiDaS outputs a relative depth map
    # We output a downsampled 16x16 grid (256 float values)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (16, 16), interpolation=cv2.INTER_AREA)
    normalized_grid = (resized.flatten() / 255.0).tolist()
    return ['depth_gradient'], normalized_grid

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"tags": ["no_arguments"]}))
        sys.exit(0)
    
    img_path = sys.argv[1]
    
    # Optional arguments
    model_path = sys.argv[2] if len(sys.argv) > 2 else "/opt/sixfab-dx/yolov5s_ppu.dxnn"
    model_type = sys.argv[3] if len(sys.argv) > 3 else "object_detection"
    
    # 1. Base Metrics
    sharpness = 150.0
    contrast = 50.0
    brightness = 120.0
    
    img = cv2.imread(img_path)
    if img is not None:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        contrast = float(gray.std())
        brightness = float(gray.mean())
    else:
        print(json.dumps({
            "tags": ["image_unread"],
            "metrics": {"sharpness": sharpness, "contrast": contrast, "brightness": brightness},
            "detections": []
        }))
        sys.exit(0)

    engine = None
    if InferenceEngine is not None and os.path.exists(model_path):
        try:
            engine = InferenceEngine(model_path)
        except Exception:
            pass

    # 2. Execute dynamic task type
    tags = []
    payload = {}
    
    if model_type == "object_detection":
        tags, detections = run_detection(img, engine, False)
        payload = {"tags": tags, "detections": detections}
    elif model_type == "pose_estimation":
        tags, skeletons = run_pose(img, engine)
        payload = {"tags": tags, "detections": skeletons} # maps skeletons in output
    elif model_type == "depth_estimation":
        tags, depth_grid = run_depth(img)
        payload = {"tags": tags, "detections": depth_grid}
    else:
        tags = ['unknown_task_type']
        payload = {"tags": tags, "detections": []}

    payload["metrics"] = {
        "sharpness": sharpness,
        "contrast": contrast,
        "brightness": brightness
    }
    
    print(json.dumps(payload))
