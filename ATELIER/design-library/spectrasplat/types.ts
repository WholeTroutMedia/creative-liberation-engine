/**
 * SpectraSplat Spatial Director v7.0.0 Types Contract
 * 
 * Defines highly-rigorous mathematical interfaces for 3D Gaussian Splatting,
 * voxel grids, vector math coordinates, and camera path keyframe structures.
 * 
 * Strict alignment: Obsidian Void Cyber-Noir specifications.
 */

/**
 * Agnostic Vector 3 representation
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Agnostic Vector 4 representation (commonly used for homogeneous coordinates or colors)
 */
export interface Vector4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Quaternion for robust, gimbal-lock-free 3D rotations
 */
export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number; // Real component
}

/**
 * Matrix4 representing complete 3D spatial transformation (4x4 column-major or row-major)
 */
export type Matrix4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number
];

/**
 * Discrete voxel coordinate representation in 3D grid space
 */
export interface VoxelCoord {
  i: number;
  j: number;
  k: number;
}

/**
 * Extent bounding box representing space occupancy in global coordinate space
 */
export interface BoundingBox {
  min: Vector3;
  max: Vector3;
}

/**
 * Voxel Grid resolution specs and spatial boundaries
 */
export interface VoxelGridBounds {
  boundingBox: BoundingBox;
  resolution: VoxelCoord; // division count along X, Y, Z axes
  voxelSize: Vector3;    // physical scale dimension of a single voxel
  totalVoxelCount: number;
}

/**
 * Camera Projection mode: PERSPECTIVE (real-world convergence) or ORTHOGRAPHIC (isometric CAD projection)
 */
export type ProjectionMode = 'PERSPECTIVE' | 'ORTHOGRAPHIC';

/**
 * Viewport camera settings defining frustum projection geometry
 */
export interface CameraProperties {
  id: string;
  name: string;
  position: Vector3;
  target: Vector3;
  up: Vector3;
  quaternion: Quaternion;
  fov: number;             // Field of view in degrees (Perspective only)
  orthoScale: number;      // View size scaling (Orthographic only)
  nearPlane: number;       // Near clipping limit
  farPlane: number;        // Far clipping limit
  focalLength: number;     // Focal length in mm for cinematic dispersion
  aspectRatio: number;
  projectionMode: ProjectionMode;
}

/**
 * Type of interpolation mapping used to compute points between keyframes
 */
export type InterpolationType = 'LINEAR' | 'CATMULL_ROM' | 'CUBIC_BEZIER' | 'HERMITE' | 'STEP';

/**
 * Represent a single node or control point on a camera track
 */
export interface CameraKeyframe {
  id: string;
  timestamp: number;        // Time in seconds from path start
  position: Vector3;
  quaternion: Quaternion;
  fov: number;
  focalLength: number;
  interpolation: InterpolationType;
  tension?: number;         // For Hermite/Catmull-rom (0 = standard, 1 = tight, -1 = loose)
  bias?: number;            // For keyframe weight adjustments
}

/**
 * A named Camera Path Track for automated cinematic playback
 */
export interface CameraPathTrack {
  id: string;
  name: string;
  keyframes: CameraKeyframe[];
  loop: boolean;
  totalDuration: number;    // Cache duration in seconds
  colorCode: string;        // Hex code or visual anchor color (e.g. #00FFCC)
}

/**
 * 3D Gaussian Splat Cloud Metadata
 */
export interface SplatCloudMetadata {
  pointCount: number;
  boundingBox: BoundingBox;
  shDegree: number;          // Spherical Harmonics degree (0 to 3) representing view-dependent color details
  compressed: boolean;
  compressionFormat?: 'FLOAT16' | 'INT8' | 'NONE';
  averageDensity: number;    // Points per cubic meter
  diskSizeOctets: number;
}

/**
 * Render shading algorithms supported by SpectraSplat Renderer
 */
export type ShadingModel = 
  | 'GAUSSIAN_SPLAT'       // Standard ellipsoidal splats
  | 'VOXEL_METRIC'         // Quantized bounding voxel cubes
  | 'HYBRID_GRID'          // Blended voxel shells with splat details
  | 'DEPTH_MAP'            // Visualizing distance from frustum plane
  | 'SH_HARMONICS'         // Isolate view-dependent spherical harmonics data
  | 'NORMAL_VECTOR';       // Surface normal mapping from localized splat orientation

/**
 * Comprehensive global render viewport configurations
 */
export interface RenderSettings {
  shadingModel: ShadingModel;
  voxelSize: number;            // Voxel quantization size limit
  splatOpacity: number;         // Alpha scalar threshold
  exposure: number;             // Ambient exposure
  renderBudget: number;         // Max rendered points/voxels (e.g., 2,000,000)
  chromaticAberration: number;  // Spectral refraction effect intensity
  nearFarPlane: [number, number];
  pointScale: number;           // Size scalar of base splats
  enableBloom: boolean;
  enableVoxelGridOverlay: boolean;
}

/**
 * Telemetry and diagnostics updated per frame from active render pipeline
 */
export interface PipelineTelemetry {
  fps: number;
  activePointsCount: number;
  culledPointsCount: number;
  drawCallsCount: number;
  gpuMemoryUsageMb: number;
  voxelTraversalCount: number;
  selectedVoxelIndex?: VoxelCoord;
  isRecording: boolean;
  playbackState: 'PLAYING' | 'PAUSED' | 'STOPPED';
  currentTrackTime: number;
}
