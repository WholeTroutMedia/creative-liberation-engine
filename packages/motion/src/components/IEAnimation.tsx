/**
 * IEAnimation — Base Lottie animation wrapper
 * The foundational component that all other motion components build on.
 * Uses @lottiefiles/dotlottie-react WASM runtime for optimal performance.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import type { DotLottie } from '@lottiefiles/dotlottie-react';
import type { IEAnimationProps } from '../types.js';

export function IEAnimation({
  src,
  autoplay = true,
  loop = false,
  speed = 1,
  backgroundColor,
  className,
  style,
  width,
  height,
  onComplete,
  onLoad,
  onError,
  'aria-label': ariaLabel,
}: IEAnimationProps): React.ReactElement {
  const [hasError, setHasError] = useState(false);
  const dotLottieRef = useRef<DotLottie | null>(null);

  const handleDotLottieRef = useCallback(
    (dotLottie: DotLottie | null) => {
      dotLottieRef.current = dotLottie;
      if (dotLottie) {
        dotLottie.addEventListener('load', () => {
          onLoad?.();
        });
        dotLottie.addEventListener('complete', () => {
          onComplete?.();
        });
      }
    },
    [onLoad, onComplete],
  );

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (hasError) {
    return (
      <div
        className={className}
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.3,
          ...style,
        }}
        role="img"
        aria-label={ariaLabel ?? 'Animation unavailable'}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="m15 9-6 6M9 9l6 6" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width,
        height,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      role="img"
      aria-label={ariaLabel ?? 'Animation'}
    >
      <DotLottieReact
        src={src}
        autoplay={autoplay}
        loop={loop}
        speed={speed}
        dotLottieRefCallback={handleDotLottieRef}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: backgroundColor ?? 'transparent',
        }}
      />
    </div>
  );
}

export default IEAnimation;
