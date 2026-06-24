/**
 * SplineLoader — Full-screen 3D loading screen with progress
 * Designed to sit in front of everything while your app bootstraps.
 */

import { useCallback, useState } from 'react';
import Spline from '@splinetool/react-spline';
import type { Application as SplineApplication } from '@splinetool/runtime';
import type React from 'react';

export interface SplineLoaderProps {
  scene?: string;
  progress?: number;
  title?: string;
  subtitle?: string;
  visible?: boolean;
  onSceneLoad?: (spline: SplineApplication) => void;
  primaryColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

const KEYFRAMES = `
  @keyframes spline-loader-fade-out { 0% { opacity: 1; } 100% { opacity: 0; pointer-events: none; } }
  @keyframes spline-loader-bar      { 0% { width: 0%; } 100% { width: var(--progress, 0%); } }
  @keyframes spline-loader-pulse    { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
`;

export function SplineLoader({
  scene,
  progress = -1,
  title = 'Loading',
  subtitle,
  visible = true,
  onSceneLoad,
  primaryColor = '#a78bfa',
  className,
  style,
}: SplineLoaderProps): React.ReactElement | null {
  const [sceneLoaded, setSceneLoaded] = useState(false);

  const handleLoad = useCallback(
    (app: SplineApplication) => {
      setSceneLoaded(true);
      onSceneLoad?.(app);
    },
    [onSceneLoad],
  );

  if (!visible) return null;

  const indeterminate = progress < 0;

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        className={className}
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: '#08080c',
          animation: !visible ? 'spline-loader-fade-out 0.5s ease forwards' : undefined,
          ...style,
        }}
      >
        {/* 3D Scene */}
        {scene && (
          <div style={{
            position: 'absolute', inset: 0,
            opacity: sceneLoaded ? 0.6 : 0,
            transition: 'opacity 1s ease',
          }}>
            <Spline
              scene={scene}
              onLoad={handleLoad}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        )}

        {/* No scene: animated logo placeholder */}
        {!scene && (
          <div style={{ position: 'relative', marginBottom: 40 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              border: `2px solid ${primaryColor}22`,
              borderTop: `2px solid ${primaryColor}`,
              animation: 'spline-loader-pulse 2s ease-in-out infinite',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                background: `radial-gradient(circle, ${primaryColor}, ${primaryColor}66)`,
                boxShadow: `0 0 20px ${primaryColor}`,
              }} />
            </div>
          </div>
        )}

        {/* Text */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#e8e8f0', marginBottom: 8 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 13, color: '#8888a0', marginBottom: 24 }}>{subtitle}</div>
          )}

          {/* Progress bar */}
          <div style={{ width: 240, height: 2, background: '#1a1a24', borderRadius: 2, overflow: 'hidden' }}>
            {indeterminate ? (
              <div style={{
                height: '100%', borderRadius: 2,
                background: `linear-gradient(90deg, transparent, ${primaryColor}, transparent)`,
                animation: 'ie-progress-indeterminate 1.5s ease-in-out infinite',
              }} />
            ) : (
              <div style={{
                height: '100%', borderRadius: 2,
                background: `linear-gradient(90deg, ${primaryColor}99, ${primaryColor})`,
                width: `${Math.min(100, Math.max(0, progress))}%`,
                transition: 'width 0.3s ease',
              }} />
            )}
          </div>

          {!indeterminate && (
            <div style={{ fontSize: 11, color: '#555568', marginTop: 8 }}>
              {Math.round(progress)}%
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default SplineLoader;
