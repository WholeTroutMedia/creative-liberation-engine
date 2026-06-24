/**
 * IESuccess — Animated success confirmation
 * CSS-based success animations with optional auto-dismiss.
 */

import { useCallback, useEffect, useState } from 'react';
import type { IESuccessProps, SuccessVariant } from '../types.js';

function getKeyframes(variant: SuccessVariant): string {
  switch (variant) {
    case 'checkmark':
      return `
        @keyframes ie-success-check-circle { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes ie-success-check-stroke { 0% { stroke-dashoffset: 30; } 100% { stroke-dashoffset: 0; } }
      `;
    case 'confetti':
      return `
        @keyframes ie-success-confetti-pop { 0% { transform: scale(0) rotate(0deg); opacity: 0; } 50% { transform: scale(1.2) rotate(180deg); } 100% { transform: scale(1) rotate(360deg); opacity: 1; } }
        @keyframes ie-success-confetti-particle { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-20px) scale(0); opacity: 0; } }
      `;
    case 'sparkle':
      return `
        @keyframes ie-success-sparkle { 0%, 100% { transform: scale(0); opacity: 0; } 50% { transform: scale(1); opacity: 1; } }
        @keyframes ie-success-sparkle-rotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(180deg); } }
      `;
    default:
      return `
        @keyframes ie-success-default { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
      `;
  }
}

export function IESuccess({
  variant = 'checkmark',
  size = 48,
  color = '#4ade80',
  autoDismissMs = 0,
  onDismiss,
  label = 'Success',
  className,
  style,
}: IESuccessProps): React.ReactElement | null {
  const [visible, setVisible] = useState(true);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  useEffect(() => {
    if (autoDismissMs > 0) {
      const timer = setTimeout(handleDismiss, autoDismissMs);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [autoDismissMs, handleDismiss]);

  if (!visible) return null;

  const keyframes = getKeyframes(variant);

  const renderSuccess = (): React.ReactElement => {
    switch (variant) {
      case 'checkmark':
        return (
          <svg
            width={size}
            height={size}
            viewBox="0 0 48 48"
            fill="none"
            style={{ animation: 'ie-success-check-circle 0.5s ease-out forwards' }}
          >
            <circle cx="24" cy="24" r="22" fill={`${color}22`} stroke={color} strokeWidth="2" />
            <path
              d="M14 24l7 7 13-13"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 30,
                strokeDashoffset: 30,
                animation: 'ie-success-check-stroke 0.4s ease-out 0.3s forwards',
              }}
            />
          </svg>
        );

      case 'confetti':
        return (
          <div style={{ position: 'relative', width: size, height: size }}>
            <div
              style={{
                width: size * 0.6,
                height: size * 0.6,
                borderRadius: '50%',
                backgroundColor: color,
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                animation: 'ie-success-confetti-pop 0.6s ease-out forwards',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width={size * 0.3} height={size * 0.3} viewBox="0 0 24 24" fill="none">
                <path d="M5 12l5 5L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  backgroundColor: [color, '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#10b981'][i],
                  top: `${50 + Math.cos((i * Math.PI) / 3) * 45}%`,
                  left: `${50 + Math.sin((i * Math.PI) / 3) * 45}%`,
                  animation: `ie-success-confetti-particle 0.8s ease-out ${0.2 + i * 0.05}s forwards`,
                }}
              />
            ))}
          </div>
        );

      case 'sparkle':
        return (
          <div
            style={{
              width: size,
              height: size,
              position: 'relative',
              animation: 'ie-success-sparkle-rotate 1s ease-out forwards',
            }}
          >
            <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
              <path
                d="M24 2l3 9 9 3-9 3-3 9-3-9-9-3 9-3z"
                fill={color}
                style={{ animation: 'ie-success-sparkle 0.8s ease-out forwards' }}
              />
              <path
                d="M24 14l1.5 4.5L30 20l-4.5 1.5L24 26l-1.5-4.5L18 20l4.5-1.5z"
                fill={`${color}cc`}
                style={{ animation: 'ie-success-sparkle 0.8s ease-out 0.2s forwards' }}
              />
            </svg>
          </div>
        );

      default:
        return (
          <div
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              backgroundColor: `${color}22`,
              border: `2px solid ${color}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'ie-success-default 0.5s ease-out forwards',
            }}
          >
            <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
              <path d="M5 12l5 5L19 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
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
      {renderSuccess()}
    </div>
  );
}

export default IESuccess;
