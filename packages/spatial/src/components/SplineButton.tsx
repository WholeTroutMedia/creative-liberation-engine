/**
 * SplineButton — Button that fires Spline events on interaction
 * Wraps a styled button and triggers Spline scene animations/state changes.
 */

import { useCallback } from 'react';
import type { Application as SplineApplication } from '@splinetool/runtime';
import type React from 'react';

export type SplineButtonVariant = 'solid' | 'outline' | 'glass' | 'ghost';
export type SplineButtonSize = 'sm' | 'md' | 'lg';

export interface SplineButtonProps {
  label?: React.ReactNode;
  spline?: SplineApplication | null;
  eventName?: string;
  hoverEventName?: string;
  variant?: SplineButtonVariant;
  size?: SplineButtonSize;
  color?: string;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const KEYFRAMES = `
  @keyframes spline-btn-ripple { 0% { transform: scale(0); opacity: 0.6; } 100% { transform: scale(4); opacity: 0; } }
  @keyframes spline-btn-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;

const VARIANTS: Record<SplineButtonVariant, (color: string) => React.CSSProperties> = {
  solid:   (c) => ({ background: c, color: '#fff', border: 'none', boxShadow: `0 4px 16px ${c}44` }),
  outline: (c) => ({ background: 'transparent', color: c, border: `1.5px solid ${c}` }),
  glass:   (c) => ({ background: `${c}14`, color: c, border: `1px solid ${c}33`, backdropFilter: 'blur(12px)' }),
  ghost:   (c) => ({ background: 'transparent', color: c, border: 'none' }),
};

const SIZE_STYLES: Record<SplineButtonSize, React.CSSProperties> = {
  sm: { fontSize: 12, height: 32, padding: '0 12px', gap: 6 },
  md: { fontSize: 13, height: 40, padding: '0 18px', gap: 8 },
  lg: { fontSize: 15, height: 48, padding: '0 24px', gap: 10 },
};

export function SplineButton({
  label,
  spline,
  eventName,
  hoverEventName,
  variant = 'solid',
  size = 'md',
  color = '#a78bfa',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  onClick,
  fullWidth = false,
  className,
  style,
}: SplineButtonProps): React.ReactElement {
  const fireEvent = useCallback((name: string | undefined) => {
    if (!name || !spline) return;
    try { spline.emitEvent('mouseDown', name); } catch (_) {}
  }, [spline]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    fireEvent(eventName);
    onClick?.(e);

    // Ripple
    const btn = e.currentTarget;
    const ripple = document.createElement('span');
    const rect = btn.getBoundingClientRect();
    const sz = Math.max(rect.width, rect.height);
    Object.assign(ripple.style, {
      position: 'absolute',
      width: `${sz}px`, height: `${sz}px`,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.2)',
      left: `${e.clientX - rect.left - sz / 2}px`,
      top: `${e.clientY - rect.top - sz / 2}px`,
      animation: 'spline-btn-ripple 0.5s ease-out forwards',
      pointerEvents: 'none',
    });
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
  }, [disabled, loading, eventName, onClick, fireEvent]);

  const handleMouseEnter = useCallback(() => {
    if (hoverEventName && spline) fireEvent(hoverEventName);
  }, [hoverEventName, spline, fireEvent]);

  const variantStyle = VARIANTS[variant](color);
  const sizeStyle = SIZE_STYLES[size];

  return (
    <>
      <style>{KEYFRAMES}</style>
      <button
        type="button"
        className={className}
        disabled={disabled || loading}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          position: 'relative',
          overflow: 'hidden',
          width: fullWidth ? '100%' : undefined,
          transition: 'opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease',
          ...variantStyle,
          ...sizeStyle,
          ...style,
        }}
      >
        {loading ? (
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            border: '2px solid currentColor', borderTopColor: 'transparent',
            animation: 'spline-btn-spin 0.6s linear infinite',
          }} />
        ) : (
          <>
            {icon && iconPosition === 'left' && <span style={{ display: 'flex', fontSize: '1em' }}>{icon}</span>}
            {label && <span>{label}</span>}
            {icon && iconPosition === 'right' && <span style={{ display: 'flex', fontSize: '1em' }}>{icon}</span>}
          </>
        )}
      </button>
    </>
  );
}

export default SplineButton;
