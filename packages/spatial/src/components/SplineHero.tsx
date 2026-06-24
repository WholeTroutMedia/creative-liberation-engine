/**
 * SplineHero — Full-bleed hero section with Spline 3D backdrop
 * Places interactive 3D behind overlay content for cinematic hero sections.
 */

import { useCallback, useState } from 'react';
import Spline from '@splinetool/react-spline';
import type { Application as SplineApplication } from '@splinetool/runtime';
import type { SplineHeroProps } from '../types.js';

function buildGradient(
  direction: 'top' | 'bottom' | 'both' | 'none',
  color: string,
  opacity: number,
): string {
  const rgba = `${color}`;
  const transparent = `${color}00`;

  switch (direction) {
    case 'top':
      return `linear-gradient(to bottom, ${rgba}${Math.round(opacity * 255).toString(16).padStart(2, '0')}, ${transparent})`;
    case 'bottom':
      return `linear-gradient(to top, ${rgba}${Math.round(opacity * 255).toString(16).padStart(2, '0')}, ${transparent})`;
    case 'both':
      return `linear-gradient(to bottom, ${rgba}${Math.round(opacity * 255).toString(16).padStart(2, '0')}, ${transparent} 30%, ${transparent} 70%, ${rgba}${Math.round(opacity * 255).toString(16).padStart(2, '0')})`;
    case 'none':
    default:
      return 'none';
  }
}

export function SplineHero({
  scene,
  minHeight = 500,
  fullScreen = false,
  children,
  overlayGradient = 'bottom',
  overlayColor = '#000000',
  overlayOpacity = 0.6,
  className,
  style,
  onLoad,
  onError,
  'aria-label': ariaLabel,
}: SplineHeroProps): React.ReactElement {
  const [loading, setLoading] = useState(true);

  const handleLoad = useCallback(
    (splineApp: SplineApplication) => {
      setLoading(false);
      onLoad?.(splineApp);
    },
    [onLoad],
  );

  const gradient = buildGradient(overlayGradient, overlayColor, overlayOpacity);

  return (
    <section
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: fullScreen ? '100vh' : minHeight,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      role="banner"
      aria-label={ariaLabel ?? 'Hero section'}
    >
      {/* Spline 3D Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
        }}
      >
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#0a0a0f',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                border: '3px solid #a78bfa22',
                borderTopColor: '#a78bfa',
                borderRadius: '50%',
                animation: 'ie-hero-spin 0.8s linear infinite',
              }}
            />
            <style>{`@keyframes ie-hero-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        <Spline
          scene={scene}
          onLoad={handleLoad}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>

      {/* Gradient overlay */}
      {overlayGradient !== 'none' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            background: gradient,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Content overlay */}
      {children && (
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            maxWidth: 1200,
            padding: '40px 24px',
          }}
        >
          {children}
        </div>
      )}
    </section>
  );
}

export default SplineHero;
