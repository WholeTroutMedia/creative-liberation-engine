/**
 * IEReveal — Scroll-triggered reveal animation wrapper
 * Uses IntersectionObserver to fire animations when elements enter the viewport.
 */

import { useEffect, useRef, useState } from 'react';
import type React from 'react';

export type RevealVariant = 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right' | 'zoom' | 'blur-in' | 'flip-up';

export interface IERevealProps {
  children: React.ReactNode;
  variant?: RevealVariant;
  duration?: number;
  delay?: number;
  threshold?: number;
  once?: boolean;
  easing?: string;
  className?: string;
  style?: React.CSSProperties;
}

const HIDDEN_STYLES: Record<RevealVariant, React.CSSProperties> = {
  'fade-up':    { opacity: 0, transform: 'translateY(32px)' },
  'fade-down':  { opacity: 0, transform: 'translateY(-32px)' },
  'fade-left':  { opacity: 0, transform: 'translateX(32px)' },
  'fade-right': { opacity: 0, transform: 'translateX(-32px)' },
  'zoom':       { opacity: 0, transform: 'scale(0.85)' },
  'blur-in':    { opacity: 0, filter: 'blur(12px)', transform: 'scale(0.98)' },
  'flip-up':    { opacity: 0, transform: 'rotateX(20deg) translateY(24px)' },
};

const VISIBLE_STYLES: React.CSSProperties = {
  opacity: 1,
  transform: 'none',
  filter: 'none',
};

export function IEReveal({
  children,
  variant = 'fade-up',
  duration = 600,
  delay = 0,
  threshold = 0.1,
  once = true,
  easing = 'cubic-bezier(0.4, 0, 0.2, 1)',
  className,
  style,
}: IERevealProps): React.ReactElement {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once]);

  const hiddenStyle = HIDDEN_STYLES[variant];

  return (
    <div
      ref={ref}
      className={className}
      style={{
        willChange: 'opacity, transform',
        ...(visible ? VISIBLE_STYLES : hiddenStyle),
        transition: `opacity ${duration}ms ${easing} ${delay}ms, transform ${duration}ms ${easing} ${delay}ms, filter ${duration}ms ${easing} ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default IEReveal;
