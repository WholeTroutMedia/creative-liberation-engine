/**
 * IEScrollProgress — Page scroll progress bar (top of viewport)
 */

import { useEffect, useState } from 'react';
import type React from 'react';

export interface IEScrollProgressProps {
  color?: string;
  height?: number;
  position?: 'top' | 'bottom';
  zIndex?: number;
  smooth?: boolean;
  showPercentage?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const KEYFRAMES = `
  @keyframes ie-scroll-progress-shimmer {
    0% { transform: translateX(-100%) skewX(-15deg); }
    100% { transform: translateX(800%) skewX(-15deg); }
  }
`;

export function IEScrollProgress({
  color = '#a78bfa',
  height = 3,
  position = 'top',
  zIndex = 9999,
  smooth = true,
  showPercentage = false,
  className,
  style,
}: IEScrollProgressProps): React.ReactElement {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    };

    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        className={className}
        style={{
          position: 'fixed',
          [position]: 0,
          left: 0,
          right: 0,
          height,
          zIndex,
          background: '#1a1a24',
          ...style,
        }}
      >
        <div
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            height: '100%',
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            transition: smooth ? 'width 0.1s linear' : undefined,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Shimmer */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '25%', height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              animation: 'ie-scroll-progress-shimmer 2s ease-in-out infinite',
            }}
          />
        </div>

        {showPercentage && (
          <div style={{
            position: 'absolute', right: 8, top: height + 4,
            fontSize: 10, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums',
          }}>
            {Math.round(progress)}%
          </div>
        )}
      </div>
    </>
  );
}

export default IEScrollProgress;
