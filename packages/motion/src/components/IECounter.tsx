/**
 * IECounter — Animated number that counts up/down with spring physics
 */

import { useEffect, useRef, useState } from 'react';
import type React from 'react';

export interface IECounterProps {
  value: number;
  from?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  separator?: string;
  easing?: 'linear' | 'ease-out' | 'spring';
  className?: string;
  style?: React.CSSProperties;
}

function formatNumber(n: number, decimals: number, separator: string): string {
  const fixed = n.toFixed(decimals);
  const [integer, decimal] = fixed.split('.');
  const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return decimal !== undefined ? `${formatted}.${decimal}` : formatted;
}

function easeOut(t: number): number { return 1 - Math.pow(1 - t, 3); }
function linear(t: number): number { return t; }
function spring(t: number): number {
  const c4 = (2 * Math.PI) / 2.5;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

export function IECounter({
  value,
  from = 0,
  duration = 1200,
  decimals = 0,
  prefix = '',
  suffix = '',
  separator = ',',
  easing = 'ease-out',
  className,
  style,
}: IECounterProps): React.ReactElement {
  const [current, setCurrent] = useState(from);
  const animFrame = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const prevValue = useRef(from);

  const easeFn = easing === 'linear' ? linear : easing === 'spring' ? spring : easeOut;

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    const startTime = performance.now();

    if (animFrame.current) cancelAnimationFrame(animFrame.current);

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = easeFn(t);
      setCurrent(start + (end - start) * eased);
      if (t < 1) animFrame.current = requestAnimationFrame(tick);
      else { setCurrent(end); prevValue.current = end; }
    };

    animFrame.current = requestAnimationFrame(tick);
    return () => { if (animFrame.current) cancelAnimationFrame(animFrame.current); };
  }, [value, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums', ...style }}
      aria-live="polite"
      aria-atomic="true"
    >
      {prefix}{formatNumber(current, decimals, separator)}{suffix}
    </span>
  );
}

export default IECounter;
