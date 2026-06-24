/**
 * IEToast — Animated toast notification + IEToaster stack manager
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';

export interface Toast {
  id: string;
  message: string;
  title?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

export interface IEToastProps extends Omit<Toast, 'id'> {
  visible?: boolean;
  onDismiss?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export interface IEToasterProps {
  position?: ToastPosition;
  maxToasts?: number;
}

const VARIANT_CONFIG: Record<ToastVariant, { color: string; icon: string; bg: string; border: string }> = {
  default: { color: '#a78bfa', icon: '◆', bg: '#18181f', border: '#a78bfa33' },
  success: { color: '#4ade80', icon: '✓', bg: '#0f1a14', border: '#4ade8033' },
  error:   { color: '#f87171', icon: '✕', bg: '#1a0f0f', border: '#f8717133' },
  warning: { color: '#fbbf24', icon: '⚠', bg: '#1a1500', border: '#fbbf2433' },
  info:    { color: '#60a5fa', icon: 'i', bg: '#0f1220', border: '#60a5fa33' },
};

const KEYFRAMES = `
  @keyframes ie-toast-in { 0% { opacity: 0; transform: translateY(-16px) scale(0.95); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes ie-toast-out { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(0.9); max-height: 0; margin: 0; } }
`;

export function IEToast({
  message,
  title,
  variant = 'default',
  duration = 4000,
  visible = true,
  action,
  onDismiss,
  className,
  style,
}: IEToastProps): React.ReactElement | null {
  const [exiting, setExiting] = useState(false);
  const [shown, setShown] = useState(true);
  const config = VARIANT_CONFIG[variant];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => { setShown(false); onDismiss?.(); }, 300);
  }, [onDismiss]);

  useEffect(() => {
    if (!visible) { dismiss(); return; }
    if (duration > 0) {
      timerRef.current = setTimeout(dismiss, duration);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible, duration, dismiss]);

  if (!shown) return null;

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        className={className}
        role="alert"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '14px 16px',
          background: config.bg,
          border: `1px solid ${config.border}`,
          borderLeft: `3px solid ${config.color}`,
          borderRadius: 10,
          minWidth: 280,
          maxWidth: 380,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          animation: exiting ? 'ie-toast-out 0.3s ease forwards' : 'ie-toast-in 0.3s ease forwards',
          cursor: 'pointer',
          ...style,
        }}
        onClick={dismiss}
      >
        {/* Icon */}
        <div style={{
          width: 20, height: 20, flexShrink: 0, borderRadius: '50%',
          background: `${config.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: config.color, fontSize: 10, fontWeight: 700, marginTop: 1,
        }}>
          {config.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {title && <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0', marginBottom: 2 }}>{title}</div>}
          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.4 }}>{message}</div>
          {action && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); action.onClick(); dismiss(); }}
              style={{
                marginTop: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                color: config.color, background: `${config.color}18`, border: `1px solid ${config.color}33`,
                borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {action.label}
            </button>
          )}
        </div>

        {/* Dismiss X */}
        <div style={{ color: '#555568', fontSize: 14, flexShrink: 0, lineHeight: 1, marginTop: 2 }}>×</div>
      </div>
    </>
  );
}

// ─── Toaster context & hook ───

interface ToasterContextValue {
  toasts: (Toast & { visible: boolean })[];
  add: (t: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let _globalAdd: ((t: Omit<Toast, 'id'>) => string) | null = null;

export function toast(message: string, opts?: Omit<Toast, 'id' | 'message'>): string {
  if (!_globalAdd) { console.warn('IEToaster not mounted'); return ''; }
  return _globalAdd({ message, ...opts });
}
toast.success = (msg: string, opts?: Omit<Toast, 'id' | 'message' | 'variant'>) => toast(msg, { variant: 'success', ...opts });
toast.error = (msg: string, opts?: Omit<Toast, 'id' | 'message' | 'variant'>) => toast(msg, { variant: 'error', ...opts });
toast.warning = (msg: string, opts?: Omit<Toast, 'id' | 'message' | 'variant'>) => toast(msg, { variant: 'warning', ...opts });
toast.info = (msg: string, opts?: Omit<Toast, 'id' | 'message' | 'variant'>) => toast(msg, { variant: 'info', ...opts });

const POSITION_STYLES: Record<ToastPosition, React.CSSProperties> = {
  'top-right':    { top: 20, right: 20 },
  'top-left':     { top: 20, left: 20 },
  'top-center':   { top: 20, left: '50%', transform: 'translateX(-50%)' },
  'bottom-right': { bottom: 20, right: 20 },
  'bottom-left':  { bottom: 20, left: 20 },
  'bottom-center':{ bottom: 20, left: '50%', transform: 'translateX(-50%)' },
};

export function IEToaster({ position = 'top-right', maxToasts = 5 }: IEToasterProps): React.ReactElement {
  const [toasts, setToasts] = useState<(Toast & { visible: boolean })[]>([]);

  const add = useCallback((t: Omit<Toast, 'id'>): string => {
    const id = crypto.randomUUID();
    setToasts((prev) => [{ ...t, id, visible: true }, ...prev].slice(0, maxToasts));
    return id;
  }, [maxToasts]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, visible: false } : t));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 400);
  }, []);

  useEffect(() => { _globalAdd = add; return () => { _globalAdd = null; }; }, [add]);

  const pos = position.startsWith('bottom') ? 'column-reverse' as const : 'column' as const;

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed', zIndex: 9999,
        display: 'flex', flexDirection: pos, gap: 8,
        ...POSITION_STYLES[position],
      }}
    >
      {toasts.map((t) => (
        <IEToast
          key={t.id}
          message={t.message}
          title={t.title}
          variant={t.variant}
          duration={t.duration}
          visible={t.visible}
          action={t.action}
          onDismiss={() => dismiss(t.id)}
        />
      ))}
    </div>
  );
}

export default IEToast;
