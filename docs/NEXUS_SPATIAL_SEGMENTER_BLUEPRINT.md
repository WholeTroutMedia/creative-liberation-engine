# MASTER ARCHITECTURAL BLUEPRINT
## System: NEXUS Real-Time Spatial Segmenter & Node-Graph Animation Engine (IE-HRT-080)
**Version:** 1.0.0  
**Status:** PROPOSED / PLAN  
**Lead Architects:** ATHENA (Creative Director), VERA (Quality Control), IRIS (Systems Integrator)  
**Target Root:** `services/spatial-surface/`

---

## 1. Executive Summary & Sovereignty Mandate

The **NEXUS Real-Time Spatial Segmenter & Node-Graph Animation Engine (IE-HRT-080)** is a foundational visual-spatial primitive within the Creative Liberation Engine. It bridges physical stage/studio telemetry, multi-camera live video (NDI), and volumetric venue digital twins (Gaussian Splatting) into a unified, high-performance visual instrument. 

Unlike industry-standard workflows that rely on disjointed, commercial, and fragmented tools (such as Unreal Engine blueprints coupled with heavy proprietary visual tracking suites), IE-HRT-080 establishes an entirely **self-sovereign, browser-first spatial system** run on our private Synology NAS node. The engine allows creative operators to isolate any physical object in a live-captured environment (such as a performer, camera crane, or set piece) and physically bind its motion, transformation, or visual properties directly to local hardware controllers (MIDI, OSC) or edge-sensing devices (ZigSim, smart glasses HUD feeds) via an interactive, floating glassmorphism node-graph interface.

Every core design choice is governed by the AVERI Sovereignty Mandate: **"Does this make artists more free or less free?"** By enabling real-time volumetric segmentation and telemetry binding without expensive hardware lock-in, we liberate artists from proprietary render and tracking suites.

---

## 2. Integrated Core Technologies

The architecture of IE-HRT-080 leverages and unifies four key technical primitives:

### A. Vision Banana (Generative Perception Core — IE-IDX-0065)
We implement the "perception-as-image-generation" paradigm. Instead of running segmented specialist models (e.g. SAM 3, Depth Anything V3) with separate heads that saturate memory buses, we utilize an instruction-tuned unified visual intelligence core. Running in local Docker containers on the NAS, the model takes decoded live NDI camera frames and returns highly aligned 2D instance segmentation masks and metric depth estimations in a single, high-speed unified inference pass.

### B. SuperSplat (Volumetric Point Manipulation — IE-IDX-0270)
SuperSplat serves as the baseline for high-performance, client-side Gaussian Splatting editing and rendering. The WebGPU-based splat editor is integrated into the `surfaces/spatial-os` viewport. It handles `.ply` and `.splat` files, providing interactive scaling, rotation, density adjustment, and boundary pruning directly inside the browser.

### C. TrackCraft3R (Dense 3D Tracking — IE-IDX-0197)
For dynamic dynamic scene tracking, we repurpose Video Diffusion Transformers. Rather than mapping bounding boxes or skeletal markers, TrackCraft3R tracks thousands of individual points across monocular NDI video frames. This creates a dense 3D motion vector field representing the movements of segmented bodies and props, translating raw video streams into live telemetry tracks.

---

## 3. High-Performance Volumetric Segmentation Pipeline

To layer real-time 3D segmentation over Gaussian Splats and live camera feeds, we establish a **Backprojected Multi-View Voxel Clustering Pipeline**:

### Step 1: Calibration & Camera Alignment (PnP Solver)
The position and orientation of active NDI video feeds are registered within the `spatial-os` digital twin coordinate system. The camera pose is calculated by solving the Perspective-n-Point (PnP) problem using key static feature markers in the Gaussian Splat scene, establishing a coordinate-accurate projection matrix ($P = K[R|t]$) for each camera.

### Step 2: 2D-to-3D Mask Backprojection
For every incoming frame on the NDI feed:
1. The **Vision Banana** container generates a semantic mask ($M_{2D}$) and a metric depth map ($D$).
2. For each pixel $(u, v)$ classified in the mask, a ray is cast from the camera's optical center.
3. The depth map defines the precise 3D boundary coordinate ($X_{3D}$) of the object along that ray:
   $$X_{3D} = R^T \cdot (K^{-1} \cdot \begin{bmatrix} u \\ v \\ 1 \end{bmatrix} \cdot D - t)$$

### Step 3: Voxel-Grid Splat Clustering
We assign the backprojected 3D semantic coordinate points into a spatial octree voxel structure. The Gaussian Splat kernels (individual splat points containing covariance, opacity, spherical harmonics, and position) are queried. If a Gaussian kernel falls within the segmented voxel grid, it is statistically labeled with the corresponding `SemanticID`. 
To ensure spatial stability and prevent flickering from mask inaccuracies, we apply a **Temporal Voting Filter**: a Gaussian kernel is only reassigned to a new Segment ID if it receives consistent semantic votes across five consecutive frames.

---

## 4. Render-Time Splat Manipulation (Zero-CPU Bottleneck)

Animating Gaussian Splats by mutating their coordinates on the CPU is computationally prohibitive, dropping framerates below interactive thresholds. To achieve 90+ FPS on edge devices, IE-HRT-080 uses a **Dynamic WebGPU Uniform Buffer Array Pipeline**:

1. **Vertex Buffer Extension:** During ingestion, the `.ply` Gaussian Splat dataset is converted to a custom binary format (`.nxs`). We inject a new 16-bit integer attribute `a_SemanticID` into each vertex representing the segmented object group.
2. **WebGPU Uniform Arrays:** We allocate a uniform buffer holding an array of 256 transformation matrices (representing the active segment slots):
   ```wgsl
   struct SegmentTransform {
       modelMatrix: mat4x4<f32>,
       colorOverride: vec4<f32>,
       opacityMultiplier: f32,
       padding: f32,
   }
   @group(0) @binding(1) var<uniform> segmentTransforms: array<SegmentTransform, 256>;
   ```
3. **Vertex Shader Execution:** In the rendering pass, the custom WebGPU vertex shader queries the matrix mapped to the point's semantic attribute:
   ```wgsl
   let transform = segmentTransforms[u32(input.a_SemanticID)];
   let localPosition = transform.modelMatrix * vec4<f32>(input.a_Position, 1.0);
   ```
This architecture allows the CPU to upload only a small array of matrices to the GPU once per frame, enabling instantaneous translation, rotation, scaling, and colorization of millions of volumetric points.

---

## 5. Spatial UX & Floating Node-Graph Paradigm

The interface layer in NEXUS is styled in **brutalist glassmorphism**, running on React-Three-Fiber and Drei. The viewport displays the venue twin backdrop with floating panel overlays:

* **Interactive Segmentation Picker:** The artist enters "Segment Mode". Hovering over the viewport highlights semantic splat boundaries in cyan. Double-clicking an object isolates the splat group, generating a floating **Splat Segment Node** in the spatial UI.
* **Connecting Telemetry Nodes:** The artist right-clicks in the spatial viewport to spawn a **Telemetry Input Node** (e.g. mapping an active WebSocket stream from `services/spatial-surface` like smart glasses telemetry, OSC, MIDI, or a ZigSim gyro).
* **Bézier Binding Splines:** The artist drags an interactive, glowing spline connector from the output plug of the Telemetry Input Node to the input channel of the Splat Segment Node (e.g., binding accelerometer `accel.x` to the splat's `translation.x`).
* **Active Signal Feedbacks:** When a signal is firing, the connector spline pulses with neon particles flowing from the source to the target node. The velocity of the particle flow corresponds to the signal's frequency or value intensity.

---

## 6. Implementation Roadmap

Aligned with `docs/ROADMAP.md`, the integration will follow a four-tier deployment schedule:

* **PHASE 1: Viewport & Splat Isolation (Next 2 Sprints)**
  * Unify `surfaces/spatial-os` and `apps/nexus-canvas` viewport engines.
  * Implement PlayCanvas SuperSplat editor inside the unified React-Three-Fiber shell.
  * Integrate custom binary `.nxs` Gaussian Splat converter with custom `a_SemanticID` vertex attributes.
* **PHASE 2: Segmentation Ingest (Next 3 Sprints)**
  * Spin up the local **Vision Banana** Docker container on the Synology NAS.
  * Wire live NDI capture decoding to the Vision Banana REST/WebSocket pipeline.
  * Build the Raycast voxel backprojection engine to group splats into unique semantic indexes.
* **PHASE 3: Tracking & Telemetry (Next 2 Sprints)**
  * Mount the **TrackCraft3R** microservice on NAS.
  * Map dense 3D point tracking streams into the `services/spatial-surface` active connection registry.
  * Implement the WebGPU Dynamic Uniform Buffer shader mapping in `spatial-os`.
* **PHASE 4: Node-Graph UX & Visualizer (Next 3 Sprints)**
  * Mount the React-based glassmorphism spatial node-graph overlay.
  * Establish WebSocket event mapping to load-and-compile bindings against `nexus.telemetry-binding.schema.json`.
  * Deliver the complete live venue performance dashboard.
