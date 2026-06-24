/**
 * SplineCard — 3D tilt-on-hover card with mouse parallax
 * Wraps content with a depth-reactive tilt. Optionally embeds a Spline scene as the card back.
 */

import { useCallback, useRef, useState } from 'react';
import Spline from '@splinetool/react-spline';
import type { Application as SplineApplication } from '@splinetool/runtime';
import type React from 'react';

export interface SplineCardProps {
  children?: React.ReactNode;
  scene?: string;
  /** Max tilt angle in degrees */
  maxTilt?: number;
  /** Perspective depth in px */
  perspective?: number;
  /** Scale on hover */
  hoverScale?: number;
  /** Glow color on hover */
  glowColor?: string;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  onLoad?: (spline: SplineApplication) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function SplineCard({
  children,
  scene,
  maxTilt = 12,
  perspective = 800,
  hoverScale = 1.02,
  glowColor = '#a78bfa',
  width = 320,
  height = 200,
  borderRadius = 16,
  onLoad,
  className,
  style,
}: SplineCardProps): React.ReactElement {
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [glowX, setGlowX] = useState(50);
  const [glowY, setGlowY] = useState(50);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setTiltY((x - 0.5) * 2 * maxTilt);
    setTiltX(-(y - 0.5) * 2 * maxTilt);
    setGlowX(x * 100);
    setGlowY(y * 100);
  }, [maxTilt]);

  const handleMouseLeave = useCallback(() => {
    setTiltX(0);
    setTiltY(0);
    setHovered(false);
  }, []);

  return (
    <div
      ref={cardRef}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        width,
        height,
        borderRadius,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        transformStyle: 'preserve-3d',
        transform: `perspective(${perspective}px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${hovered ? hoverScale : 1})`,
        transition: hovered ? 'transform 0.1s ease-out' : 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow: hovered
          ? `0 24px 60px rgba(0,0,0,0.4), 0 0 40px ${glowColor}28`
          : '0 8px 32px rgba(0,0,0,0.3)',
        background: '#0f0f18',
        border: '1px solid #ffffff0d',
        ...style,
      }}
    >
      {/* Glare / Specular highlight */}
      {hovered && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            pointerEvents: 'none',
            background: `radial-gradient(circle at ${glowX}% ${glowY}%, rgba(255,255,255,0.12) 0%, transparent 60%)`,
            borderRadius,
          }}
        />
      )}

      {/* Spline scene as card background */}
      {scene && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <Spline
            scene={scene}
            onLoad={onLoad}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )}

      {/* Content layer */}
      {children && (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: '100%',
            padding: 20,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default SplineCard;
