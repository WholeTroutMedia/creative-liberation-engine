/**
 * IEBadge — Animated notification badge with count-up and pop-in
 */

import { useEffect, useRef, useState } from 'react';
import type React from 'react';

export type BadgeVariant = 'dot' | 'count' | 'label';
export type BadgeColor = 'accent' | 'success' | 'error' | 'warning' | 'info';

export interface IEBadgeProps {
  count?: number;
  label?: string;
  variant?: BadgeVariant;
  color?: BadgeColor;
  max?: number;
  showZero?: boolean;
  pulse?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const COLOR_MAP: Record<BadgeColor, { bg: string; color: string }> = {
  accent:  { bg: '#a78bfa', color: '#fff' },
  success: { bg: '#4ade80', color: '#052e16' },
  error:   { bg: '#f87171', color: '#fff' },
  warning: { bg: '#fbbf24', color: '#1c1003' },
  info:    { bg: '#60a5fa', color: '#fff' },
};

const KEYFRAMES = `
  @keyframes ie-badge-pop { 0% { transform: scale(0); } 60% { transform: scale(1.3); } 100% { transform: scale(1); } }
  @keyframes ie-badge-pulse { 0%, 100% { box-shadow: 0 0 0 0 currentColor; } 50% { box-shadow: 0 0 0 6px transparent; } }
`;

export function IEBadge({
  count = 0,
  label,
  variant = 'count',
  color = 'error',
  max = 99,
  showZero = false,
  pulse = false,
  children,
  className,
  style,
}: IEBadgeProps): React.ReactElement {
  const [displayCount, setDisplayCount] = useState(count);
  const [popping, setPopping] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count !== prevCount.current) {
      setPopping(true);
      const timer = setTimeout(() => setPopping(false), 400);
      prevCount.current = count;
      setDisplayCount(count);
      return () => clearTimeout(timer);
    }
  }, [count]);

  const { bg, color: textColor } = COLOR_MAP[color];
  const isVisible = variant === 'dot' || (variant === 'count' && (count > 0 || showZero)) || variant === 'label';
  const displayText = variant === 'count' ? (displayCount > max ? `${max}+` : String(displayCount)) : label ?? '';

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        className={className}
        style={{ position: 'relative', display: 'inline-flex', ...style }}
      >
        {children}

        {isVisible && (
          <div
            style={{
              position: children ? 'absolute' : 'relative',
              top: children ? -6 : undefined,
              right: children ? -6 : undefined,
              minWidth: variant === 'dot' ? 8 : variant === 'count' ? 18 : undefined,
              height: variant === 'dot' ? 8 : 18,
              padding: variant === 'label' ? '0 8px' : undefined,
              background: bg,
              color: textColor,
              borderRadius: 100,
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              border: children ? '2px solid #08080c' : 'none',
              animation: popping ? 'ie-badge-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' : undefined,
              boxShadow: pulse ? `0 0 0 0 ${bg}` : undefined,
              ...(pulse ? { animation: `${popping ? 'ie-badge-pop 0.4s cubic-bezier(0.34,1.56,0.64,1),' : ''}ie-badge-pulse 2s ease-in-out infinite` } : {}),
            }}
          >
            {variant !== 'dot' && <span style={{ color: textColor }}>{displayText}</span>}
          </div>
        )}
      </div>
    </>
  );
}

export default IEBadge;
