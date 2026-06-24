/**
 * IEButton — Animated button with ripple effect and loading state
 */

import { useCallback, useRef, useState } from 'react';
import type React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface IEButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  style?: React.CSSProperties;
}

interface Ripple { x: number; y: number; id: number; }

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', color: '#fff', borderColor: 'transparent' },
  secondary: { background: '#1a1a24', color: '#e8e8f0', borderColor: '#ffffff1a' },
  ghost: { background: 'transparent', color: '#a78bfa', borderColor: '#a78bfa44' },
  danger: { background: 'linear-gradient(135deg, #f87171, #dc2626)', color: '#fff', borderColor: 'transparent' },
  success: { background: 'linear-gradient(135deg, #4ade80, #16a34a)', color: '#fff', borderColor: 'transparent' },
};

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '6px 14px', fontSize: 12, borderRadius: 6 },
  md: { padding: '10px 20px', fontSize: 14, borderRadius: 8 },
  lg: { padding: '14px 28px', fontSize: 16, borderRadius: 10 },
};

export function IEButton({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  onClick,
  type = 'button',
  className,
  style,
}: IEButtonProps): React.ReactElement {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const nextId = useRef(0);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const id = nextId.current++;
    setRipples((prev) => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top, id }]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
    onClick?.(e);
  }, [disabled, loading, onClick]);

  const isDisabled = disabled || loading;
  const vStyle = VARIANT_STYLES[variant];
  const sStyle = SIZE_STYLES[size];

  return (
    <>
      <style>{`
        @keyframes ie-btn-ripple { 0% { transform: scale(0); opacity: 0.5; } 100% { transform: scale(4); opacity: 0; } }
        @keyframes ie-btn-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
      <button
        type={type}
        className={className}
        disabled={isDisabled}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false); }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        style={{
          position: 'relative',
          overflow: 'hidden',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontFamily: 'inherit',
          fontWeight: 500,
          letterSpacing: '-0.01em',
          border: '1px solid',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          userSelect: 'none',
          width: fullWidth ? '100%' : undefined,
          opacity: isDisabled ? 0.5 : 1,
          transform: pressed ? 'scale(0.97)' : hovered && !isDisabled ? 'translateY(-1px)' : 'none',
          boxShadow: hovered && !isDisabled && variant === 'primary'
            ? '0 4px 20px #a78bfa44'
            : variant === 'primary' ? '0 2px 8px #a78bfa22' : 'none',
          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
          ...vStyle,
          ...sStyle,
          ...style,
        }}
      >
        {/* Ripples */}
        {ripples.map((r) => (
          <span
            key={r.id}
            style={{
              position: 'absolute',
              left: r.x,
              top: r.y,
              width: 20,
              height: 20,
              marginLeft: -10,
              marginTop: -10,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.3)',
              animation: 'ie-btn-ripple 0.6s ease-out forwards',
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Loading spinner */}
        {loading && (
          <span
            style={{
              width: 14,
              height: 14,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'ie-btn-spin 0.7s linear infinite',
              flexShrink: 0,
            }}
          />
        )}

        {/* Icon left */}
        {!loading && icon && iconPosition === 'left' && <span style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>}

        {/* Label */}
        <span>{children}</span>

        {/* Icon right */}
        {!loading && icon && iconPosition === 'right' && <span style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>}
      </button>
    </>
  );
}

export default IEButton;
