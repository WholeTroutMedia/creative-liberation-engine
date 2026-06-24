/**
 * IETooltip — Smart-positioned animated tooltip
 * No external positioning library. Pure geometry + CSS.
 */

import { useCallback, useRef, useState } from 'react';
import type React from 'react';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';
export type TooltipVariant = 'default' | 'accent' | 'dark' | 'glass';

export interface IETooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: TooltipPlacement;
  variant?: TooltipVariant;
  delay?: number;
  offset?: number;
  maxWidth?: number;
  disabled?: boolean;
  className?: string;
}

const KEYFRAMES = `
  @keyframes ie-tooltip-in  { 0% { opacity: 0; transform: scale(0.92) translateY(4px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
`;

const VARIANT_STYLES: Record<TooltipVariant, React.CSSProperties> = {
  default: { background: '#1e1e2e', border: '1px solid #ffffff12', color: '#e8e8f0' },
  accent:  { background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', border: 'none', color: '#fff' },
  dark:    { background: '#0a0a0f', border: '1px solid #ffffff06', color: '#e8e8f0' },
  glass:   { background: 'rgba(14,14,20,0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', color: '#e8e8f0' },
};

export function IETooltip({
  content,
  children,
  placement = 'top',
  variant = 'default',
  delay = 200,
  offset = 8,
  maxWidth = 220,
  disabled = false,
}: IETooltipProps): React.ReactElement {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (disabled) return;
    timerRef.current = setTimeout(() => {
      const el = wrapperRef.current;
      const tip = tooltipRef.current;
      if (!el || !tip) { setVisible(true); return; }
      const r = el.getBoundingClientRect();
      const tw = tip.offsetWidth || maxWidth;
      const th = tip.offsetHeight || 36;
      let t = 0, l = 0;
      if (placement === 'top')    { t = r.top - th - offset + window.scrollY; l = r.left + r.width / 2 - tw / 2 + window.scrollX; }
      if (placement === 'bottom') { t = r.bottom + offset + window.scrollY; l = r.left + r.width / 2 - tw / 2 + window.scrollX; }
      if (placement === 'left')   { t = r.top + r.height / 2 - th / 2 + window.scrollY; l = r.left - tw - offset + window.scrollX; }
      if (placement === 'right')  { t = r.top + r.height / 2 - th / 2 + window.scrollY; l = r.right + offset + window.scrollX; }
      setPos({ top: t, left: Math.max(8, l) });
      setVisible(true);
    }, delay);
  }, [disabled, delay, offset, placement, maxWidth]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div ref={wrapperRef} style={{ display: 'inline-flex' }} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
        {children}
      </div>

      {visible && pos && (
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            maxWidth,
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.4,
            pointerEvents: 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            animation: 'ie-tooltip-in 0.15s ease forwards',
            ...VARIANT_STYLES[variant],
          }}
        >
          {content}
        </div>
      )}
    </>
  );
}

export default IETooltip;
