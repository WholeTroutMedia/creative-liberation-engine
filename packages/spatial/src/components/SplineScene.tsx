/**
 * SplineScene — Embeddable Spline 3D scene wrapper
 * Wraps @splinetool/react-spline with loading states and error handling.
 */

import { useCallback, useState } from 'react';
import Spline from '@splinetool/react-spline';
import type { Application as SplineApplication } from '@splinetool/runtime';
import type { SplineSceneProps } from '../types.js';

export function SplineScene({
  scene,
  width = '100%',
  height = 400,
  transparent = false,
  className,
  style,
  onLoad,
  onError,
  'aria-label': ariaLabel,
}: SplineSceneProps): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(
    (splineApp: SplineApplication) => {
      setLoading(false);
      onLoad?.(splineApp);
    },
    [onLoad],
  );

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
          backgroundColor: '#0f0f14',
          borderRadius: 12,
          color: '#64748b',
          fontSize: 14,
          ...style,
        }}
        role="img"
        aria-label={ariaLabel ?? '3D scene unavailable'}
      >
        <div style={{ textAlign: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 8, opacity: 0.5 }}>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
          <div>3D scene could not be loaded</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: 12,
        overflow: 'hidden',
        ...style,
      }}
      role="img"
      aria-label={ariaLabel ?? 'Interactive 3D scene'}
    >
      {/* Loading overlay */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f0f14',
            zIndex: 1,
            transition: 'opacity 0.5s ease',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid #a78bfa33',
              borderTopColor: '#a78bfa',
              borderRadius: '50%',
              animation: 'ie-spatial-spin 0.7s linear infinite',
            }}
          />
          <style>{`@keyframes ie-spatial-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
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
  );
}

export default SplineScene;
