/**
 * IERating — Animated star/emoji rating component
 */

import { useCallback, useState } from 'react';
import type React from 'react';

export type RatingVariant = 'star' | 'heart' | 'emoji' | 'number';
export type RatingSize = 'sm' | 'md' | 'lg';

export interface IERatingProps {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  variant?: RatingVariant;
  size?: RatingSize;
  color?: string;
  allowHalf?: boolean;
  readonly?: boolean;
  showLabel?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const SIZE_MAP: Record<RatingSize, number> = { sm: 16, md: 24, lg: 32 };

const EMOJI_MAP: Record<number, string> = {
  1: '😞', 2: '😕', 3: '😐', 4: '😊', 5: '🤩',
};

const LABELS = ['Terrible', 'Bad', 'Okay', 'Good', 'Excellent'];

const KEYFRAMES = `
  @keyframes ie-rating-pop { 0% { transform: scale(0.6); } 60% { transform: scale(1.3); } 100% { transform: scale(1); } }
  @keyframes ie-rating-heart { 0% { transform: scale(1); } 30% { transform: scale(1.4); } 60% { transform: scale(0.9); } 100% { transform: scale(1); } }
`;

function getSymbol(variant: RatingVariant, index: number, filled: boolean, hovered: boolean): string {
  if (variant === 'star') return filled ? '★' : '☆';
  if (variant === 'heart') return filled ? '♥' : '♡';
  if (variant === 'emoji') return filled ? EMOJI_MAP[index + 1] : '○';
  return String(index + 1);
}

export function IERating({
  value,
  onChange,
  max = 5,
  variant = 'star',
  size = 'md',
  color = '#fbbf24',
  allowHalf = false,
  readonly = false,
  showLabel = false,
  className,
  style,
}: IERatingProps): React.ReactElement {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [lastClicked, setLastClicked] = useState<number | null>(null);
  const px = SIZE_MAP[size];
  const display = hoverValue ?? value;

  const handleClick = useCallback((i: number) => {
    if (readonly || !onChange) return;
    const newVal = i + 1;
    setLastClicked(newVal);
    setTimeout(() => setLastClicked(null), 500);
    onChange(newVal === value ? 0 : newVal);
  }, [readonly, onChange, value]);

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div className={className} style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, ...style }}>
        <div style={{ display: 'flex', gap: variant === 'emoji' ? 4 : 2 }}>
          {Array.from({ length: max }, (_, i) => {
            const filled = i < display;
            const isLast = lastClicked === i + 1;

            return (
              <button
                key={i}
                type="button"
                disabled={readonly}
                onClick={() => handleClick(i)}
                onMouseEnter={() => !readonly && setHoverValue(i + 1)}
                onMouseLeave={() => !readonly && setHoverValue(null)}
                aria-label={`${i + 1} of ${max}`}
                style={{
                  background: 'none', border: 'none', padding: 2,
                  cursor: readonly ? 'default' : 'pointer', fontFamily: 'inherit',
                  fontSize: px,
                  color: filled ? color : '#333348',
                  transition: 'color 0.15s ease, transform 0.15s ease',
                  transform: isLast ? 'scale(1)' : undefined,
                  animation: isLast ? `ie-rating-${variant === 'heart' ? 'heart' : 'pop'} 0.4s ease` : undefined,
                  filter: filled && hoverValue !== null ? `drop-shadow(0 0 4px ${color}88)` : undefined,
                  outline: 'none',
                }}
              >
                {getSymbol(variant, i, filled, hoverValue !== null && i < (hoverValue ?? 0))}
              </button>
            );
          })}
        </div>

        {showLabel && display > 0 && (
          <div style={{ fontSize: 11, color, fontWeight: 500, height: 16 }}>
            {variant === 'emoji' ? EMOJI_MAP[Math.round(display)] : LABELS[Math.min(4, Math.round(display) - 1)]}
          </div>
        )}
      </div>
    </>
  );
}

export default IERating;
