/**
 * IEProgressBar — Animated progress bar
 * Linear progress with fill, segmented, and indeterminate variants.
 */

import { useEffect, useRef, useState } from 'react';
import type React from 'react';

export type ProgressBarVariant = 'fill' | 'segmented' | 'indeterminate';

export interface IEProgressBarProps {
  value?: number;
  max?: number;
  variant?: ProgressBarVariant;
  segments?: number;
  color?: string;
  trackColor?: string;
  height?: number;
  label?: string;
  showValue?: boolean;
  animated?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const KEYFRAMES = `
  @keyframes ie-progress-indeterminate {
    0% { left: -40%; width: 40%; }
    50% { left: 20%; width: 60%; }
    100% { left: 100%; width: 40%; }
  }
  @keyframes ie-progress-fill {
    0% { width: 0%; }
  }
  @keyframes ie-progress-shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(250%); }
  }
`;

export function IEProgressBar({
  value = 0,
  max = 100,
  variant = 'fill',
  segments = 10,
  color = '#a78bfa',
  trackColor = '#1a1a24',
  height = 6,
  label,
  showValue = false,
  animated = true,
  className,
  style,
}: IEProgressBarProps): React.ReactElement {
  const [displayValue, setDisplayValue] = useState(0);
  const animFrame = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  useEffect(() => {
    if (!animated) { setDisplayValue(pct); return; }
    const start = displayValue;
    const end = pct;
    const duration = 600;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(start + (end - start) * ease);
      if (progress < 1) animFrame.current = requestAnimationFrame(tick);
    };
    animFrame.current = requestAnimationFrame(tick);
    return () => { if (animFrame.current) cancelAnimationFrame(animFrame.current); };
  }, [pct]); // eslint-disable-line react-hooks/exhaustive-deps

  const filledSegments = Math.round((displayValue / 100) * segments);

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div className={className} style={{ width: '100%', ...style }}>
        {(label || showValue) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: '#8888a0' }}>
            {label && <span>{label}</span>}
            {showValue && variant !== 'indeterminate' && (
              <span style={{ fontVariantNumeric: 'tabular-nums', color: color }}>{Math.round(displayValue)}%</span>
            )}
          </div>
        )}

        {/* Fill / Indeterminate */}
        {(variant === 'fill' || variant === 'indeterminate') && (
          <div style={{ width: '100%', height, borderRadius: height, backgroundColor: trackColor, overflow: 'hidden', position: 'relative' }}>
            {variant === 'indeterminate' ? (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  height: '100%',
                  borderRadius: height,
                  background: `linear-gradient(90deg, ${color}66, ${color}, ${color}66)`,
                  animation: 'ie-progress-indeterminate 1.5s ease-in-out infinite',
                }}
              />
            ) : (
              <div
                style={{
                  position: 'relative',
                  width: `${displayValue}%`,
                  height: '100%',
                  borderRadius: height,
                  background: `linear-gradient(90deg, ${color}cc, ${color})`,
                  overflow: 'hidden',
                  transition: 'width 0.05s linear',
                }}
              >
                {/* Shimmer overlay */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
                    animation: 'ie-progress-shimmer 2s ease-in-out infinite',
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Segmented */}
        {variant === 'segmented' && (
          <div style={{ display: 'flex', gap: 3, height }}>
            {Array.from({ length: segments }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: '100%',
                  borderRadius: 3,
                  backgroundColor: i < filledSegments ? color : trackColor,
                  transition: animated ? 'background-color 0.2s ease' : undefined,
                  transitionDelay: animated ? `${i * 0.03}s` : undefined,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default IEProgressBar;
