/**
 * SplineFloat — Floating 3D element that bobs and responds to scroll
 * Wraps a Spline scene in a floating container with idle bob + scroll parallax.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Spline from '@splinetool/react-spline';
import type { Application as SplineApplication } from '@splinetool/runtime';
import type React from 'react';

export interface SplineFloatProps {
  scene: string;
  width?: number | string;
  height?: number | string;
  bobAmplitude?: number;
  bobSpeed?: number;
  scrollParallax?: number;
  rotateOnScroll?: boolean;
  onLoad?: (spline: SplineApplication) => void;
  className?: string;
  style?: React.CSSProperties;
}

const KEYFRAMES = `
  @keyframes spline-float-bob {
    0%, 100% { transform: translateY(0px) rotate(-1deg); }
    50% { transform: translateY(var(--bob-amp, -16px)) rotate(1deg); }
  }
`;

export function SplineFloat({
  scene,
  width = '100%',
  height = 400,
  bobAmplitude = 16,
  bobSpeed = 4,
  scrollParallax = 0.15,
  rotateOnScroll = true,
  onLoad,
  className,
  style,
}: SplineFloatProps): React.ReactElement {
  const [loaded, setLoaded] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const handleLoad = useCallback(
    (app: SplineApplication) => {
      setLoaded(true);
      onLoad?.(app);
    },
    [onLoad],
  );

  useEffect(() => {
    const update = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2 - window.innerHeight / 2;
      setScrollOffset(center * scrollParallax);
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
    };
  }, [scrollParallax]);

  const parallaxStyle: React.CSSProperties = {
    transform: rotateOnScroll
      ? `translateY(${scrollOffset}px) rotateX(${scrollOffset * 0.05}deg)`
      : `translateY(${scrollOffset}px)`,
  };

  return (
    <>
      <style>
        {KEYFRAMES}
        {`[data-spline-float] { --bob-amp: -${bobAmplitude}px; }`}
      </style>
      <div
        ref={wrapperRef}
        className={className}
        style={{ width, height, position: 'relative', ...style }}
      >
        {/* Parallax wrapper */}
        <div
          style={{
            width: '100%', height: '100%',
            ...parallaxStyle,
            transition: 'transform 0.05s linear',
          }}
        >
          {/* Bob animation wrapper */}
          <div
            data-spline-float=""
            style={{
              width: '100%', height: '100%',
              opacity: loaded ? 1 : 0,
              transition: 'opacity 0.8s ease',
              animation: loaded ? `spline-float-bob ${bobSpeed}s ease-in-out infinite` : undefined,
            }}
          >
            <Spline
              scene={scene}
              onLoad={handleLoad}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>

        {/* Loading skeleton shimmer */}
        {!loaded && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 12,
            background: 'linear-gradient(90deg, #0f0f18 25%, #1a1a24 50%, #0f0f18 75%)',
            backgroundSize: '200% 100%',
            animation: 'ie-skeleton-shimmer 1.5s infinite',
          }} />
        )}
      </div>
    </>
  );
}

export default SplineFloat;
