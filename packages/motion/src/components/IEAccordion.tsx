/**
 * IEAccordion — Animated expand/collapse accordion
 */

import { useCallback, useRef, useState } from 'react';
import type React from 'react';

export interface AccordionItem {
  id: string;
  title: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface IEAccordionProps {
  items: AccordionItem[];
  multiple?: boolean;
  defaultOpen?: string[];
  onChange?: (openIds: string[]) => void;
  variant?: 'default' | 'bordered' | 'ghost';
  className?: string;
  style?: React.CSSProperties;
}

const KEYFRAMES = `
  @keyframes ie-accordion-open { 0% { opacity: 0; } 100% { opacity: 1; } }
`;

function AccordionItemComp({
  item,
  isOpen,
  onToggle,
  variant,
}: {
  item: AccordionItem;
  isOpen: boolean;
  onToggle: () => void;
  variant: 'default' | 'bordered' | 'ghost';
}): React.ReactElement {
  const contentRef = useRef<HTMLDivElement>(null);

  const getBorder = () => {
    if (variant === 'bordered') return '1px solid #ffffff1a';
    if (variant === 'ghost') return 'none';
    return '1px solid #ffffff0d';
  };

  const getBg = () => {
    if (variant === 'ghost') return 'transparent';
    return isOpen ? '#1a1a24' : '#111118';
  };

  return (
    <div
      style={{
        borderRadius: 10,
        background: getBg(),
        border: getBorder(),
        overflow: 'hidden',
        transition: 'background 0.2s ease',
      }}
    >
      {/* Header */}
      <button
        type="button"
        disabled={item.disabled}
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '14px 16px', background: 'transparent', border: 'none',
          cursor: item.disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          color: item.disabled ? '#555568' : '#e8e8f0', fontSize: 14, fontWeight: 500,
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {item.icon && <span style={{ color: '#a78bfa', display: 'flex' }}>{item.icon}</span>}
          {item.title}
        </span>
        {/* Chevron */}
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.25s ease', color: '#a78bfa' }}
        >
          <path d="M2 4.5L7 9.5L12 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Content */}
      <div
        ref={contentRef}
        style={{
          maxHeight: isOpen ? contentRef.current?.scrollHeight ?? 1000 : 0,
          opacity: isOpen ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease',
        }}
      >
        <div style={{ padding: '0 16px 16px', fontSize: 13, color: '#8888a0', lineHeight: 1.6 }}>
          {item.content}
        </div>
      </div>
    </div>
  );
}

export function IEAccordion({
  items,
  multiple = false,
  defaultOpen = [],
  onChange,
  variant = 'default',
  className,
  style,
}: IEAccordionProps): React.ReactElement {
  const [openIds, setOpenIds] = useState<string[]>(defaultOpen);

  const toggle = useCallback((id: string) => {
    setOpenIds((prev) => {
      let next: string[];
      if (prev.includes(id)) {
        next = prev.filter((i) => i !== id);
      } else {
        next = multiple ? [...prev, id] : [id];
      }
      onChange?.(next);
      return next;
    });
  }, [multiple, onChange]);

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
        {items.map((item) => (
          <AccordionItemComp
            key={item.id}
            item={item}
            isOpen={openIds.includes(item.id)}
            onToggle={() => !item.disabled && toggle(item.id)}
            variant={variant}
          />
        ))}
      </div>
    </>
  );
}

export default IEAccordion;
