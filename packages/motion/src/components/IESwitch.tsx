/**
 * IESwitch — Animated iOS-style toggle switch
 */

import { useCallback } from 'react';
import type React from 'react';

export type SwitchSize = 'sm' | 'md' | 'lg';
export type SwitchColor = 'accent' | 'success' | 'warning' | 'danger';

export interface IESwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  labelPosition?: 'left' | 'right';
  size?: SwitchSize;
  color?: SwitchColor;
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const SIZE_DIMS = {
  sm: { w: 32, h: 18, thumb: 14, gap: 2 },
  md: { w: 44, h: 24, thumb: 18, gap: 3 },
  lg: { w: 56, h: 32, thumb: 26, gap: 3 },
};

const COLOR_MAP: Record<SwitchColor, string> = {
  accent:  '#a78bfa',
  success: '#4ade80',
  warning: '#fbbf24',
  danger:  '#f87171',
};

const KEYFRAMES = `
  @keyframes ie-switch-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;

export function IESwitch({
  checked,
  onChange,
  disabled = false,
  label,
  labelPosition = 'right',
  size = 'md',
  color = 'accent',
  loading = false,
  className,
  style,
}: IESwitchProps): React.ReactElement {
  const dims = SIZE_DIMS[size];
  const activeColor = COLOR_MAP[color];
  const translateX = dims.w - dims.thumb - dims.gap * 2;

  const handleClick = useCallback(() => {
    if (!disabled && !loading) onChange(!checked);
  }, [checked, disabled, loading, onChange]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleClick(); }
  }, [handleClick]);

  const track = (
    <div
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      aria-label={typeof label === 'string' ? label : undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKey}
      style={{
        position: 'relative',
        width: dims.w,
        height: dims.h,
        borderRadius: dims.h,
        background: checked ? activeColor : '#2a2a3a',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.25s ease',
        flexShrink: 0,
        outline: 'none',
        boxShadow: checked ? `0 0 12px ${activeColor}44` : 'none',
      }}
    >
      {/* Thumb */}
      <div style={{
        position: 'absolute',
        top: dims.gap,
        left: dims.gap,
        width: dims.thumb,
        height: dims.thumb,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        transform: `translateX(${checked ? translateX : 0}px)`,
        transition: 'transform 0.25s cubic-bezier(0.34,1.3,0.64,1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {loading && (
          <div style={{
            width: '60%', height: '60%', borderRadius: '50%',
            border: `1.5px solid ${activeColor}`,
            borderTopColor: 'transparent',
            animation: 'ie-switch-spin 0.6s linear infinite',
          }} />
        )}
      </div>
    </div>
  );

  const lbl = label ? (
    <span style={{
      fontSize: size === 'sm' ? 12 : size === 'lg' ? 15 : 13,
      color: disabled ? '#555568' : '#c8c8d8',
      userSelect: 'none' as const,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }} onClick={handleClick}>
      {label}
    </span>
  ) : null;

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        className={className}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...style }}
      >
        {labelPosition === 'left' && lbl}
        {track}
        {labelPosition === 'right' && lbl}
      </div>
    </>
  );
}

export default IESwitch;
