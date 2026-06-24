/**
 * IELoader — Animated loading indicator
 * Uses built-in CSS animations for zero-dependency loading states.
 * For custom Lottie loaders, use IEAnimation directly.
 */

import { useMemo } from 'react';
import type { IELoaderProps, LoaderVariant } from '../types.js';

const VARIANT_STYLES: Record<LoaderVariant, React.CSSProperties> = {
  default: {},
  pulse: {},
  orbit: {},
  wave: {},
  morph: {},
};

function generateKeyframes(variant: LoaderVariant): string {
  switch (variant) {
    case 'pulse':
      return `
        @keyframes ie-loader-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.5; }
        }
      `;
    case 'orbit':
      return `
        @keyframes ie-loader-orbit {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
    case 'wave':
      return `
        @keyframes ie-loader-wave-1 { 0%, 40%, 100% { transform: scaleY(0.4); } 20% { transform: scaleY(1); } }
        @keyframes ie-loader-wave-2 { 0%, 40%, 100% { transform: scaleY(0.4); } 20% { transform: scaleY(1); } }
        @keyframes ie-loader-wave-3 { 0%, 40%, 100% { transform: scaleY(0.4); } 20% { transform: scaleY(1); } }
      `;
    case 'morph':
      return `
        @keyframes ie-loader-morph {
          0%, 100% { border-radius: 50%; transform: rotate(0deg); }
          25% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; transform: rotate(90deg); }
          50% { border-radius: 50% 20% 50% 20% / 20% 50% 20% 50%; transform: rotate(180deg); }
          75% { border-radius: 20% 50% 20% 50% / 50% 20% 50% 20%; transform: rotate(270deg); }
        }
      `;
    default:
      return `
        @keyframes ie-loader-default {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
  }
}

export function IELoader({
  variant = 'default',
  size = 40,
  color = '#a78bfa',
  label = 'Loading',
  className,
  style,
}: IELoaderProps): React.ReactElement {
  const keyframes = useMemo(() => generateKeyframes(variant), [variant]);

  const renderLoader = (): React.ReactElement => {
    switch (variant) {
      case 'pulse':
        return (
          <div
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${color}, transparent)`,
              animation: 'ie-loader-pulse 1.4s ease-in-out infinite',
            }}
          />
        );

      case 'orbit':
        return (
          <div
            style={{
              width: size,
              height: size,
              border: `3px solid ${color}22`,
              borderTopColor: color,
              borderRadius: '50%',
              animation: 'ie-loader-orbit 0.8s linear infinite',
            }}
          />
        );

      case 'wave':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.1, height: size }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  width: size * 0.12,
                  height: size,
                  backgroundColor: color,
                  borderRadius: size * 0.06,
                  animation: `ie-loader-wave-1 1.2s ease-in-out ${i * 0.1}s infinite`,
                }}
              />
            ))}
          </div>
        );

      case 'morph':
        return (
          <div
            style={{
              width: size,
              height: size,
              background: `linear-gradient(135deg, ${color}, ${color}88)`,
              animation: 'ie-loader-morph 2s ease-in-out infinite',
            }}
          />
        );

      default:
        return (
          <div
            style={{
              width: size,
              height: size,
              border: `3px solid ${color}33`,
              borderTopColor: color,
              borderRightColor: color,
              borderRadius: '50%',
              animation: 'ie-loader-default 0.7s linear infinite',
            }}
          />
        );
    }
  };

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      role="status"
      aria-label={label}
    >
      <style>{keyframes}</style>
      {renderLoader()}
    </div>
  );
}

export default IELoader;
