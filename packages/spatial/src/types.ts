/**
 * @cle/spatial — Type definitions
 * Spline-powered interactive 3D toolkit for the Creative Liberation Engine
 */

import type { Application as SplineApplication } from '@splinetool/runtime';

/** Event types supported by Spline scenes */
export type SplineEventType = 'mouseDown' | 'mouseUp' | 'mouseHover' | 'keyDown' | 'keyUp' | 'scroll' | 'lookAt';

/** Spline variable value types */
export type SplineVariableValue = string | number | boolean;

/** Callback when Spline app loads */
export type SplineLoadHandler = (splineApp: SplineApplication) => void;

/** Base configuration for Spline scene components */
export interface SplineSceneConfig {
  /** URL to the Spline scene (.splinecode file URL or Spline CDN URL) */
  scene: string;
  /** CSS class name */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
  /** Callback when the Spline scene finishes loading */
  onLoad?: SplineLoadHandler;
  /** Callback on load error */
  onError?: (error: Error) => void;
}

/** Props for the SplineScene component */
export interface SplineSceneProps extends SplineSceneConfig {
  /** Width of the scene container */
  width?: number | string;
  /** Height of the scene container */
  height?: number | string;
  /** Whether to render on a transparent background */
  transparent?: boolean;
  /** Accessible label for the 3D scene */
  'aria-label'?: string;
}

/** Props for the SplineHero component */
export interface SplineHeroProps extends SplineSceneConfig {
  /** Minimum height of the hero section */
  minHeight?: number | string;
  /** Whether to make the hero section full viewport height */
  fullScreen?: boolean;
  /** Overlay content rendered on top of the Spline scene */
  children?: React.ReactNode;
  /** Overlay gradient direction */
  overlayGradient?: 'top' | 'bottom' | 'both' | 'none';
  /** Overlay gradient color (defaults to black) */
  overlayColor?: string;
  /** Overlay gradient opacity (0-1) */
  overlayOpacity?: number;
  /** Accessible label */
  'aria-label'?: string;
}

/** Re-export the Spline Application type for consumers */
export type { SplineApplication };
