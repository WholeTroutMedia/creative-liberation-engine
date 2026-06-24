/**
 * @cle/motion — Type definitions
 * Lottie-powered motion design system for the Creative Liberation Engine
 */

/** Supported animation source — URL string or imported .lottie/.json path */
export type AnimationSource = string;

/** Playback mode for animations */
export type PlayMode = 'normal' | 'reverse' | 'bounce' | 'reverse-bounce';

/** Animation fit within its container */
export type AnimationFit = 'contain' | 'cover' | 'fill' | 'fit-width' | 'fit-height' | 'none';

/** Theme mode for theme-aware animations */
export type ThemeMode = 'light' | 'dark' | 'auto';

/** Base configuration shared across all motion components */
export interface MotionConfig {
  /** Animation source URL or path to .lottie/.json file */
  src: AnimationSource;
  /** Whether to autoplay the animation */
  autoplay?: boolean;
  /** Whether to loop the animation */
  loop?: boolean;
  /** Playback speed multiplier (1.0 = normal) */
  speed?: number;
  /** Play mode */
  mode?: PlayMode;
  /** How the animation fits its container */
  fit?: AnimationFit;
  /** Background color override */
  backgroundColor?: string;
  /** CSS class name */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
  /** Theme mode for theme-aware animations */
  themeMode?: ThemeMode;
  /** Callback when animation completes (non-looping) */
  onComplete?: () => void;
  /** Callback when animation loads */
  onLoad?: () => void;
  /** Callback on animation load error */
  onError?: (error: Error) => void;
}

/** Props for the base IEAnimation component */
export interface IEAnimationProps extends MotionConfig {
  /** Width of the animation container */
  width?: number | string;
  /** Height of the animation container */
  height?: number | string;
  /** Accessible label */
  'aria-label'?: string;
}

/** Preset animation variants for IELoader */
export type LoaderVariant = 'pulse' | 'orbit' | 'wave' | 'morph' | 'default';

/** Props for the IELoader component */
export interface IELoaderProps {
  /** Visual variant of the loader */
  variant?: LoaderVariant;
  /** Size in pixels (applies to both width and height) */
  size?: number;
  /** Primary color override */
  color?: string;
  /** Accessible label */
  label?: string;
  /** CSS class name */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
}

/** Preset success animation variants */
export type SuccessVariant = 'checkmark' | 'confetti' | 'sparkle' | 'default';

/** Props for the IESuccess component */
export interface IESuccessProps {
  /** Visual variant of the success animation */
  variant?: SuccessVariant;
  /** Size in pixels */
  size?: number;
  /** Primary color override */
  color?: string;
  /** Auto-dismiss after this many milliseconds (0 = never) */
  autoDismissMs?: number;
  /** Callback when animation completes or is dismissed */
  onDismiss?: () => void;
  /** Accessible label */
  label?: string;
  /** CSS class name */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
}

/** Props for the IEEmptyState component */
export interface IEEmptyStateProps {
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Custom animation source (overrides built-in) */
  animationSrc?: AnimationSource;
  /** Animation size in pixels */
  animationSize?: number;
  /** Action button label */
  actionLabel?: string;
  /** Action button callback */
  onAction?: () => void;
  /** CSS class name */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
}

/** Transition type for IETransition */
export type TransitionType = 'fade' | 'slide-up' | 'slide-down' | 'scale' | 'blur';

/** Props for the IETransition component */
export interface IETransitionProps {
  /** Whether the children are visible */
  show: boolean;
  /** Transition type */
  type?: TransitionType;
  /** Duration in milliseconds */
  duration?: number;
  /** Delay before transition starts in milliseconds */
  delay?: number;
  /** Children to wrap */
  children: React.ReactNode;
  /** CSS class name */
  className?: string;
  /** Inline style overrides */
  style?: React.CSSProperties;
}
