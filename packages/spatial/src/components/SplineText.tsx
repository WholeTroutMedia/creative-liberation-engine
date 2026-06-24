/**
 * SplineText — Floating 3D text with bob animation and optional Spline scene beneath
 * For hero headings, key phrases, and display text that needs spatial presence.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

export type SplineTextEffect = 'float' | 'glow' | 'gradient' | 'scramble' | 'depth';

export interface SplineTextProps {
  text: string;
  effect?: SplineTextEffect;
  color?: string;
  gradientColors?: [string, string, string?];
  fontSize?: number | string;
  fontWeight?: number | string;
  bobAmplitude?: number;
  bobSpeed?: number;
  glowSpread?: number;
  depthLayers?: number;
  depthOffset?: number;
  className?: string;
  style?: React.CSSProperties;
}

const KEYFRAMES = `
  @keyframes spline-text-bob { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(var(--bob-amp, -12px)); } }
  @keyframes spline-text-gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
  @keyframes spline-text-glow-pulse { 0%, 100% { text-shadow: var(--glow-base); } 50% { text-shadow: var(--glow-intense); } }
`;

function scrambleText(target: string, charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'): string {
  return target.split('').map((c) => c === ' ' ? ' ' : charSet[Math.floor(Math.random() * charSet.length)]).join('');
}

export function SplineText({
  text,
  effect = 'float',
  color = '#a78bfa',
  gradientColors = ['#a78bfa', '#60a5fa', '#f472b6'],
  fontSize = 64,
  fontWeight = 800,
  bobAmplitude = 12,
  bobSpeed = 4,
  glowSpread = 20,
  depthLayers = 4,
  depthOffset = 2,
  className,
  style,
}: SplineTextProps): React.ReactElement {
  const [displayText, setDisplayText] = useState(text);
  const scrambleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (effect !== 'scramble') { setDisplayText(text); return; }
    setResolved(false);
    let iter = 0;
    const totalIter = text.length * 4;

    scrambleRef.current = setInterval(() => {
      if (iter >= totalIter) {
        setDisplayText(text);
        setResolved(true);
        if (scrambleRef.current) clearInterval(scrambleRef.current);
        return;
      }
      const progress = iter / totalIter;
      setDisplayText(
        text.split('').map((c, i) => {
          if (c === ' ') return ' ';
          if (i < Math.floor(progress * text.length)) return c;
          return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)];
        }).join(''),
      );
      iter++;
    }, 40);

    return () => { if (scrambleRef.current) clearInterval(scrambleRef.current); };
  }, [text, effect]);

  const getTextStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = { fontSize, fontWeight, lineHeight: 1.1, letterSpacing: '-0.02em' };

    if (effect === 'float') {
      return {
        ...base,
        color,
        animation: `spline-text-bob ${bobSpeed}s ease-in-out infinite`,
      };
    }

    if (effect === 'glow') {
      return {
        ...base,
        color,
        '--glow-base': `0 0 ${glowSpread}px ${color}66, 0 0 ${glowSpread * 2}px ${color}33` as string,
        '--glow-intense': `0 0 ${glowSpread * 2}px ${color}99, 0 0 ${glowSpread * 4}px ${color}55` as string,
        animation: `spline-text-glow-pulse ${bobSpeed}s ease-in-out infinite`,
        textShadow: `0 0 ${glowSpread}px ${color}66`,
      } as React.CSSProperties;
    }

    if (effect === 'gradient') {
      return {
        ...base,
        background: `linear-gradient(90deg, ${gradientColors[0]}, ${gradientColors[1]}, ${gradientColors[2] ?? gradientColors[0]})`,
        backgroundSize: '200% 200%',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        animation: `spline-text-gradient 4s ease infinite`,
      };
    }

    if (effect === 'depth') {
      const shadows = Array.from({ length: depthLayers }, (_, i) => {
        const step = (i + 1) * depthOffset;
        const opacity = 1 - (i + 1) / (depthLayers + 1);
        return `${step}px ${step}px 0 ${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
      }).join(', ');
      return { ...base, color, textShadow: shadows };
    }

    if (effect === 'scramble') {
      return { ...base, color: resolved ? color : `${color}cc`, fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' };
    }

    return { ...base, color };
  };

  return (
    <>
      <style>
        {KEYFRAMES}
        {`[data-spline-text] { --bob-amp: -${bobAmplitude}px; }`}
      </style>
      <div
        data-spline-text=""
        className={className}
        style={{ display: 'inline-block', ...style }}
      >
        <span style={getTextStyle()}>{displayText}</span>
      </div>
    </>
  );
}

export default SplineText;
