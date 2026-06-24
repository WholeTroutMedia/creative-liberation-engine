/**
 * IEPulse — Attention-grabbing pulse ring for onboarding tooltips and highlights
 */

import type React from 'react';

export type PulseVariant = 'ring' | 'dot' | 'beacon' | 'glow';
export type PulseColor = 'accent' | 'success' | 'error' | 'warning' | 'info' | string;

export interface IEPulseProps {
  variant?: PulseVariant;
  color?: PulseColor;
  size?: number;
  speed?: 'slow' | 'normal' | 'fast';
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const PRESET_COLORS: Record<string, string> = {
  accent: '#a78bfa',
  success: '#4ade80',
  error: '#f87171',
  warning: '#fbbf24',
  info: '#60a5fa',
};

const SPEED_MAP = { slow: '3s', normal: '2s', fast: '1s' };

const KEYFRAMES = `
  @keyframes ie-pulse-ring { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(2); opacity: 0; } }
  @keyframes ie-pulse-dot  { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
  @keyframes ie-pulse-beacon-outer { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(2.5); opacity: 0; } }
  @keyframes ie-pulse-glow { 0%, 100% { box-shadow: 0 0 0 0 currentColor; opacity: 1; } 50% { box-shadow: 0 0 20px 4px currentColor; opacity: 0.7; } }
`;

export function IEPulse({
  variant = 'ring',
  color = 'accent',
  size = 12,
  speed = 'normal',
  children,
  className,
  style,
}: IEPulseProps): React.ReactElement {
  const resolvedColor = PRESET_COLORS[color] ?? color;
  const animDuration = SPEED_MAP[speed];

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        className={className}
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}
      >
        {/* Ring variant */}
        {variant === 'ring' && (
          <>
            <div
              style={{
                position: 'absolute',
                width: size * 2.5,
                height: size * 2.5,
                borderRadius: '50%',
                border: `2px solid ${resolvedColor}`,
                animation: `ie-pulse-ring ${animDuration} ease-out infinite`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: size * 2.5,
                height: size * 2.5,
                borderRadius: '50%',
                border: `2px solid ${resolvedColor}`,
                animation: `ie-pulse-ring ${animDuration} ease-out infinite`,
                animationDelay: `calc(${animDuration} / 2)`,
              }}
            />
            <div
              style={{
                width: size, height: size, borderRadius: '50%',
                backgroundColor: resolvedColor,
                animation: `ie-pulse-dot ${animDuration} ease-in-out infinite`,
              }}
            />
          </>
        )}

        {/* Dot variant */}
        {variant === 'dot' && (
          <div
            style={{
              width: size, height: size, borderRadius: '50%',
              backgroundColor: resolvedColor,
              boxShadow: `0 0 0 ${size * 0.4}px ${resolvedColor}33`,
              animation: `ie-pulse-dot ${animDuration} ease-in-out infinite`,
            }}
          />
        )}

        {/* Beacon variant */}
        {variant === 'beacon' && (
          <>
            <div style={{
              position: 'absolute', width: size * 3, height: size * 3, borderRadius: '50%',
              backgroundColor: `${resolvedColor}22`,
              animation: `ie-pulse-beacon-outer ${animDuration} ease-out infinite`,
            }} />
            <div style={{
              position: 'absolute', width: size * 2, height: size * 2, borderRadius: '50%',
              backgroundColor: `${resolvedColor}33`,
              animation: `ie-pulse-beacon-outer ${animDuration} ease-out infinite`,
              animationDelay: `calc(${animDuration} / 3)`,
            }} />
            <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: resolvedColor, zIndex: 1 }} />
          </>
        )}

        {/* Glow variant */}
        {variant === 'glow' && (
          <div
            style={{
              width: size, height: size, borderRadius: '50%',
              backgroundColor: resolvedColor,
              color: resolvedColor,
              animation: `ie-pulse-glow ${animDuration} ease-in-out infinite`,
            }}
          />
        )}

        {children && <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>}
      </div>
    </>
  );
}

export default IEPulse;
