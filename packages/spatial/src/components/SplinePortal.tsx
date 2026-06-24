/**
 * SplinePortal — Modal/dialog with a Spline scene as the backdrop
 * Full-screen portal with 3D scene behind content.
 */

import { useCallback, useEffect, useState } from 'react';
import Spline from '@splinetool/react-spline';
import type { Application as SplineApplication } from '@splinetool/runtime';
import type React from 'react';

export interface SplinePortalProps {
  open: boolean;
  onClose: () => void;
  scene?: string;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: number | string;
  overlayOpacity?: number;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  onSceneLoad?: (spline: SplineApplication) => void;
  className?: string;
  style?: React.CSSProperties;
}

const KEYFRAMES = `
  @keyframes ie-portal-fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
  @keyframes ie-portal-slide-up { 0% { opacity: 0; transform: translateY(24px) scale(0.97); } 100% { opacity: 1; transform: none; } }
`;

export function SplinePortal({
  open,
  onClose,
  scene,
  title,
  children,
  maxWidth = 600,
  overlayOpacity = 0.85,
  closeOnOverlay = true,
  closeOnEscape = true,
  onSceneLoad,
  className,
  style,
}: SplinePortalProps): React.ReactElement | null {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Tiny delay so CSS animation plays
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 350);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!closeOnEscape) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, closeOnEscape, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleLoad = useCallback(
    (splineApp: SplineApplication) => onSceneLoad?.(splineApp),
    [onSceneLoad],
  );

  if (!mounted) return null;

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        {/* Backdrop */}
        <div
          onClick={closeOnOverlay ? onClose : undefined}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#000',
            opacity: visible ? overlayOpacity : 0,
            transition: 'opacity 0.35s ease',
            cursor: closeOnOverlay ? 'pointer' : 'default',
          }}
        />

        {/* Spline 3D scene behind panel */}
        {scene && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: visible ? 0.6 : 0,
              transition: 'opacity 0.6s ease 0.1s',
              pointerEvents: 'none',
            }}
          >
            <Spline
              scene={scene}
              onLoad={handleLoad}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        )}

        {/* Content panel */}
        <div
          className={className}
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth,
            maxHeight: '90vh',
            background: 'rgba(17, 17, 24, 0.92)',
            backdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(167,139,250,0.08)',
            display: 'flex',
            flexDirection: 'column',
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'translateY(24px) scale(0.97)',
            transition: 'opacity 0.35s ease, transform 0.35s cubic-bezier(0.4,0,0.2,1)',
            ...style,
          }}
        >
          {/* Header */}
          {title && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px 0',
              fontSize: 17, fontWeight: 600, color: '#e8e8f0', flexShrink: 0,
            }}>
              <span>{title}</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  background: 'none', border: 'none', color: '#555568', cursor: 'pointer',
                  fontSize: 22, lineHeight: 1, padding: 4, borderRadius: 6,
                  transition: 'color 0.15s ease',
                  fontFamily: 'inherit',
                }}
              >
                ×
              </button>
            </div>
          )}

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px' }}>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

export default SplinePortal;
