/**
 * SplineCursor — Custom 3D cursor follower using CSS + rAF
 * No Spline needed — pure CSS circle that shadows the real cursor.
 * Optionally renders a Spline scene clipped to the cursor area.
 */

import { useEffect, useRef, useState } from 'react';
import type React from 'react';

export type CursorVariant = 'dot' | 'ring' | 'crosshair' | 'glow' | 'blend';

export interface SplineCursorProps {
  variant?: CursorVariant;
  color?: string;
  size?: number;
  trailSize?: number;
  trailDelay?: number;
  hideNativeCursor?: boolean;
  magneticSelector?: string;
  className?: string;
  style?: React.CSSProperties;
}

const KEYFRAMES = `
  @keyframes spline-cursor-pulse { 0%, 100% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.3); opacity: 0.5; } }
`;

export function SplineCursor({
  variant = 'ring',
  color = '#a78bfa',
  size = 10,
  trailSize = 36,
  trailDelay = 0.12,
  hideNativeCursor = true,
  className,
  style,
}: SplineCursorProps): React.ReactElement {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const [clicked, setClicked] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (hideNativeCursor) document.body.style.cursor = 'none';
    else document.body.style.cursor = '';
    return () => { document.body.style.cursor = ''; };
  }, [hideNativeCursor]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      pos.current = { x: e.clientX, y: e.clientY };
    };

    const onClick = () => { setClicked(true); setTimeout(() => setClicked(false), 400); };
    const onEnter = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.closest('button, a, [role="button"]')) setHovered(true);
    };
    const onLeave = () => setHovered(false);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('click', onClick);
    document.addEventListener('mouseover', onEnter);
    document.addEventListener('mouseout', onLeave);

    let raf: number;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const animate = () => {
      const dot = dotRef.current;
      const ring = ringRef.current;
      if (dot) {
        dot.style.left = `${pos.current.x}px`;
        dot.style.top = `${pos.current.y}px`;
      }
      if (ring) {
        ringPos.current.x = lerp(ringPos.current.x, pos.current.x, 1 - trailDelay);
        ringPos.current.y = lerp(ringPos.current.y, pos.current.y, 1 - trailDelay);
        ring.style.left = `${ringPos.current.x}px`;
        ring.style.top = `${ringPos.current.y}px`;
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('click', onClick);
      document.removeEventListener('mouseover', onEnter);
      document.removeEventListener('mouseout', onLeave);
      cancelAnimationFrame(raf);
    };
  }, [trailDelay]);

  const dotSize = hovered ? size * 0.5 : size;
  const ringOuterSize = hovered ? trailSize * 1.6 : clicked ? trailSize * 0.7 : trailSize;

  const dotStyles: React.CSSProperties = {
    position: 'fixed', zIndex: 99999, pointerEvents: 'none',
    width: dotSize, height: dotSize, borderRadius: '50%',
    backgroundColor: variant === 'ring' ? color : color,
    transform: 'translate(-50%, -50%)',
    transition: 'width 0.2s ease, height 0.2s ease, background 0.2s ease',
    ...(variant === 'glow' ? { boxShadow: `0 0 ${size * 2}px ${color}`, backgroundColor: 'transparent' } : {}),
    ...(variant === 'crosshair' ? { borderRadius: 0, width: 2, height: size * 2, backgroundColor: color } : {}),
    ...(variant === 'blend' ? { mixBlendMode: 'difference' as const, backgroundColor: '#ffffff' } : {}),
  };

  const ringStyles: React.CSSProperties = {
    position: 'fixed', zIndex: 99998, pointerEvents: 'none',
    width: ringOuterSize, height: ringOuterSize, borderRadius: '50%',
    border: `1.5px solid ${color}88`,
    transform: 'translate(-50%, -50%)',
    transition: 'width 0.3s ease, height 0.3s ease, border-color 0.2s ease',
    ...(variant === 'dot' ? { display: 'none' } : {}),
    ...(variant === 'glow' ? { boxShadow: `0 0 ${trailSize}px ${color}44`, borderColor: 'transparent', backgroundColor: `${color}08` } : {}),
    ...(variant === 'blend' ? { mixBlendMode: 'difference' as const, borderColor: '#ffffff88' } : {}),
  };

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div className={className} style={style}>
        <div ref={dotRef} style={dotStyles} />
        <div ref={ringRef} style={ringStyles} />
      </div>
    </>
  );
}

export default SplineCursor;
