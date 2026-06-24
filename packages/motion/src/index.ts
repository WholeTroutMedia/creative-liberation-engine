/**
 * @cle/motion — Barrel exports
 * Lottie-powered motion design system for the Creative Liberation Engine
 * 40 components total
 */

// ── Types ──────────────────────────────────────────────────────
export type {
  AnimationSource,
  PlayMode,
  MotionConfig,
  IEAnimationProps,
  LoaderVariant,
  IELoaderProps,
  SuccessVariant,
  IESuccessProps,
  IEEmptyStateProps,
  TransitionType,
  IETransitionProps,
} from './types.js';

// ── Base Animation Components ──────────────────────────────────
export { IEAnimation } from './components/IEAnimation.js';
export { IELoader } from './components/IELoader.js';
export { IESuccess } from './components/IESuccess.js';
export { IEEmptyState } from './components/IEEmptyState.js';
export { IETransition } from './components/IETransition.js';

// ── Interactive ────────────────────────────────────────────────
export { IEButton } from './components/IEButton.js';
export type { IEButtonProps, ButtonVariant, ButtonSize } from './components/IEButton.js';

export { IESwitch } from './components/IESwitch.js';
export type { IESwitchProps, SwitchSize, SwitchColor } from './components/IESwitch.js';

export { IEAccordion } from './components/IEAccordion.js';
export type { IEAccordionProps, AccordionItem } from './components/IEAccordion.js';

export { IETabs } from './components/IETabs.js';
export type { IETabsProps, Tab, TabsVariant } from './components/IETabs.js';

export { IEDrawer } from './components/IEDrawer.js';
export type { IEDrawerProps, DrawerSide, DrawerSize } from './components/IEDrawer.js';

export { IEModal } from './components/IEModal.js';
export type { IEModalProps, ModalSize, ModalAnimation } from './components/IEModal.js';

export { IETooltip } from './components/IETooltip.js';
export type { IETooltipProps, TooltipPlacement, TooltipVariant } from './components/IETooltip.js';

export { IEPopover } from './components/IEPopover.js';
export type { IEPopoverProps, PopoverPlacement, PopoverTrigger } from './components/IEPopover.js';

export { IECarousel } from './components/IECarousel.js';
export type { IECarouselProps, CarouselVariant } from './components/IECarousel.js';

export { IEMagnetic } from './components/IEMagnetic.js';
export type { IEMagneticProps } from './components/IEMagnetic.js';

export { IEStepper } from './components/IEStepper.js';
export type { IEStepperProps, Step, StepperOrientation, StepperVariant } from './components/IEStepper.js';

// ── Data Display ───────────────────────────────────────────────
export { IEAvatar, IEAvatarGroup } from './components/IEAvatar.js';
export type { IEAvatarProps, IEAvatarGroupProps, AvatarSize, AvatarStatus, AvatarShape } from './components/IEAvatar.js';

export { IEChip } from './components/IEChip.js';
export type { IEChipProps, ChipVariant, ChipColor, ChipSize } from './components/IEChip.js';

export { IECounter } from './components/IECounter.js';
export type { IECounterProps } from './components/IECounter.js';

export { IECountdown } from './components/IECountdown.js';
export type { IECountdownProps, CountdownVariant } from './components/IECountdown.js';

export { IETimeline } from './components/IETimeline.js';
export type { IETimelineProps, TimelineItem, TimelineItemStatus, TimelineLayout } from './components/IETimeline.js';

export { IERating } from './components/IERating.js';
export type { IERatingProps, RatingVariant, RatingSize } from './components/IERating.js';

// ── Feedback & Status ──────────────────────────────────────────
export { IEToast, IEToaster, toast } from './components/IEToast.js';
export type { IEToastProps, IEToasterProps, Toast, ToastVariant, ToastPosition } from './components/IEToast.js';

export { IENotification, IENotificationBell } from './components/IENotification.js';
export type { IENotificationProps, IENotificationBellProps, Notification, NotificationType } from './components/IENotification.js';

export { IEBadge } from './components/IEBadge.js';
export type { IEBadgeProps, BadgeVariant, BadgeColor } from './components/IEBadge.js';

export { IEPulse } from './components/IEPulse.js';
export type { IEPulseProps, PulseVariant } from './components/IEPulse.js';

export { IEConfetti } from './components/IEConfetti.js';
export type { IEConfettiProps, ConfettiShape, ConfettiMode } from './components/IEConfetti.js';

// ── Forms & Controls ───────────────────────────────────────────
export { IESlider } from './components/IESlider.js';
export type { IESliderProps, SliderVariant } from './components/IESlider.js';

// ── Progress & Loading ─────────────────────────────────────────
export { IEProgressBar } from './components/IEProgressBar.js';
export type { IEProgressBarProps, ProgressBarVariant } from './components/IEProgressBar.js';

export { IEProgressRing } from './components/IEProgressRing.js';
export type { IEProgressRingProps, ProgressRingVariant } from './components/IEProgressRing.js';

export { IEScrollProgress } from './components/IEScrollProgress.js';
export type { IEScrollProgressProps } from './components/IEScrollProgress.js';

export { IESkeleton } from './components/IESkeleton.js';
export type { IESkeletonProps, SkeletonVariant } from './components/IESkeleton.js';

// ── Layout & Containers ────────────────────────────────────────
export { IECard } from './components/IECard.js';
export type { IECardProps, CardVariant } from './components/IECard.js';

export { IEStagger } from './components/IEStagger.js';
export type { IEStaggerProps, StaggerVariant } from './components/IEStagger.js';

// ── Animation Primitives ───────────────────────────────────────
export { IEReveal } from './components/IEReveal.js';
export type { IERevealProps, RevealVariant } from './components/IEReveal.js';

export { IETypewriter } from './components/IETypewriter.js';
export type { IETypewriterProps } from './components/IETypewriter.js';

export { IEPageTransition } from './components/IEPageTransition.js';
export type { IEPageTransitionProps, PageTransitionType } from './components/IEPageTransition.js';

export { IEParallax } from './components/IEParallax.js';
export type { IEParallaxProps, ParallaxDirection } from './components/IEParallax.js';

export { IEMarquee } from './components/IEMarquee.js';
export type { IEMarqueeProps, MarqueeDirection } from './components/IEMarquee.js';

export { IEMorphText } from './components/IEMorphText.js';
export type { IEMorphTextProps, MorphTextMode } from './components/IEMorphText.js';
