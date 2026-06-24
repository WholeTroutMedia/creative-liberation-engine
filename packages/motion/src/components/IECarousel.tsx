/**
 * IECarousel — Animated content/card carousel with drag support
 */

import { useCallback, useRef, useState } from 'react';
import type React from 'react';

export type CarouselVariant = 'slide' | 'fade' | 'scale';

export interface IECarouselProps {
  items: React.ReactNode[];
  variant?: CarouselVariant;
  autoPlay?: boolean;
  interval?: number;
  showDots?: boolean;
  showArrows?: boolean;
  loop?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const KEYFRAMES = `
  @keyframes ie-carousel-slide-in  { 0% { opacity: 0; transform: translateX(40px); } 100% { opacity: 1; transform: none; } }
  @keyframes ie-carousel-slide-out { 0% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateX(-40px); } }
  @keyframes ie-carousel-fade-in   { 0% { opacity: 0; } 100% { opacity: 1; } }
  @keyframes ie-carousel-scale-in  { 0% { opacity: 0; transform: scale(0.93); } 100% { opacity: 1; transform: scale(1); } }
`;

export function IECarousel({
  items,
  variant = 'slide',
  autoPlay = false,
  interval = 3000,
  showDots = true,
  showArrows = true,
  loop = true,
  className,
  style,
}: IECarouselProps): React.ReactElement {
  const [current, setCurrent] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragStart = useRef<number | null>(null);

  const go = useCallback((i: number) => {
    const next = loop ? ((i % items.length) + items.length) % items.length : Math.max(0, Math.min(i, items.length - 1));
    setCurrent(next);
    setAnimKey((k) => k + 1);
  }, [items.length, loop]);

  const prev = useCallback(() => go(current - 1), [go, current]);
  const next = useCallback(() => go(current + 1), [go, current]);

  // Auto-play
  useState(() => {
    if (autoPlay) {
      autoRef.current = setInterval(() => go(current + 1), interval);
      return () => { if (autoRef.current) clearInterval(autoRef.current); };
    }
  });

  // Drag/swipe
  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    dragStart.current = 'touches' in e ? e.touches[0].clientX : e.clientX;
  };
  const onDragEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (dragStart.current === null) return;
    const x = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
    const diff = dragStart.current - x;
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev();
    dragStart.current = null;
  };

  const getAnimation = () => {
    if (variant === 'fade') return `ie-carousel-fade-in 0.35s ease forwards`;
    if (variant === 'scale') return `ie-carousel-scale-in 0.35s cubic-bezier(0.34,1.2,0.64,1) forwards`;
    return `ie-carousel-slide-in 0.4s cubic-bezier(0.4,0,0.2,1) forwards`;
  };

  const canPrev = loop || current > 0;
  const canNext = loop || current < items.length - 1;

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        className={className}
        style={{ display: 'flex', flexDirection: 'column', gap: 16, userSelect: 'none', ...style }}
      >
        {/* Viewport */}
        <div
          style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}
          onMouseDown={onDragStart}
          onMouseUp={onDragEnd}
          onTouchStart={onDragStart}
          onTouchEnd={onDragEnd}
        >
          <div
            key={animKey}
            style={{ animation: getAnimation() }}
          >
            {items[current]}
          </div>

          {/* Arrow buttons */}
          {showArrows && (
            <>
              {canPrev && (
                <button
                  type="button"
                  onClick={prev}
                  style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'rgba(17,17,24,0.85)', backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#e8e8f0', fontSize: 18, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s ease', fontFamily: 'inherit',
                  }}
                  aria-label="Previous"
                >‹</button>
              )}
              {canNext && (
                <button
                  type="button"
                  onClick={next}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'rgba(17,17,24,0.85)', backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#e8e8f0', fontSize: 18, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s ease', fontFamily: 'inherit',
                  }}
                  aria-label="Next"
                >›</button>
              )}
            </>
          )}
        </div>

        {/* Dots */}
        {showDots && items.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                style={{
                  width: i === current ? 20 : 8, height: 8, borderRadius: 100,
                  background: i === current ? '#a78bfa' : '#333348',
                  border: 'none', cursor: 'pointer', padding: 0,
                  transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default IECarousel;
