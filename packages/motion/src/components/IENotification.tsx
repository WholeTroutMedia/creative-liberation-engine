/**
 * IENotification — Persistent notification bell + sliding panel
 * Different from IEToast (ephemeral) — these are persistent inbox-style notifications.
 */

import { useCallback, useState } from 'react';
import type React from 'react';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'update';

export interface Notification {
  id: string;
  type?: NotificationType;
  title: string;
  message?: string;
  timestamp?: string;
  read?: boolean;
  action?: { label: string; onClick: () => void };
  avatar?: string;
}

export interface IENotificationProps {
  notifications: Notification[];
  onRead?: (id: string) => void;
  onReadAll?: () => void;
  onDismiss?: (id: string) => void;
  onClear?: () => void;
  maxHeight?: number;
  className?: string;
  style?: React.CSSProperties;
}

export interface IENotificationBellProps {
  count?: number;
  notifications: Notification[];
  onRead?: (id: string) => void;
  onReadAll?: () => void;
  onDismiss?: (id: string) => void;
  onClear?: () => void;
  color?: string;
}

const TYPE_CONFIG: Record<NotificationType, { color: string; icon: string }> = {
  info:    { color: '#60a5fa', icon: 'i' },
  success: { color: '#4ade80', icon: '✓' },
  warning: { color: '#fbbf24', icon: '⚠' },
  error:   { color: '#f87171', icon: '✕' },
  update:  { color: '#a78bfa', icon: '↑' },
};

const KEYFRAMES = `
  @keyframes ie-notif-in { 0% { opacity: 0; transform: translateY(-8px) scale(0.97); } 100% { opacity: 1; transform: none; } }
  @keyframes ie-bell-shake { 0%, 100% { transform: rotate(0); } 20% { transform: rotate(-10deg); } 40% { transform: rotate(10deg); } 60% { transform: rotate(-6deg); } 80% { transform: rotate(6deg); } }
`;

function NotificationItem({
  n,
  onRead,
  onDismiss,
}: {
  n: Notification;
  onRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
}): React.ReactElement {
  const cfg = TYPE_CONFIG[n.type ?? 'info'];

  return (
    <div
      onClick={() => !n.read && onRead?.(n.id)}
      style={{
        display: 'flex', gap: 10, padding: '12px 16px',
        background: n.read ? 'transparent' : '#1a1a2e',
        borderBottom: '1px solid #ffffff06',
        cursor: n.read ? 'default' : 'pointer',
        transition: 'background 0.15s ease',
        animation: 'ie-notif-in 0.2s ease forwards',
      }}
    >
      {/* Type icon / avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: `${cfg.color}15`, border: `1px solid ${cfg.color}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: cfg.color,
      }}>
        {n.avatar ? (
          <img src={n.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        ) : cfg.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: n.read ? '#8888a0' : '#e8e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
            {n.title}
          </div>
          {n.timestamp && <div style={{ fontSize: 10, color: '#555568', flexShrink: 0 }}>{n.timestamp}</div>}
        </div>
        {n.message && <div style={{ fontSize: 12, color: '#8888a0', lineHeight: 1.4 }}>{n.message}</div>}
        {n.action && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); n.action!.onClick(); }}
            style={{
              marginTop: 6, fontSize: 11, fontWeight: 600, color: cfg.color,
              background: `${cfg.color}15`, border: `1px solid ${cfg.color}33`,
              borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >{n.action.label}</button>
        )}
      </div>

      {/* Unread dot + dismiss */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {!n.read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color }} />}
        {onDismiss && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
            style={{ background: 'none', border: 'none', color: '#555568', cursor: 'pointer', fontSize: 14, padding: 0, fontFamily: 'inherit' }}
            aria-label="Dismiss"
          >×</button>
        )}
      </div>
    </div>
  );
}

export function IENotification({
  notifications,
  onRead,
  onReadAll,
  onDismiss,
  onClear,
  maxHeight = 400,
  className,
  style,
}: IENotificationProps): React.ReactElement {
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        className={className}
        style={{
          width: 340,
          background: '#0e0e16',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          ...style,
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid #ffffff08',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f0' }}>Notifications</span>
            {unread > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#fff',
                background: '#a78bfa', borderRadius: 100, padding: '1px 6px',
              }}>{unread}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {onReadAll && unread > 0 && (
              <button type="button" onClick={onReadAll} style={{ fontSize: 11, color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Mark all read
              </button>
            )}
            {onClear && notifications.length > 0 && (
              <button type="button" onClick={onClear} style={{ fontSize: 11, color: '#555568', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', maxHeight }}>
          {notifications.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#555568', fontSize: 13 }}>
              All caught up! 🎉
            </div>
          ) : notifications.map((n) => (
            <NotificationItem key={n.id} n={n} onRead={onRead} onDismiss={onDismiss} />
          ))}
        </div>
      </div>
    </>
  );
}

export function IENotificationBell({
  count = 0,
  notifications,
  onRead,
  onReadAll,
  onDismiss,
  onClear,
  color = '#a78bfa',
}: IENotificationBellProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [shaking, setShaking] = useState(false);

  const shake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  }, []);

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => { setOpen((p) => !p); if (count > 0) shake(); }}
        aria-label={`Notifications${count > 0 ? `, ${count} unread` : ''}`}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 8,
          color, fontSize: 20, fontFamily: 'inherit', position: 'relative', display: 'flex',
          animation: shaking ? 'ie-bell-shake 0.5s ease' : undefined,
        }}
      >
        🔔
        {count > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 16, height: 16, borderRadius: '50%',
            background: '#f87171', color: '#fff',
            fontSize: 9, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #08080c',
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 9000, marginTop: 8, animation: 'ie-notif-in 0.2s ease forwards' }}>
          <IENotification
            notifications={notifications}
            onRead={onRead}
            onReadAll={onReadAll}
            onDismiss={onDismiss}
            onClear={onClear}
          />
        </div>
      )}
    </div>
  );
}

export default IENotification;
