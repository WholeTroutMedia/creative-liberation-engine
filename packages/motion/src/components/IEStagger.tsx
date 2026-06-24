/**
 * IEStagger — Stagger animation container
 * Applies incremental animation delays to direct children.
 * Use as a layout wrapper to choreograph entrance animations.
 */

import { Children, useEffect, useRef, useState } from 'react';
import type React from 'react';

export type StaggerVariant = 'fade-up' | 'fade-in' | 'scale' | 'slide-left' | 'slide-right' | 'blur-in';

export interface IEStaggerProps {
  children: React.ReactNode;
  variant?: StaggerVariant;
  delay?: number;
  stagger?: number;
  duration?: number;
  easing?: string;
  once?: boolean;
  threshold?: number;
  className?: string;
  style?: React.CSSProperties;
}

const HIDDEN: Record<StaggerVariant, React.CSSProperties> = {
  'fade-up':    { opacity: 0, transform: 'translateY(24px)' },
  'fade-in':    { opacity: 0 },
  'scale':      { opacity: 0, transform: 'scale(0.87)' },
  'slide-left': { opacity: 0, transform: 'translateX(24px)' },
  'slide-right':{ opacity: 0, transform: 'translateX(-24px)' },
  'blur-in':    { opacity: 0, filter: 'blur(10px)' },
};

const VISIBLE: React.CSSProperties = { opacity: 1, transform: 'none', filter: 'none' };

export function IEStagger({
  children,
  variant = 'fade-up',
  delay = 0,
  stagger = 80,
  duration = 500,
  easing = 'cubic-bezier(0.4, 0, 0.2, 1)',
  once = true,
  threshold = 0.05,
  className,
  style,
}: IEStaggerProps): React.ReactElement {
  const [triggered, setTriggered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTriggered(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setTriggered(false);
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [once, threshold]);

  const count = Children.count(children);

  return (
    <div ref={ref} className={className} style={style}>
      {Children.map(children, (child, i) => {
        const ms = delay + i * stagger;
        return (
          <div
            key={i}
            style={{
              ...(triggered ? VISIBLE : HIDDEN[variant]),
              willChange: 'opacity, transform',
              transition: `opacity ${duration}ms ${easing} ${ms}ms, transform ${duration}ms ${easing} ${ms}ms, filter ${duration}ms ${easing} ${ms}ms`,
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}

export default IEStagger;
