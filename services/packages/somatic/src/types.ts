// Creative Liberation Engine Somatic Bridge — Type Definitions
// ARKit 52 blendshape protocol types for UE5 MetaHuman pipeline

/** All 52 ARKit blendshape names in canonical order */
export const ARKIT_BLENDSHAPES = [
  'eyeBlinkLeft', 'eyeBlinkRight', 'eyeSquintLeft', 'eyeSquintRight',
  'eyeWideLeft', 'eyeWideRight', 'eyeLookDownLeft', 'eyeLookDownRight',
  'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight',
  'eyeLookUpLeft', 'eyeLookUpRight', 'jawForward', 'jawLeft', 'jawRight',
  'jawOpen', 'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft',
  'mouthRight', 'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft',
  'mouthFrownRight', 'mouthDimpleLeft', 'mouthDimpleRight',
  'mouthStretchLeft', 'mouthStretchRight', 'mouthRollLower', 'mouthRollUpper',
  'mouthShrugLower', 'mouthShrugUpper', 'mouthPressLeft', 'mouthPressRight',
  'mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthUpperUpLeft',
  'mouthUpperUpRight', 'browDownLeft', 'browDownRight', 'browInnerUp',
  'browOuterUpLeft', 'browOuterUpRight', 'cheekPuff', 'cheekSquintLeft',
  'cheekSquintRight', 'noseSneerLeft', 'noseSneerRight', 'tongueOut',
] as const;

export type ARKitBlendshapeName = typeof ARKIT_BLENDSHAPES[number];

/** A single frame of 52 blendshape weights (0.0 - 1.0) */
export interface BlendshapeFrame {
  /** 52 float values in ARKIT_BLENDSHAPES order */
  weights: number[];
  /** Timestamp in ms (from Audio2Face or local clock) */
  timestamp?: number;
  /** Optional named map for debugging */
  named?: Partial<Record<ARKitBlendshapeName, number>>;
}

/** Head rotation in radians */
export interface HeadRotation {
  yaw: number;
  pitch: number;
  roll: number;
}

/** Eye gaze direction */
export interface EyeGaze {
  leftYaw: number;
  leftPitch: number;
  rightYaw: number;
  rightPitch: number;
}

/** Bridge configuration */
export interface BridgeConfig {
  /** UE5 host IP */
  ue5Host: string;
  /** UE5 OSC listen port */
  ue5OscPort: number;
  /** Port this bridge listens on for incoming blendshape data */
  listenPort: number;
  /** Target frames per second for OSC output */
  targetFps: number;
  /** OSC address for blendshape data */
  blendshapeAddress: string;
  /** OSC address for head rotation */
  headRotationAddress: string;
  /** OSC address for eye gaze */
  eyeGazeAddress: string;
}

/** Audio2Face response payload */
export interface Audio2FaceResponse {
  blendshapes: number[];
  head_rotation?: [number, number, number];
  eye_gaze?: [number, number, number, number];
  timestamp: number;
}

/** Bridge statistics */
export interface BridgeStats {
  frameCount: number;
  framesEmitted: number;
  framesDropped: number;
  elapsed: number;
  averageFps: number;
  currentFps: number;
  targetFps: number;
  queueDepth: number;
  uptime: number;
}
