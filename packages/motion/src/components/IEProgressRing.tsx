/**
 * IEProgressRing — Animated circular/ring progress indicator
 */

import { useEffect, useRef, useState } from 'react';
import type React from 'react';

export type ProgressRingVariant = 'ring' | 'filled' | 'gradient';

export interface IEProgressRingProps {
  value?: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  variant?: ProgressRingVariant;
  showValue?: boolean;
  label?: string;
  animated?: boolean;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const KEYFRAMES = `
  @keyframes ie-ring-spin { 0% { transform: rotate(-90deg); } }
`;

export function IEProgressRing({
  value = 0,
  max = 100,
  size = 80,
  strokeWidth = 6,
  color = '#a78bfa',
  trackColor = '#1a1a24',
  variant = 'ring',
  showValue = true,
  label,
  animated = true,
  duration = 800,
  className,
  style,
  children,
}: IEProgressRingProps): React.ReactElement {
  const [displayValue, setDisplayValue] = useState(animated ? 0 : value);
  const animFrame = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const center = size / 2;
  const radius = center - strokeWidth / 2 - 2;
  const circumference = 2 * Math.PI * radius;

  const pct = Math.min(100, Math.max(0, (displayValue / max) * 100));
  const offset = circumference - (pct / 100) * circumference;

  useEffect(() => {
    if (!animated) { setDisplayValue(value); return; }
    const start = displayValue;
    const end = value;
    const startTime = performance.now();

    if (animFrame.current) cancelAnimationFrame(animFrame.current);
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplayValue(start + (end - start) * ease);
      if (t < 1) animFrame.current = requestAnimationFrame(tick);
      else setDisplayValue(end);
    };
    animFrame.current = requestAnimationFrame(tick);
    return () => { if (animFrame.current) cancelAnimationFrame(animFrame.current); };
  }, [value, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  const gradId = `ie-ring-grad-${Math.round(size)}`;

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        className={className}
        style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}
        role="progressbar"
        aria-valuenow={Math.round(displayValue)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? 'Progress'}
      >
        <svg width={size} height={size} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
          {variant === 'gradient' && (
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={`${color}88`} />
                <stop offset="100%" stopColor={color} />
              </linearGradient>
            </defs>
          )}

          {/* Track */}
          <circle
            cx={center} cy={center} r={radius}
            fill={variant === 'filled' ? trackColor : 'none'}
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />

          {/* Progress arc */}
          <circle
            cx={center} cy={center} r={radius}
            fill="none"
            stroke={variant === 'gradient' ? `url(#${gradId})` : color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: animated ? 'stroke-dashoffset 0.05s linear' : undefined }}
          />
        </svg>

        {/* Center content */}
        <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
          {children ?? (
            showValue && (
              <>
                <div style={{ fontSize: size * 0.18, fontWeight: 700, color: '#e8e8f0', lineHeight: 1.1 }}>
                  {Math.round(pct)}%
                </div>
                {label && <div style={{ fontSize: size * 0.1, color: '#8888a0', marginTop: 2 }}>{label}</div>}
              </>
            )
          )}
        </div>
      </div>
    </>
  );
}

export default IEProgressRing;
