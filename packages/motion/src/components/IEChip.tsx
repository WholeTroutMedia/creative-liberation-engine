/**
 * IEChip — Animated tag/chip with dismiss, selection, and icon support
 */

import { useCallback, useState } from 'react';
import type React from 'react';

export type ChipVariant = 'filled' | 'outlined' | 'ghost' | 'gradient';
export type ChipColor = 'default' | 'accent' | 'success' | 'warning' | 'error' | 'info';
export type ChipSize = 'sm' | 'md' | 'lg';

export interface IEChipProps {
  label: React.ReactNode;
  icon?: React.ReactNode;
  onDismiss?: () => void;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  variant?: ChipVariant;
  color?: ChipColor;
  size?: ChipSize;
  className?: string;
  style?: React.CSSProperties;
}

const COLOR_MAP: Record<ChipColor, { bg: string; border: string; text: string; selectedBg: string }> = {
  default: { bg: '#1a1a24', border: '#333348',  text: '#c8c8d8', selectedBg: '#2a2a3a' },
  accent:  { bg: '#a78bfa15', border: '#a78bfa44', text: '#a78bfa', selectedBg: '#a78bfa30' },
  success: { bg: '#4ade8015', border: '#4ade8044', text: '#4ade80', selectedBg: '#4ade8030' },
  warning: { bg: '#fbbf2415', border: '#fbbf2444', text: '#fbbf24', selectedBg: '#fbbf2430' },
  error:   { bg: '#f8717115', border: '#f8717144', text: '#f87171', selectedBg: '#f8717130' },
  info:    { bg: '#60a5fa15', border: '#60a5fa44', text: '#60a5fa', selectedBg: '#60a5fa30' },
};

const SIZE_MAP: Record<ChipSize, { fontSize: number; height: number; px: number; icon: number }> = {
  sm: { fontSize: 11, height: 22, px: 8,  icon: 12 },
  md: { fontSize: 12, height: 28, px: 10, icon: 14 },
  lg: { fontSize: 13, height: 34, px: 12, icon: 16 },
};

const KEYFRAMES = `
  @keyframes ie-chip-dismiss { 0% { opacity: 1; transform: scale(1) translateX(0); max-width: 300px; margin: 0; } 100% { opacity: 0; transform: scale(0.8) translateX(-8px); max-width: 0; margin: 0; padding: 0; } }
  @keyframes ie-chip-in { 0% { opacity: 0; transform: scale(0.85); } 100% { opacity: 1; transform: scale(1); } }
`;

export function IEChip({
  label,
  icon,
  onDismiss,
  onClick,
  selected = false,
  disabled = false,
  variant = 'filled',
  color = 'default',
  size = 'md',
  className,
  style,
}: IEChipProps): React.ReactElement | null {
  const [visible, setVisible] = useState(true);
  const c = COLOR_MAP[color];
  const s = SIZE_MAP[size];

  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setVisible(false);
    setTimeout(() => onDismiss?.(), 280);
  }, [onDismiss]);

  if (!visible) return null;

  const getBg = () => {
    if (variant === 'outlined' || variant === 'ghost') return 'transparent';
    if (variant === 'gradient') return `linear-gradient(135deg, ${c.bg}, ${c.selectedBg})`;
    return selected ? c.selectedBg : c.bg;
  };

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        className={className}
        onClick={disabled ? undefined : onClick}
        role={onClick ? 'button' : 'status'}
        tabIndex={onClick && !disabled ? 0 : undefined}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          height: s.height,
          padding: `0 ${s.px}px`,
          borderRadius: s.height,
          background: getBg(),
          border: `1px solid ${variant === 'ghost' ? 'transparent' : selected ? c.text + '66' : c.border}`,
          color: c.text,
          fontSize: s.fontSize,
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : onClick ? 'pointer' : 'default',
          opacity: disabled ? 0.4 : 1,
          userSelect: 'none' as const,
          whiteSpace: 'nowrap' as const,
          transition: 'background 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
          animation: 'ie-chip-in 0.2s ease forwards',
          boxShadow: selected ? `0 0 8px ${c.text}22` : 'none',
          outline: 'none',
          ...style,
        }}
      >
        {icon && <span style={{ display: 'flex', fontSize: s.icon }}>{icon}</span>}
        <span>{label}</span>
        {onDismiss && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Remove"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: `${c.text}88`, fontSize: s.icon + 2, lineHeight: 1,
              display: 'flex', alignItems: 'center', fontFamily: 'inherit',
              transition: 'color 0.15s ease',
            }}
          >×</button>
        )}
      </div>
    </>
  );
}

export default IEChip;
