/**
 * IEMorphText — Text scramble/morph effect
 * Characters scramble through a character set before resolving to the target.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

export type MorphTextMode = 'scramble' | 'slide' | 'glitch';

export interface IEMorphTextProps {
  text: string;
  mode?: MorphTextMode;
  speed?: number;
  chars?: string;
  color?: string;
  scrambleColor?: string;
  trigger?: 'mount' | 'hover' | 'always';
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
const GLITCH_CHARS = '▓▒░█▄▀■□▪▫◆◇○●';

const KEYFRAMES = `
  @keyframes ie-morph-glitch { 
    0%, 100% { clip-path: inset(0 0 100% 0); } 
    20% { clip-path: inset(0 0 0 0); transform: translateX(-2px); }
    40% { clip-path: inset(80% 0 0 0); transform: translateX(2px); }
    60% { clip-path: inset(30% 0 40% 0); transform: translateX(-1px); }
    80% { clip-path: inset(0 0 70% 0); transform: translateX(0); }
  }
`;

export function IEMorphText({
  text,
  mode = 'scramble',
  speed = 40,
  chars = DEFAULT_CHARS,
  color,
  scrambleColor = '#a78bfa',
  trigger = 'mount',
  className,
  style,
}: IEMorphTextProps): React.ReactElement {
  const [displayed, setDisplayed] = useState(trigger === 'mount' ? '' : text);
  const [hovered, setHovered] = useState(false);
  const iterRef = useRef(0);
  const frameRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const charSet = mode === 'glitch' ? GLITCH_CHARS : chars;

  const scramble = useCallback((target: string) => {
    iterRef.current = 0;
    if (frameRef.current) clearTimeout(frameRef.current);

    const totalIter = target.length * 3;

    const tick = () => {
      setDisplayed(
        target.split('').map((char, i) => {
          if (char === ' ') return ' ';
          if (i < Math.floor(iterRef.current / 3)) return char;
          return charSet[Math.floor(Math.random() * charSet.length)];
        }).join(''),
      );

      iterRef.current++;
      if (iterRef.current < totalIter) {
        frameRef.current = setTimeout(tick, speed / 3);
      } else {
        setDisplayed(target);
      }
    };

    tick();
  }, [charSet, speed]);

  const slideEffect = useCallback((target: string) => {
    let i = 0;
    const tick = () => {
      setDisplayed(target.slice(0, i));
      i++;
      if (i <= target.length) frameRef.current = setTimeout(tick, speed);
    };
    tick();
  }, [speed]);

  const run = useCallback(() => {
    if (mode === 'slide') slideEffect(text);
    else scramble(text);
  }, [mode, text, scramble, slideEffect]);

  useEffect(() => {
    if (trigger === 'mount' || trigger === 'always') run();
    return () => { if (frameRef.current) clearTimeout(frameRef.current); };
  }, [text, trigger, run]);

  useEffect(() => {
    if (trigger === 'hover' && hovered) run();
  }, [hovered, trigger, run]);

  const renderChars = () => {
    const target = text;
    return displayed.split('').map((char, i) => {
      const isResolved = char === target[i];
      return (
        <span
          key={i}
          style={{ color: isResolved ? color : scrambleColor, transition: 'color 0.1s ease' }}
        >
          {char}
        </span>
      );
    });
  };

  return (
    <>
      <style>{KEYFRAMES}</style>
      <span
        className={className}
        style={{ display: 'inline-block', fontVariantNumeric: 'tabular-nums', ...style }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={text}
      >
        {mode === 'glitch' ? (
          <span style={{ position: 'relative' }}>
            <span>{text}</span>
            <span style={{
              position: 'absolute', left: 0, top: 0, color: scrambleColor,
              animation: 'ie-morph-glitch 0.4s steps(1) infinite',
            }}>{displayed || text}</span>
          </span>
        ) : renderChars()}
      </span>
    </>
  );
}

export default IEMorphText;
