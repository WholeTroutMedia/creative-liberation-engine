/**
 * IEAvatar — Animated avatar with status ring and group stacking
 */

import type React from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'offline' | 'away' | 'busy' | 'none';
export type AvatarShape = 'circle' | 'rounded' | 'square';

export interface IEAvatarProps {
  src?: string;
  alt?: string;
  initials?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  shape?: AvatarShape;
  color?: string;
  badge?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export interface IEAvatarGroupProps {
  avatars: IEAvatarProps[];
  max?: number;
  size?: AvatarSize;
  className?: string;
  style?: React.CSSProperties;
}

const SIZE_PX: Record<AvatarSize, number> = { xs: 24, sm: 32, md: 40, lg: 56, xl: 72 };
const FONT_SIZE: Record<AvatarSize, number> = { xs: 9, sm: 12, md: 14, lg: 18, xl: 24 };
const STATUS_COLORS: Record<AvatarStatus, string> = {
  online: '#4ade80', offline: '#555568', away: '#fbbf24', busy: '#f87171', none: 'transparent',
};

const KEYFRAMES = `
  @keyframes ie-avatar-status-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.4); opacity: 0.5; } }
  @keyframes ie-avatar-hover { 0% { transform: scale(1); } 100% { transform: scale(1.05); } }
`;

const SHAPE_RADIUS: Record<AvatarShape, number | string> = {
  circle: '50%', rounded: '30%', square: 4,
};

function getInitialsBg(initials?: string): string {
  const colors = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#db2777', '#0891b2'];
  const idx = initials ? initials.charCodeAt(0) % colors.length : 0;
  return colors[idx];
}

export function IEAvatar({
  src,
  alt = '',
  initials,
  size = 'md',
  status = 'none',
  shape = 'circle',
  color,
  badge,
  onClick,
  className,
  style,
}: IEAvatarProps): React.ReactElement {
  const px = SIZE_PX[size];
  const radius = SHAPE_RADIUS[shape];
  const statusColor = STATUS_COLORS[status];
  const statusSize = Math.round(px * 0.28);
  const bg = color ?? getInitialsBg(initials);

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        className={className}
        onClick={onClick}
        style={{
          position: 'relative',
          display: 'inline-flex',
          flexShrink: 0,
          cursor: onClick ? 'pointer' : 'default',
          ...style,
        }}
      >
        {/* Avatar face */}
        <div
          style={{
            width: px, height: px, borderRadius: radius,
            background: src ? 'transparent' : bg,
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: FONT_SIZE[size], fontWeight: 700, color: '#fff',
            border: '2px solid rgba(255,255,255,0.08)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            userSelect: 'none' as const,
          }}
        >
          {src ? (
            <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span>{initials?.slice(0, 2).toUpperCase() ?? '?'}</span>
          )}
        </div>

        {/* Status indicator */}
        {status !== 'none' && (
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: statusSize, height: statusSize, borderRadius: '50%',
            background: statusColor,
            border: '2px solid #08080c',
            animation: status === 'online' ? `ie-avatar-status-pulse 2.5s ease-in-out infinite` : undefined,
          }} />
        )}

        {/* Badge overlay */}
        {badge && (
          <div style={{ position: 'absolute', top: -4, right: -4 }}>{badge}</div>
        )}
      </div>
    </>
  );
}

export function IEAvatarGroup({
  avatars,
  max = 5,
  size = 'md',
  className,
  style,
}: IEAvatarGroupProps): React.ReactElement {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - max;
  const px = SIZE_PX[size];
  const overlap = Math.round(px * 0.35);

  return (
    <div className={className} style={{ display: 'flex', ...style }}>
      {visible.map((av, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -overlap, zIndex: visible.length - i }}>
          <IEAvatar {...av} size={size} style={{ boxShadow: '0 0 0 2px #08080c', ...(av.style ?? {}) }} />
        </div>
      ))}
      {overflow > 0 && (
        <div style={{ marginLeft: -overlap, zIndex: 0 }}>
          <div style={{
            width: px, height: px, borderRadius: '50%',
            background: '#1e1e2e', border: '2px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: FONT_SIZE[size], fontWeight: 700, color: '#8888a0',
            boxShadow: '0 0 0 2px #08080c',
          }}>
            +{overflow}
          </div>
        </div>
      )}
    </div>
  );
}

export default IEAvatar;
