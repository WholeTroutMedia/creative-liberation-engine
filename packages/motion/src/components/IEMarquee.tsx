/**
 * IEMarquee — Infinite smooth scrolling ticker/marquee
 * GPU-accelerated CSS animation. Bidirectional. Hover-to-pause.
 */

import { useRef } from 'react';
import type React from 'react';

export type MarqueeDirection = 'left' | 'right' | 'up' | 'down';

export interface IEMarqueeProps {
  children: React.ReactNode;
  speed?: number;
  direction?: MarqueeDirection;
  pauseOnHover?: boolean;
  gap?: number;
  repeat?: number;
  className?: string;
  style?: React.CSSProperties;
}

const KEYFRAMES = `
  @keyframes ie-marquee-left  { 0% { transform: translateX(0); }   100% { transform: translateX(-50%); } }
  @keyframes ie-marquee-right { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
  @keyframes ie-marquee-up    { 0% { transform: translateY(0); }   100% { transform: translateY(-50%); } }
  @keyframes ie-marquee-down  { 0% { transform: translateY(-50%); } 100% { transform: translateY(0); } }
`;

const ANIM_NAME: Record<MarqueeDirection, string> = {
  left: 'ie-marquee-left', right: 'ie-marquee-right',
  up: 'ie-marquee-up', down: 'ie-marquee-down',
};

export function IEMarquee({
  children,
  speed = 30,
  direction = 'left',
  pauseOnHover = true,
  gap = 24,
  repeat = 4,
  className,
  style,
}: IEMarqueeProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  const isHorizontal = direction === 'left' || direction === 'right';
  const duration = speed;

  const trackStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: isHorizontal ? 'row' : 'column',
    gap,
    animation: `${ANIM_NAME[direction]} ${duration}s linear infinite`,
    willChange: 'transform',
  };

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        ref={containerRef}
        className={className}
        style={{
          overflow: 'hidden',
          display: 'flex',
          flexDirection: isHorizontal ? 'row' : 'column',
          ...style,
        }}
        onMouseEnter={() => {
          if (pauseOnHover && containerRef.current) {
            const track = containerRef.current.querySelector('[data-marquee-track]') as HTMLElement | null;
            if (track) track.style.animationPlayState = 'paused';
          }
        }}
        onMouseLeave={() => {
          if (pauseOnHover && containerRef.current) {
            const track = containerRef.current.querySelector('[data-marquee-track]') as HTMLElement | null;
            if (track) track.style.animationPlayState = 'running';
          }
        }}
      >
        <div data-marquee-track="" style={trackStyle}>
          {Array.from({ length: repeat }).map((_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: isHorizontal ? 'row' : 'column',
                gap,
                flexShrink: 0,
              }}
            >
              {children}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default IEMarquee;
