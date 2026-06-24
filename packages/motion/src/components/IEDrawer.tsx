/**
 * IEDrawer — Animated slide-in drawer panel
 */

import { useEffect, useState } from 'react';
import type React from 'react';

export type DrawerSide = 'left' | 'right' | 'top' | 'bottom';
export type DrawerSize = 'sm' | 'md' | 'lg' | 'full' | number;

export interface IEDrawerProps {
  open: boolean;
  onClose: () => void;
  side?: DrawerSide;
  size?: DrawerSize;
  title?: React.ReactNode;
  children: React.ReactNode;
  overlay?: boolean;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  trapFocus?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const SIZE_MAP: Record<string, number | string> = {
  sm: 280, md: 360, lg: 480, full: '100%',
};

const KEYFRAMES = `
  @keyframes ie-drawer-fade-in  { 0% { opacity: 0; } 100% { opacity: 1; } }
  @keyframes ie-drawer-fade-out { 0% { opacity: 1; } 100% { opacity: 0; } }
`;

function getTransform(side: DrawerSide, open: boolean): React.CSSProperties {
  const transforms: Record<DrawerSide, string> = {
    left:   open ? 'translateX(0)' : 'translateX(-100%)',
    right:  open ? 'translateX(0)' : 'translateX(100%)',
    top:    open ? 'translateY(0)' : 'translateY(-100%)',
    bottom: open ? 'translateY(0)' : 'translateY(100%)',
  };
  return { transform: transforms[side] };
}

function getSizeStyle(side: DrawerSide, size: DrawerSize): React.CSSProperties {
  const resolvedSize = typeof size === 'number' ? size : SIZE_MAP[size] ?? SIZE_MAP.md;
  if (side === 'left' || side === 'right') return { width: resolvedSize, height: '100%', top: 0, bottom: 0 };
  return { height: resolvedSize, width: '100%', left: 0, right: 0 };
}

function getAnchor(side: DrawerSide): React.CSSProperties {
  return {
    left: side === 'left' ? 0 : undefined,
    right: side === 'right' ? 0 : undefined,
    top: side === 'top' ? 0 : undefined,
    bottom: side === 'bottom' ? 0 : undefined,
  };
}

export function IEDrawer({
  open,
  onClose,
  side = 'right',
  size = 'md',
  title,
  children,
  overlay = true,
  closeOnOverlay = true,
  closeOnEscape = true,
  className,
  style,
}: IEDrawerProps): React.ReactElement | null {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
    } else {
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!closeOnEscape) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, closeOnEscape, onClose]);

  if (!mounted) return null;

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: open ? 'auto' : 'none' }}
        role="dialog"
        aria-modal="true"
      >
        {/* Overlay */}
        {overlay && (
          <div
            onClick={closeOnOverlay ? onClose : undefined}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              animation: open ? 'ie-drawer-fade-in 0.25s ease forwards' : 'ie-drawer-fade-out 0.25s ease forwards',
              cursor: closeOnOverlay ? 'pointer' : 'default',
            }}
          />
        )}

        {/* Panel */}
        <div
          className={className}
          style={{
            position: 'absolute',
            ...getAnchor(side),
            ...getSizeStyle(side, size),
            background: '#111118',
            borderLeft: side === 'right' ? '1px solid #ffffff0d' : undefined,
            borderRight: side === 'left' ? '1px solid #ffffff0d' : undefined,
            borderTop: side === 'bottom' ? '1px solid #ffffff0d' : undefined,
            borderBottom: side === 'top' ? '1px solid #ffffff0d' : undefined,
            display: 'flex',
            flexDirection: 'column',
            ...getTransform(side, open),
            transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: side === 'right' ? '-8px 0 48px rgba(0,0,0,0.5)' : side === 'left' ? '8px 0 48px rgba(0,0,0,0.5)' : '0 -8px 48px rgba(0,0,0,0.5)',
            ...style,
          }}
        >
          {/* Header */}
          {title && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid #ffffff0d',
              fontSize: 15, fontWeight: 600, color: '#e8e8f0', flexShrink: 0,
            }}>
              <span>{title}</span>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', color: '#555568', cursor: 'pointer',
                  fontSize: 20, lineHeight: 1, padding: 4, borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 0.15s ease',
                }}
                aria-label="Close drawer"
              >
                ×
              </button>
            </div>
          )}

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

export default IEDrawer;
