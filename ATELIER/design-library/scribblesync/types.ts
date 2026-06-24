/**
 * SCRIBBLESYNC CONTRACT SPECIFICATION v7.0.0
 * 
 * Bespoke TypeScript contract definitions for the ScribbleSync Storyboarder App.
 * These interfaces enforce rigid, complete data structures for storyboard creation,
 * frame-by-frame drawings/layers, camera movement vectors, and media syncing.
 */

/**
 * Basic 3D Coordinate Point for Spatial Camera Coordinates
 */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Basic 3D Rotation Point for Camera Angles
 */
export interface Rotation3D {
  pitch: number; // Rotation around X axis (tilt)
  yaw: number;   // Rotation around Y axis (pan)
  roll: number;  // Rotation around Z axis (roll)
}

/**
 * Interpolation types supported by the ScribbleSync camera engine
 */
export type InterpolationType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'cubic-bezier' | 'step';

/**
 * Control point coordinates for standard cubic bezier mappings
 */
export interface BezierControlPoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Camera Path Keyframe. Defines a specific camera pose in time.
 */
export interface CameraKeyframe {
  id: string;
  /**
   * Time percentage offset within the frame duration. Must be between 0.0 and 1.0.
   */
  timeOffset: number;
  position: Point3D;
  rotation: Rotation3D;
  /**
   * Lens zoom level. 1.0 is default, higher numbers zoom in, lower numbers zoom out.
   */
  zoom: number;
  interpolation: InterpolationType;
  bezierControls?: BezierControlPoints;
}

/**
 * Camera Path Contract. Defines a complete camera movement pattern within a frame.
 */
export interface CameraPath {
  id: string;
  name: string;
  keyframes: CameraKeyframe[];
  /**
   * If true, the camera returns to the first keyframe position after the last keyframe.
   */
  isLooping: boolean;
  /**
   * Calculated duration of camera path in milliseconds. Matches or scales to the frame's duration.
   */
  durationMs: number;
}

/**
 * Valid types for drawing and design layers
 */
export type LayerType = 'background' | 'character' | 'scribble' | 'overlay' | 'text' | 'ref-asset';

/**
 * Vector drawing point for canvas-based strokes
 */
export interface DrawingPoint {
  x: number;
  y: number;
  pressure: number;
  timeOffsetMs: number;
}

/**
 * Stylized Scribble Stroke Path
 */
export interface ScribbleStroke {
  id: string;
  points: DrawingPoint[];
  color: string;
  strokeWidth: number;
}

/**
 * Drawing Layer Contract. Manages overlays, strokes, text labels, and generative backdrops.
 */
export interface DrawingLayer {
  id: string;
  name: string;
  type: LayerType;
  opacity: number;
  isVisible: boolean;
  /**
   * Z-Index index of the layer, where larger numbers sit on top of smaller numbers.
   */
  zIndex: number;
  /**
   * Canvas sketch paths. Populated if type is 'scribble' or 'character'.
   */
  strokes?: ScribbleStroke[];
  /**
   * Reference external URL for high-fidelity generative baselines.
   */
  assetUrl?: string;
  /**
   * Vector transform properties for visual manipulation
   */
  transform?: {
    translateX: number;
    translateY: number;
    scale: number;
    rotate: number;
  };
  /**
   * Any overlay text blocks (e.g. subtitles, caption highlights, sound effect labels)
   */
  textOverlay?: {
    content: string;
    positionX: number;
    positionY: number;
    fontSize: number;
    fontFamily: 'heading' | 'body' | 'mono';
    color: string;
  };
}

/**
 * Synchronized Audio Track Contract for dialogue, ambient sound, or music cues.
 */
export interface AudioTrack {
  id: string;
  url: string;
  name: string;
  volume: number;
  durationMs: number;
  /**
   * Audio start offset relative to the beginning of the frame in milliseconds.
   */
  startOffsetMs: number;
  /**
   * Dialogue transcript mapping for automated subtitling
   */
  captionText?: string;
  /**
   * Sound effect trigger identifier
   */
  isSoundEffect: boolean;
}

/**
 * Active Frame Contract. Represents a single sequence / canvas inside the storyboard.
 */
export interface ActiveFrame {
  id: string;
  storyboardId: string;
  /**
   * Index positioning of the frame in the storyboard sequence.
   */
  sequenceNumber: number;
  title: string;
  description: string;
  /**
   * Generative prompt used to synthesize the underlying asset.
   */
  imagePrompt?: string;
  /**
   * Final rendered visual image representation of this frame.
   */
  imageUrl?: string;
  /**
   * Active duration of this frame in milliseconds.
   */
  durationMs: number;
  /**
   * Prevent edits by lock toggling.
   */
  isLocked: boolean;
  /**
   * Layer stack representing the frame composition.
   */
  layers: DrawingLayer[];
  /**
   * Active camera movement path for interactive viewport panning.
   */
  cameraPath?: CameraPath;
  /**
   * Synchronized audio elements mapped to this frame.
   */
  audioTrack?: AudioTrack;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  /**
   * Grid alignment offset for storyboard preview layouts.
   */
  aspectRatioOverride?: '16:9' | '9:16' | '1:1' | '2.39:1';
}

/**
 * Storyboard Contract. Root container holding frame collections, global audio tracks, and meta configurations.
 */
export interface Storyboard {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  teamId?: string;
  /**
   * Target canvas ratio for visual rendering.
   */
  aspectRatio: '16:9' | '9:16' | '1:1' | '2.39:1';
  /**
   * Framerate mapping for exported rendering.
   */
  targetFps: number;
  version: string;
  tags: string[];
  /**
   * Set of chronological frames.
   */
  frames: ActiveFrame[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * Custom key-value variables passed to downstream compilation scripts.
   */
  metadata?: Record<string, any>;
}
