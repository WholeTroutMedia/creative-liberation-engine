/**
 * SplineBackground — Fixed ambient 3D background layer
 * Renders a Spline scene as a full-viewport fixed background
 * with optional parallax intensity and an overlay for content readability.
 */

import { useCallback, useState } from 'react';
import Spline from '@splinetool/react-spline';
import type { Application as SplineApplication } from '@splinetool/runtime';
import type React from 'react';

export interface SplineBackgroundProps {
  scene: string;
  opacity?: number;
  overlayColor?: string;
  overlayOpacity?: number;
  zIndex?: number;
  onLoad?: (spline: SplineApplication) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function SplineBackground({
  scene,
  opacity = 0.7,
  overlayColor = '#000000',
  overlayOpacity = 0.3,
  zIndex = -1,
  onLoad,
  className,
  style,
}: SplineBackgroundProps): React.ReactElement {
  const [loaded, setLoaded] = useState(false);

  const handleLoad = useCallback(
    (splineApp: SplineApplication) => {
      setLoaded(true);
      onLoad?.(splineApp);
    },
    [onLoad],
  );

  return (
    <div
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        pointerEvents: 'none',
        ...style,
      }}
    >
      {/* Spline canvas */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: loaded ? opacity : 0,
          transition: 'opacity 1s ease',
        }}
      >
        <Spline
          scene={scene}
          onLoad={handleLoad}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Readability overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: overlayColor,
          opacity: overlayOpacity,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

export default SplineBackground;
