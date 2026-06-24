/**
 * IECard — Animated motion card with hover lift, glow, and click press
 * Pure CSS motion card — no Spline. Ideal for content grids.
 */

import { useCallback, useRef, useState } from 'react';
import type React from 'react';

export type CardVariant = 'elevated' | 'outlined' | 'glass' | 'gradient' | 'flat';

export interface IECardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  hoverEffect?: 'lift' | 'glow' | 'tilt' | 'border' | 'none';
  glowColor?: string;
  clickDepth?: boolean;
  padding?: number | string;
  borderRadius?: number;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function IECard({
  children,
  variant = 'elevated',
  hoverEffect = 'lift',
  glowColor = '#a78bfa',
  clickDepth = true,
  padding = 20,
  borderRadius = 12,
  onClick,
  className,
  style,
}: IECardProps): React.ReactElement {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (hoverEffect !== 'tilt') return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({ x: -(y - 0.5) * 10, y: (x - 0.5) * 10 });
    setGlowPos({ x: x * 100, y: y * 100 });
  }, [hoverEffect]);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    setTilt({ x: 0, y: 0 });
  }, []);

  const getVariantStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = { borderRadius, padding };
    if (variant === 'outlined') return { ...base, background: 'transparent', border: '1px solid rgba(255,255,255,0.08)' };
    if (variant === 'glass') return { ...base, background: 'rgba(15,15,25,0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' };
    if (variant === 'gradient') return { ...base, background: 'linear-gradient(135deg, #111118, #1a1a28)', border: '1px solid rgba(255,255,255,0.06)' };
    if (variant === 'flat') return { ...base, background: '#111118', border: 'none' };
    return { ...base, background: '#111118', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' };
  };

  const getHoverTransform = (): string => {
    if (pressed && clickDepth) return 'scale(0.98)';
    if (!hovered) return 'none';
    if (hoverEffect === 'lift') return 'translateY(-4px)';
    if (hoverEffect === 'tilt') return `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(-2px)`;
    return 'none';
  };

  const getHoverShadow = (): string => {
    if (!hovered) return variant === 'elevated' ? '0 4px 16px rgba(0,0,0,0.3)' : 'none';
    if (hoverEffect === 'lift' || hoverEffect === 'tilt') {
      return `0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px ${glowColor}22`;
    }
    if (hoverEffect === 'glow') return `0 0 24px ${glowColor}44, 0 0 48px ${glowColor}22`;
    if (hoverEffect === 'border') return `0 0 0 1.5px ${glowColor}`;
    return 'none';
  };

  return (
    <div
      ref={ref}
      className={className}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transform: getHoverTransform(),
        transformStyle: 'preserve-3d' as const,
        boxShadow: getHoverShadow(),
        transition: pressed ? 'transform 0.08s ease' : 'transform 0.3s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.3s ease',
        ...getVariantStyle(),
        ...style,
      }}
    >
      {/* Radial glow on hover */}
      {hovered && (hoverEffect === 'glow' || hoverEffect === 'tilt') && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius,
            background: `radial-gradient(circle at ${glowPos.x}% ${glowPos.y}%, ${glowColor}14 0%, transparent 65%)`,
            zIndex: 0,
          }}
        />
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}

export default IECard;
