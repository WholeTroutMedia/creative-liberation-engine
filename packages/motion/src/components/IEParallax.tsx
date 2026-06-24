/**
 * IEParallax — Multi-layer scroll parallax wrapper
 * Applies a scroll-driven translateY offset at a configurable speed.
 */

import { useEffect, useRef } from 'react';
import type React from 'react';

export type ParallaxDirection = 'up' | 'down' | 'left' | 'right';

export interface IEParallaxProps {
  children: React.ReactNode;
  speed?: number;
  direction?: ParallaxDirection;
  disabled?: boolean;
  rootMargin?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function IEParallax({
  children,
  speed = 0.3,
  direction = 'up',
  disabled = false,
  className,
  style,
}: IEParallaxProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2 - window.innerHeight / 2;
      const offset = center * speed;

      let transform = '';
      if (direction === 'up' || direction === 'down') {
        transform = `translateY(${direction === 'up' ? -offset : offset}px)`;
      } else {
        transform = `translateX(${direction === 'left' ? -offset : offset}px)`;
      }

      el.style.transform = transform;
      el.style.willChange = 'transform';
    };

    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (el) el.style.transform = '';
    };
  }, [speed, direction, disabled]);

  return (
    <div ref={ref} className={className} style={{ overflow: 'hidden', ...style }}>
      {children}
    </div>
  );
}

export default IEParallax;
