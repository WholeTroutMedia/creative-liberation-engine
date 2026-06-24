/**
 * IEPopover — Animated rich floating content anchor
 * Positions itself relative to trigger using getBoundingClientRect.
 * Full content slot — use for menus, filters, rich previews.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

export type PopoverPlacement = 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
export type PopoverTrigger = 'click' | 'hover' | 'focus';

export interface IEPopoverProps {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: PopoverPlacement;
  trigger?: PopoverTrigger;
  offset?: number;
  arrow?: boolean;
  maxWidth?: number;
  closeOnOutside?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const KEYFRAMES = `
  @keyframes ie-popover-in { 0% { opacity: 0; transform: scale(0.94) translateY(6px); } 100% { opacity: 1; transform: none; } }
`;

export function IEPopover({
  content,
  children,
  placement = 'bottom',
  trigger = 'click',
  offset = 10,
  arrow = true,
  maxWidth = 280,
  closeOnOutside = true,
  className,
  style,
}: IEPopoverProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [arrowPos, setArrowPos] = useState<React.CSSProperties>({});
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calcPos = useCallback(() => {
    const wrap = wrapRef.current;
    const pop = popRef.current;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const pw = pop?.offsetWidth ?? maxWidth;
    const ph = pop?.offsetHeight ?? 100;
    let top = 0, left = 0;
    const arw: React.CSSProperties = {};

    const base = placement.split('-')[0] as 'top' | 'bottom' | 'left' | 'right';
    const align = placement.split('-')[1] as 'start' | 'end' | undefined;

    if (base === 'bottom') { top = wr.bottom + offset + window.scrollY; }
    if (base === 'top')    { top = wr.top - ph - offset + window.scrollY; }
    if (base === 'left')   { left = wr.left - pw - offset + window.scrollX; top = wr.top + wr.height / 2 - ph / 2 + window.scrollY; }
    if (base === 'right')  { left = wr.right + offset + window.scrollX; top = wr.top + wr.height / 2 - ph / 2 + window.scrollY; }

    if (base === 'bottom' || base === 'top') {
      if (align === 'start') left = wr.left + window.scrollX;
      else if (align === 'end') left = wr.right - pw + window.scrollX;
      else left = wr.left + wr.width / 2 - pw / 2 + window.scrollX;
      arw.left = wr.left - (left - window.scrollX) + wr.width / 2 - 6;
    }

    setPos({ top, left: Math.max(8, left) });
    setArrowPos(arw);
  }, [placement, offset, maxWidth]);

  const show = useCallback(() => { setOpen(true); setTimeout(calcPos, 10); }, [calcPos]);
  const hide = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => { if (open) hide(); else show(); }, [open, show, hide]);

  useEffect(() => {
    if (!closeOnOutside || !open) return;
    const h = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node) && !popRef.current?.contains(e.target as Node)) hide();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, closeOnOutside, hide]);

  const triggerProps: Partial<React.HTMLAttributes<HTMLElement>> = trigger === 'click'
    ? { onClick: toggle }
    : trigger === 'hover'
    ? {
        onMouseEnter: () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); show(); },
        onMouseLeave: () => { hoverTimer.current = setTimeout(hide, 150); },
      }
    : { onFocus: show, onBlur: hide };

  const arrowBase: React.CSSProperties = {
    position: 'absolute', width: 12, height: 12,
    background: 'inherit', border: 'inherit',
    transform: 'rotate(45deg)',
    zIndex: -1,
  };

  const arrowDirection = (): React.CSSProperties => {
    const base = placement.split('-')[0];
    if (base === 'bottom') return { ...arrowBase, top: -7, ...arrowPos, borderBottom: 'none', borderRight: 'none' };
    if (base === 'top')    return { ...arrowBase, bottom: -7, ...arrowPos, borderTop: 'none', borderLeft: 'none' };
    if (base === 'right')  return { ...arrowBase, left: -7, top: '50%', marginTop: -6, borderRight: 'none', borderBottom: 'none' };
    return { ...arrowBase, right: -7, top: '50%', marginTop: -6, borderLeft: 'none', borderTop: 'none' };
  };

  return (
    <>
      <style>{KEYFRAMES}</style>
      <span ref={wrapRef} style={{ display: 'inline-flex' }} {...(triggerProps as React.HTMLAttributes<HTMLSpanElement>)}>
        {children}
      </span>

      {open && pos && (
        <div
          ref={popRef}
          className={className}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 8000,
            maxWidth,
            background: 'rgba(14,14,20,0.97)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            animation: 'ie-popover-in 0.2s cubic-bezier(0.4,0,0.2,1) forwards',
            fontSize: 13,
            color: '#c8c8d8',
            ...style,
          }}
        >
          {arrow && <div style={arrowDirection()} />}
          {content}
        </div>
      )}
    </>
  );
}

export default IEPopover;
