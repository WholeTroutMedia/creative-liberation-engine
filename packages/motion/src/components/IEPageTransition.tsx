/**
 * IEPageTransition — Full-page route transition wrapper
 * Drop in around Router.Outlet or page components for animated page changes.
 */

import { useEffect, useState } from 'react';
import type React from 'react';

export type PageTransitionType = 'slide-left' | 'slide-right' | 'fade' | 'scale' | 'dissolve' | 'push-up' | 'morph';

export interface IEPageTransitionProps {
  children: React.ReactNode;
  /** Change this key to trigger a transition */
  routeKey: string;
  type?: PageTransitionType;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

const ENTER_STYLES: Record<PageTransitionType, React.CSSProperties> = {
  'slide-left':  { opacity: 0, transform: 'translateX(40px)' },
  'slide-right': { opacity: 0, transform: 'translateX(-40px)' },
  'fade':        { opacity: 0 },
  'scale':       { opacity: 0, transform: 'scale(0.96)' },
  'dissolve':    { opacity: 0, filter: 'blur(8px)' },
  'push-up':     { opacity: 0, transform: 'translateY(24px)' },
  'morph':       { opacity: 0, transform: 'scale(0.94) translateY(8px)', filter: 'blur(4px)' },
};

const EXIT_STYLES: Record<PageTransitionType, React.CSSProperties> = {
  'slide-left':  { opacity: 0, transform: 'translateX(-40px)' },
  'slide-right': { opacity: 0, transform: 'translateX(40px)' },
  'fade':        { opacity: 0 },
  'scale':       { opacity: 0, transform: 'scale(1.04)' },
  'dissolve':    { opacity: 0, filter: 'blur(8px)' },
  'push-up':     { opacity: 0, transform: 'translateY(-24px)' },
  'morph':       { opacity: 0, transform: 'scale(1.06) translateY(-8px)', filter: 'blur(4px)' },
};

const VISIBLE_STYLE: React.CSSProperties = { opacity: 1, transform: 'none', filter: 'none' };

export function IEPageTransition({
  children,
  routeKey,
  type = 'fade',
  duration = 300,
  className,
  style,
}: IEPageTransitionProps): React.ReactElement {
  const [displayedKey, setDisplayedKey] = useState(routeKey);
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const [phase, setPhase] = useState<'visible' | 'exiting' | 'entering'>('visible');

  useEffect(() => {
    if (routeKey === displayedKey) return;

    // Start exit
    setPhase('exiting');

    const exitTimer = setTimeout(() => {
      setDisplayedChildren(children);
      setDisplayedKey(routeKey);
      setPhase('entering');

      const enterTimer = setTimeout(() => {
        setPhase('visible');
      }, 50);

      return () => clearTimeout(enterTimer);
    }, duration);

    return () => clearTimeout(exitTimer);
  }, [routeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentStyle =
    phase === 'exiting' ? EXIT_STYLES[type]
    : phase === 'entering' ? ENTER_STYLES[type]
    : VISIBLE_STYLE;

  return (
    <div
      className={className}
      style={{
        willChange: 'opacity, transform',
        ...currentStyle,
        transition: phase === 'visible'
          ? `opacity ${duration}ms cubic-bezier(0.4,0,0.2,1), transform ${duration}ms cubic-bezier(0.4,0,0.2,1), filter ${duration}ms ease`
          : `opacity ${duration}ms cubic-bezier(0.4,0,0.2,1), transform ${duration}ms cubic-bezier(0.4,0,0.2,1), filter ${duration}ms ease`,
        ...style,
      }}
    >
      {displayedChildren}
    </div>
  );
}

export default IEPageTransition;
