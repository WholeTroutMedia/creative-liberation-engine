/**
 * @cle/spatial — Barrel exports
 * Spline-powered interactive 3D toolkit for the Creative Liberation Engine
 * 10 components total
 */

// ── Types ──────────────────────────────────────────────────────
export type {
  SplineEventType,
  SplineVariableValue,
  SplineLoadHandler,
  SplineSceneConfig,
  SplineSceneProps,
  SplineHeroProps,
  SplineApplication,
} from './types.js';

// ── Scene Components ───────────────────────────────────────────
export { SplineScene } from './components/SplineScene.js';
export { SplineHero } from './components/SplineHero.js';

// ── Layout Components ──────────────────────────────────────────
export { SplineBackground } from './components/SplineBackground.js';
export type { SplineBackgroundProps } from './components/SplineBackground.js';

export { SplineFloat } from './components/SplineFloat.js';
export type { SplineFloatProps } from './components/SplineFloat.js';

// ── Interactive Components ─────────────────────────────────────
export { SplineCard } from './components/SplineCard.js';
export type { SplineCardProps } from './components/SplineCard.js';

export { SplinePortal } from './components/SplinePortal.js';
export type { SplinePortalProps } from './components/SplinePortal.js';

export { SplineButton } from './components/SplineButton.js';
export type { SplineButtonProps, SplineButtonVariant, SplineButtonSize } from './components/SplineButton.js';

// ── Text & Typography ──────────────────────────────────────────
export { SplineText } from './components/SplineText.js';
export type { SplineTextProps, SplineTextEffect } from './components/SplineText.js';

// ── UX Layer Components ────────────────────────────────────────
export { SplineCursor } from './components/SplineCursor.js';
export type { SplineCursorProps, CursorVariant } from './components/SplineCursor.js';

export { SplineLoader } from './components/SplineLoader.js';
export type { SplineLoaderProps } from './components/SplineLoader.js';

// ── ArrowJS Dynamic UIs ────────────────────────────────────────
export { ArrowJSBuilder } from './arrow.js';
export type { ArrowJSPageOptions } from './arrow.js';
