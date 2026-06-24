/**
 * IESkeleton — Shimmer loading placeholder
 * Replaces content while data loads.
 */

import type React from 'react';

export type SkeletonVariant = 'text' | 'avatar' | 'card' | 'rect' | 'circle';

export interface IESkeletonProps {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number | string;
  lines?: number;
  animated?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Border radius override */
  radius?: number | string;
}

const KEYFRAMES = `
  @keyframes ie-skeleton-shimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
`;

const SHIMMER_BG = `linear-gradient(
  90deg,
  #1a1a24 25%,
  #26263a 37%,
  #1a1a24 63%
) 0 0 / 800px 100%`;

function SkeletonBase({
  width,
  height,
  radius,
  animated,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  animated: boolean;
  style?: React.CSSProperties;
}): React.ReactElement {
  return (
    <div
      style={{
        width: width ?? '100%',
        height: height ?? 16,
        borderRadius: radius ?? 6,
        background: animated ? SHIMMER_BG : '#1a1a24',
        animation: animated ? 'ie-skeleton-shimmer 1.4s ease-in-out infinite' : undefined,
        ...style,
      }}
    />
  );
}

export function IESkeleton({
  variant = 'rect',
  width,
  height,
  lines = 3,
  animated = true,
  className,
  style,
  radius,
}: IESkeletonProps): React.ReactElement {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
        {variant === 'avatar' && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <SkeletonBase width={width ?? 40} height={height ?? 40} radius="50%" animated={animated} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SkeletonBase width="60%" height={12} animated={animated} />
              <SkeletonBase width="40%" height={10} animated={animated} />
            </div>
          </div>
        )}

        {variant === 'card' && (
          <>
            <SkeletonBase width={width ?? '100%'} height={height ?? 160} radius={12} animated={animated} />
            <SkeletonBase width="70%" height={14} animated={animated} />
            <SkeletonBase width="90%" height={12} animated={animated} />
            <SkeletonBase width="50%" height={12} animated={animated} />
          </>
        )}

        {variant === 'text' && (
          <>
            {Array.from({ length: lines }).map((_, i) => (
              <SkeletonBase
                key={i}
                width={i === lines - 1 ? '65%' : '100%'}
                height={14}
                animated={animated}
              />
            ))}
          </>
        )}

        {variant === 'circle' && (
          <SkeletonBase width={width ?? 48} height={height ?? 48} radius="50%" animated={animated} />
        )}

        {variant === 'rect' && (
          <SkeletonBase width={width ?? '100%'} height={height ?? 80} radius={radius ?? 8} animated={animated} />
        )}
      </div>
    </>
  );
}

export default IESkeleton;
