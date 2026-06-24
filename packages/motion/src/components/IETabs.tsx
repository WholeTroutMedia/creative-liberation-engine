/**
 * IETabs — Animated tab switcher with sliding active indicator
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

export interface Tab {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: number;
  disabled?: boolean;
  content?: React.ReactNode;
}

export type TabsVariant = 'underline' | 'pill' | 'card';

export interface IETabsProps {
  tabs: Tab[];
  defaultTab?: string;
  value?: string;
  onChange?: (id: string) => void;
  variant?: TabsVariant;
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function IETabs({
  tabs,
  defaultTab,
  value,
  onChange,
  variant = 'underline',
  fullWidth = false,
  className,
  style,
}: IETabsProps): React.ReactElement {
  const [active, setActive] = useState(value ?? defaultTab ?? tabs[0]?.id);
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const updateIndicator = useCallback((id: string) => {
    const el = tabRefs.current[id];
    const container = containerRef.current;
    if (!el || !container) return;
    const tabRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setIndicatorStyle({
      left: tabRect.left - containerRect.left,
      width: tabRect.width,
    });
  }, []);

  const handleChange = useCallback((id: string) => {
    if (!value) setActive(id);
    onChange?.(id);
    updateIndicator(id);
  }, [value, onChange, updateIndicator]);

  const activeId = value ?? active;

  useEffect(() => {
    // Initialize indicator position after mount
    const timer = setTimeout(() => updateIndicator(activeId), 10);
    return () => clearTimeout(timer);
  }, [activeId, updateIndicator]);

  const activeTab = tabs.find((t) => t.id === activeId);

  const getTabStyle = (tab: Tab): React.CSSProperties => {
    const isActive = tab.id === activeId;
    const base: React.CSSProperties = {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: variant === 'underline' ? '8px 16px' : '7px 16px',
      fontFamily: 'inherit',
      fontSize: 13,
      fontWeight: isActive ? 600 : 400,
      border: 'none',
      cursor: tab.disabled ? 'not-allowed' : 'pointer',
      transition: 'color 0.2s ease, background 0.2s ease',
      borderRadius: variant === 'pill' ? 100 : variant === 'card' ? 8 : 0,
      flex: fullWidth ? 1 : undefined,
      justifyContent: fullWidth ? 'center' : undefined,
      whiteSpace: 'nowrap' as const,
      opacity: tab.disabled ? 0.4 : 1,
    };

    if (variant === 'underline') return { ...base, background: 'transparent', color: isActive ? '#a78bfa' : '#8888a0' };
    if (variant === 'pill') return { ...base, background: isActive ? '#a78bfa22' : 'transparent', color: isActive ? '#a78bfa' : '#8888a0' };
    if (variant === 'card') return { ...base, background: isActive ? '#1e1e2e' : 'transparent', color: isActive ? '#e8e8f0' : '#8888a0', boxShadow: isActive ? '0 1px 8px rgba(0,0,0,0.3)' : 'none' };
    return base;
  };

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', ...style }}>
      {/* Tab bar */}
      <div
        ref={containerRef}
        role="tablist"
        style={{
          position: 'relative',
          display: 'flex',
          borderBottom: variant === 'underline' ? '1px solid #ffffff0d' : undefined,
          background: variant === 'card' ? '#111118' : undefined,
          borderRadius: variant === 'card' ? 10 : undefined,
          padding: variant === 'card' ? 4 : undefined,
          gap: variant === 'card' ? 2 : 0,
        }}
      >
        {/* Sliding indicator */}
        {(variant === 'underline' || variant === 'pill') && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: variant === 'underline' ? -1 : undefined,
              top: variant === 'pill' ? 0 : undefined,
              height: variant === 'underline' ? 2 : '100%',
              borderRadius: variant === 'underline' ? 2 : 100,
              background: variant === 'underline' ? '#a78bfa' : '#a78bfa22',
              transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1), width 0.25s cubic-bezier(0.4,0,0.2,1)',
              pointerEvents: 'none',
              ...indicatorStyle,
            }}
          />
        )}

        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[tab.id] = el; }}
            role="tab"
            aria-selected={tab.id === activeId}
            aria-disabled={tab.disabled}
            type="button"
            disabled={tab.disabled}
            onClick={() => !tab.disabled && handleChange(tab.id)}
            style={getTabStyle(tab)}
          >
            {tab.icon && <span style={{ display: 'flex', fontSize: 14 }}>{tab.icon}</span>}
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span style={{
                minWidth: 16, height: 16, padding: '0 4px', borderRadius: 100,
                background: '#a78bfa', color: '#fff', fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content panel */}
      {activeTab?.content && (
        <div
          role="tabpanel"
          style={{
            paddingTop: 16,
            animation: 'ie-tabs-content 0.2s ease forwards',
          }}
        >
          <style>{`@keyframes ie-tabs-content { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: none; } }`}</style>
          {activeTab.content}
        </div>
      )}
    </div>
  );
}

export default IETabs;
