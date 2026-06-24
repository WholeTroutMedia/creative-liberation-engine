/**
 * IECountdown — Animated countdown timer with flip-style display
 */

import { useEffect, useRef, useState } from 'react';
import type React from 'react';

export type CountdownVariant = 'flip' | 'minimal' | 'digital';

export interface IECountdownProps {
  to: Date | number;
  variant?: CountdownVariant;
  showDays?: boolean;
  showHours?: boolean;
  showMinutes?: boolean;
  showSeconds?: boolean;
  color?: string;
  onComplete?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

interface TimeLeft { days: number; hours: number; minutes: number; seconds: number; }

const KEYFRAMES = `
  @keyframes ie-flip-top { 0% { transform: rotateX(0deg); } 100% { transform: rotateX(-90deg); } }
  @keyframes ie-flip-bottom { 0% { transform: rotateX(90deg); } 100% { transform: rotateX(0deg); } }
`;

function getTimeLeft(to: Date | number): TimeLeft {
  const ms = Math.max(0, (typeof to === 'number' ? to : to.getTime()) - Date.now());
  return {
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    seconds: Math.floor((ms % 60000) / 1000),
  };
}

function Digit({ value, label, variant, color }: { value: number; label: string; variant: CountdownVariant; color: string }): React.ReactElement {
  const str = String(value).padStart(2, '0');
  const [prev, setPrev] = useState(str);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (str !== prev) {
      setFlipping(true);
      const t = setTimeout(() => { setPrev(str); setFlipping(false); }, 300);
      return () => clearTimeout(t);
    }
  }, [str, prev]);

  if (variant === 'minimal') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{str}</div>
        <div style={{ fontSize: 10, color: '#555568', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginTop: 4 }}>{label}</div>
      </div>
    );
  }

  if (variant === 'digital') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 36, fontWeight: 700, color, fontFamily: 'monospace',
          background: '#0a0a14', border: '1px solid #333348', borderRadius: 8,
          padding: '8px 16px', lineHeight: 1,
          textShadow: `0 0 10px ${color}88`,
        }}>{str}</div>
        <div style={{ fontSize: 10, color: '#555568', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginTop: 6 }}>{label}</div>
      </div>
    );
  }

  // Flip
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 56, height: 72, perspective: 200 }}>
        {/* Static back */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#1a1a24', borderRadius: 8, fontSize: 36, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' as const,
        }}>{str}</div>
        {/* Flipping face */}
        {flipping && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#1a1a24', borderRadius: 8, fontSize: 36, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' as const,
            animation: `ie-flip-top 0.15s ease-in forwards`,
            backfaceVisibility: 'hidden',
          }}>{prev}</div>
        )}
      </div>
      <div style={{ fontSize: 10, color: '#555568', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginTop: 6 }}>{label}</div>
    </div>
  );
}

function Separator({ variant, color }: { variant: CountdownVariant; color: string }): React.ReactElement {
  return (
    <div style={{
      fontSize: variant === 'digital' ? 28 : 32,
      fontWeight: 700, color: `${color}66`, paddingBottom: 18, lineHeight: 1,
      fontFamily: variant === 'digital' ? 'monospace' : 'inherit',
    }}>:</div>
  );
}

export function IECountdown({
  to,
  variant = 'flip',
  showDays = true,
  showHours = true,
  showMinutes = true,
  showSeconds = true,
  color = '#a78bfa',
  onComplete,
  className,
  style,
}: IECountdownProps): React.ReactElement {
  const [time, setTime] = useState<TimeLeft>(getTimeLeft(to));
  const completedRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const t = getTimeLeft(to);
      setTime(t);
      if (!completedRef.current && t.days === 0 && t.hours === 0 && t.minutes === 0 && t.seconds === 0) {
        completedRef.current = true;
        onComplete?.();
      }
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [to, onComplete]);

  const allParts: { key: keyof TimeLeft; label: string; show: boolean }[] = [
    { key: 'days' as const, label: 'Days', show: showDays },
    { key: 'hours' as const, label: 'Hours', show: showHours },
    { key: 'minutes' as const, label: 'Min', show: showMinutes },
    { key: 'seconds' as const, label: 'Sec', show: showSeconds },
  ];
  const parts = allParts.filter((p) => p.show);

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        className={className}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 12, ...style }}
        aria-live="polite"
        aria-atomic="true"
      >
        {parts.map((p, i) => (
          <div key={p.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <Digit value={time[p.key]} label={p.label} variant={variant} color={color} />
            {i < parts.length - 1 && <Separator variant={variant} color={color} />}
          </div>
        ))}
      </div>
    </>
  );
}

export default IECountdown;
