/**
 * IETypewriter — Animated typewriter text effect
 * Types and optionally erases text with a cursor.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

export interface IETypewriterProps {
  strings: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseAfterType?: number;
  pauseAfterDelete?: number;
  loop?: boolean;
  cursor?: boolean;
  cursorChar?: string;
  cursorColor?: string;
  className?: string;
  style?: React.CSSProperties;
  onComplete?: () => void;
}

type Phase = 'typing' | 'pausing' | 'deleting' | 'pause-before-next' | 'done';

const KEYFRAMES = `@keyframes ie-cursor-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`;

export function IETypewriter({
  strings,
  typingSpeed = 60,
  deletingSpeed = 35,
  pauseAfterType = 1800,
  pauseAfterDelete = 300,
  loop = true,
  cursor = true,
  cursorChar = '|',
  cursorColor = '#a78bfa',
  className,
  style,
  onComplete,
}: IETypewriterProps): React.ReactElement {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('typing');
  const [stringIndex, setStringIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  const schedule = useCallback((fn: () => void, delay: number) => {
    timeoutRef.current = setTimeout(() => { if (isMounted.current) fn(); }, delay);
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (strings.length === 0 || phase === 'done') return;
    const currentString = strings[stringIndex];

    if (phase === 'typing') {
      if (charIndex < currentString.length) {
        schedule(() => {
          setText(currentString.slice(0, charIndex + 1));
          setCharIndex((prev) => prev + 1);
        }, typingSpeed + Math.random() * 20); // subtle jitter
      } else {
        schedule(() => setPhase('pausing'), pauseAfterType);
      }
    }

    if (phase === 'pausing') {
      schedule(() => setPhase('deleting'), 0);
    }

    if (phase === 'deleting') {
      if (charIndex > 0) {
        schedule(() => {
          setText(currentString.slice(0, charIndex - 1));
          setCharIndex((prev) => prev - 1);
        }, deletingSpeed);
      } else {
        schedule(() => setPhase('pause-before-next'), pauseAfterDelete);
      }
    }

    if (phase === 'pause-before-next') {
      const nextIndex = stringIndex + 1;
      if (nextIndex < strings.length) {
        schedule(() => { setStringIndex(nextIndex); setPhase('typing'); }, 0);
      } else if (loop) {
        schedule(() => { setStringIndex(0); setPhase('typing'); }, 0);
      } else {
        setPhase('done');
        onComplete?.();
      }
    }
  }, [phase, charIndex, stringIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{KEYFRAMES}</style>
      <span className={className} style={{ display: 'inline', ...style }} aria-live="polite">
        {text}
        {cursor && (
          <span
            aria-hidden="true"
            style={{
              color: cursorColor,
              animation: `ie-cursor-blink 1s step-end infinite`,
              marginLeft: 1,
            }}
          >
            {cursorChar}
          </span>
        )}
      </span>
    </>
  );
}

export default IETypewriter;
