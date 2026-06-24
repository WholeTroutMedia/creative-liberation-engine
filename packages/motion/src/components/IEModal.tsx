/**
 * IEModal — Animated modal/dialog (pure motion, no Spline dependency)
 * Glass-morphism panel with smooth mount/unmount and focus trap.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type ModalAnimation = 'scale' | 'slide-up' | 'flip' | 'fade';

export interface IEModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  animation?: ModalAnimation;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const SIZE_MAX: Record<ModalSize, number | string> = {
  sm: 400, md: 540, lg: 700, xl: 900, full: '100%',
};

const ENTER: Record<ModalAnimation, React.CSSProperties> = {
  scale:    { opacity: 0, transform: 'scale(0.93)' },
  'slide-up': { opacity: 0, transform: 'translateY(32px)' },
  flip:     { opacity: 0, transform: 'perspective(800px) rotateX(8deg) translateY(16px)' },
  fade:     { opacity: 0 },
};

const KEYFRAMES = `
  @keyframes ie-modal-overlay-in  { 0% { opacity: 0; } 100% { opacity: 1; } }
  @keyframes ie-modal-overlay-out { 0% { opacity: 1; } 100% { opacity: 0; } }
`;

export function IEModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  animation = 'scale',
  closeOnOverlay = true,
  closeOnEscape = true,
  className,
  style,
}: IEModalProps): React.ReactElement | null {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!closeOnEscape) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, closeOnEscape, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleOverlay = useCallback((e: React.MouseEvent) => {
    if (closeOnOverlay && e.target === e.currentTarget) onClose();
  }, [closeOnOverlay, onClose]);

  if (!mounted) return null;

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        onClick={handleOverlay}
        style={{
          position: 'fixed', inset: 0, zIndex: 1500,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          background: visible ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)',
          backdropFilter: visible ? 'blur(8px)' : 'blur(0px)',
          transition: 'background 0.3s ease, backdrop-filter 0.3s ease',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Modal'}
      >
        <div
          ref={panelRef}
          className={className}
          style={{
            width: '100%',
            maxWidth: SIZE_MAX[size],
            maxHeight: '90vh',
            background: 'rgba(14, 14, 20, 0.95)',
            backdropFilter: 'blur(32px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: size === 'full' ? 0 : 16,
            boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(167,139,250,0.06)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            ...(visible ? { opacity: 1, transform: 'none' } : ENTER[animation]),
            transition: 'opacity 0.3s cubic-bezier(0.4,0,0.2,1), transform 0.35s cubic-bezier(0.34,1.2,0.64,1)',
            ...style,
          }}
        >
          {/* Header */}
          {(title || description) && (
            <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  {title && <h2 style={{ fontSize: 17, fontWeight: 600, color: '#e8e8f0', margin: 0 }}>{title}</h2>}
                  {description && <p style={{ fontSize: 13, color: '#8888a0', marginTop: 4, margin: '4px 0 0' }}>{description}</p>}
                </div>
                <button
                  type="button" onClick={onClose} aria-label="Close modal"
                  style={{ background: 'none', border: 'none', color: '#555568', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 4, borderRadius: 6, fontFamily: 'inherit' }}
                >×</button>
              </div>
              <div style={{ height: 1, background: '#ffffff08', marginTop: 16 }} />
            </div>
          )}

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>{children}</div>

          {/* Footer */}
          {footer && (
            <div style={{ padding: '0 24px 20px', flexShrink: 0, borderTop: '1px solid #ffffff08', paddingTop: 16 }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default IEModal;
