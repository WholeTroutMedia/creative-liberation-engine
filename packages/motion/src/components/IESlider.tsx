/**
 * IESlider — Animated range slider with fill track and value tooltip
 */

import { useCallback, useRef, useState } from 'react';
import type React from 'react';

export type SliderVariant = 'default' | 'gradient' | 'stepped';

export interface IESliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  variant?: SliderVariant;
  color?: string;
  showValue?: boolean;
  showMarks?: boolean;
  marks?: { value: number; label?: string }[];
  disabled?: boolean;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

const KEYFRAMES = `
  @keyframes ie-slider-pop { 0% { transform: translateX(-50%) scale(0.7); opacity: 0; } 100% { transform: translateX(-50%) scale(1); opacity: 1; } }
`;

export function IESlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  variant = 'default',
  color = '#a78bfa',
  showValue = true,
  showMarks = false,
  marks,
  disabled = false,
  label,
  className,
  style,
}: IESliderProps): React.ReactElement {
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const pct = ((value - min) / (max - min)) * 100;

  const getValueAt = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return value;
    const rect = track.getBoundingClientRect();
    const raw = (clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, raw));
    const raw2 = min + clamped * (max - min);
    return Math.round(raw2 / step) * step;
  }, [min, max, step, value]);

  const handleTrackClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    onChange(getValueAt(e.clientX));
  }, [disabled, getValueAt, onChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setDragging(true);

    const onMove = (ev: MouseEvent) => onChange(getValueAt(ev.clientX));
    const onUp = () => { setDragging(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [disabled, getValueAt, onChange]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(max, value + step));
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(min, value - step));
    if (e.key === 'Home') onChange(min);
    if (e.key === 'End') onChange(max);
  }, [disabled, value, step, min, max, onChange]);

  const getTrackFill = (): React.CSSProperties => {
    if (variant === 'gradient') {
      return { background: `linear-gradient(90deg, ${color}66, ${color})`, width: `${pct}%` };
    }
    return { background: color, width: `${pct}%` };
  };

  const allMarks: { value: number; label?: string }[] = marks ?? (showMarks ? Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => ({ value: min + i * step })) : []);

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div className={className} style={{ width: '100%', userSelect: 'none' as const, ...style }}>
        {(label || showValue) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            {label && <span style={{ fontSize: 13, color: '#8888a0' }}>{label}</span>}
            {showValue && <span style={{ fontSize: 13, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>}
          </div>
        )}

        {/* Track */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          style={{ position: 'relative', height: 6, background: '#1e1e2e', borderRadius: 3, cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          {/* Fill */}
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 3, transition: dragging ? 'none' : 'width 0.07s linear', ...getTrackFill() }} />

          {/* Marks */}
          {allMarks.map((m) => {
            const mp = ((m.value - min) / (max - min)) * 100;
            return (
              <div key={m.value} style={{ position: 'absolute', left: `${mp}%`, top: '50%', transform: 'translate(-50%, -50%)' }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: m.value <= value ? color : '#333348' }} />
                {m.label && <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: '#555568', whiteSpace: 'nowrap' as const }}>{m.label}</div>}
              </div>
            );
          })}

          {/* Thumb */}
          <div
            role="slider"
            aria-valuenow={value}
            aria-valuemin={min}
            aria-valuemax={max}
            tabIndex={disabled ? -1 : 0}
            onMouseDown={handleMouseDown}
            onKeyDown={handleKey}
            style={{
              position: 'absolute',
              left: `${pct}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: dragging ? 20 : 16,
              height: dragging ? 20 : 16,
              borderRadius: '50%',
              background: '#fff',
              border: `2px solid ${color}`,
              boxShadow: dragging ? `0 0 0 4px ${color}33, 0 4px 12px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.3)',
              cursor: disabled ? 'not-allowed' : 'grab',
              transition: dragging ? 'width 0.1s ease, height 0.1s ease, box-shadow 0.1s ease' : 'left 0.07s linear, width 0.1s ease, height 0.1s ease, box-shadow 0.1s ease',
              zIndex: 1,
              outline: 'none',
            }}
          >
            {/* Value tooltip */}
            {dragging && showValue && (
              <div style={{
                position: 'absolute', bottom: '120%', left: '50%',
                transform: 'translateX(-50%)',
                background: color, color: '#fff',
                fontSize: 10, fontWeight: 700, borderRadius: 4,
                padding: '2px 6px', whiteSpace: 'nowrap' as const,
                animation: 'ie-slider-pop 0.15s ease forwards',
              }}>{value}</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default IESlider;
