/**
 * IEMagnetic — Cursor-attracting magnetic element
 * Pulls toward mouse on hover using spring-like transform.
 */

import { useCallback, useRef, useState } from 'react';
import type React from 'react';

export interface IEMagneticProps {
  children: React.ReactNode;
  strength?: number;
  radius?: number;
  restoreSpeed?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function IEMagnetic({
  children,
  strength = 0.4,
  radius = 80,
  restoreSpeed = 0.4,
  className,
  style,
}: IEMagneticProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < radius) {
      const pull = 1 - dist / radius;
      setOffset({ x: dx * strength * pull, y: dy * strength * pull });
    }
  }, [radius, strength]);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const restore = () => {
      setOffset((prev) => {
        const nx = prev.x * (1 - restoreSpeed);
        const ny = prev.y * (1 - restoreSpeed);
        if (Math.abs(nx) < 0.05 && Math.abs(ny) < 0.05) return { x: 0, y: 0 };
        rafRef.current = requestAnimationFrame(restore);
        return { x: nx, y: ny };
      });
    };
    rafRef.current = requestAnimationFrame(restore);
  }, [restoreSpeed]);

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        display: 'inline-flex',
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        transition: 'transform 0.1s linear',
        willChange: 'transform',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default IEMagnetic;
