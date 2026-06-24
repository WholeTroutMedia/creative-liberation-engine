/**
 * IETransition — Animated show/hide wrapper
 * Pure CSS transitions for mounting/unmounting content.
 */

import { useEffect, useRef, useState } from 'react';
import type { IETransitionProps, TransitionType } from '../types.js';

interface TransitionStyles {
  entering: React.CSSProperties;
  entered: React.CSSProperties;
  exiting: React.CSSProperties;
  exited: React.CSSProperties;
}

function getTransitionStyles(type: TransitionType, duration: number): TransitionStyles {
  const transition = `all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;

  const styles: Record<TransitionType, TransitionStyles> = {
    fade: {
      entering: { opacity: 0, transition },
      entered: { opacity: 1, transition },
      exiting: { opacity: 0, transition },
      exited: { opacity: 0, display: 'none' },
    },
    'slide-up': {
      entering: { opacity: 0, transform: 'translateY(16px)', transition },
      entered: { opacity: 1, transform: 'translateY(0)', transition },
      exiting: { opacity: 0, transform: 'translateY(16px)', transition },
      exited: { opacity: 0, transform: 'translateY(16px)', display: 'none' },
    },
    'slide-down': {
      entering: { opacity: 0, transform: 'translateY(-16px)', transition },
      entered: { opacity: 1, transform: 'translateY(0)', transition },
      exiting: { opacity: 0, transform: 'translateY(-16px)', transition },
      exited: { opacity: 0, transform: 'translateY(-16px)', display: 'none' },
    },
    scale: {
      entering: { opacity: 0, transform: 'scale(0.95)', transition },
      entered: { opacity: 1, transform: 'scale(1)', transition },
      exiting: { opacity: 0, transform: 'scale(0.95)', transition },
      exited: { opacity: 0, transform: 'scale(0.95)', display: 'none' },
    },
    blur: {
      entering: { opacity: 0, filter: 'blur(8px)', transition },
      entered: { opacity: 1, filter: 'blur(0px)', transition },
      exiting: { opacity: 0, filter: 'blur(8px)', transition },
      exited: { opacity: 0, filter: 'blur(8px)', display: 'none' },
    },
  };

  return styles[type];
}

type TransitionPhase = 'entering' | 'entered' | 'exiting' | 'exited';

export function IETransition({
  show,
  type = 'fade',
  duration = 300,
  delay = 0,
  children,
  className,
  style,
}: IETransitionProps): React.ReactElement {
  const [phase, setPhase] = useState<TransitionPhase>(show ? 'entered' : 'exited');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (show) {
      setPhase('entering');
      timeoutRef.current = setTimeout(() => {
        setPhase('entered');
      }, delay + 20); // 20ms for browser paint
    } else {
      setPhase('exiting');
      timeoutRef.current = setTimeout(() => {
        setPhase('exited');
      }, duration + delay);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [show, duration, delay]);

  const transitionStyles = getTransitionStyles(type, duration);
  const currentStyle = transitionStyles[phase];

  return (
    <div
      className={className}
      style={{
        ...currentStyle,
        transitionDelay: delay > 0 ? `${delay}ms` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default IETransition;
