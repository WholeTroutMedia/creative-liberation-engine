/**
 * IETimeline — Animated vertical/horizontal timeline/steps component
 */

import type React from 'react';

export type TimelineLayout = 'vertical' | 'horizontal';
export type TimelineItemStatus = 'complete' | 'active' | 'pending' | 'error';

export interface TimelineItem {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  timestamp?: string;
  status?: TimelineItemStatus;
  icon?: React.ReactNode;
}

export interface IETimelineProps {
  items: TimelineItem[];
  layout?: TimelineLayout;
  animated?: boolean;
  connectorColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

const STATUS_COLORS: Record<TimelineItemStatus, { bg: string; border: string; icon: string }> = {
  complete: { bg: '#052e16', border: '#4ade80', icon: '✓' },
  active:   { bg: '#1e1030', border: '#a78bfa', icon: '●' },
  pending:  { bg: '#111118', border: '#333348', icon: '○' },
  error:    { bg: '#1a0f0f', border: '#f87171', icon: '✕' },
};

const KEYFRAMES = `
  @keyframes ie-timeline-dot-pop { 0% { transform: scale(0); } 60% { transform: scale(1.2); } 100% { transform: scale(1); } }
  @keyframes ie-timeline-line-fill { 0% { transform: scaleY(0); transform-origin: top; } 100% { transform: scaleY(1); } }
`;

export function IETimeline({
  items,
  layout = 'vertical',
  animated = true,
  connectorColor = '#1a1a24',
  className,
  style,
}: IETimelineProps): React.ReactElement {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: layout === 'vertical' ? 'column' : 'row',
          gap: layout === 'vertical' ? 0 : 0,
          ...style,
        }}
      >
        {items.map((item, index) => {
          const status = item.status ?? (index === 0 ? 'active' : 'pending');
          const { bg, border, icon } = STATUS_COLORS[status];
          const isLast = index === items.length - 1;

          if (layout === 'vertical') {
            return (
              <div
                key={item.id}
                style={{ display: 'flex', gap: 16 }}
              >
                {/* Left: dot + connector */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: bg,
                      border: `2px solid ${border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: border, flexShrink: 0,
                      animation: animated ? `ie-timeline-dot-pop 0.4s ${index * 0.1}s ease-out both` : undefined,
                      zIndex: 1,
                    }}
                  >
                    {item.icon ?? icon}
                  </div>
                  {!isLast && (
                    <div
                      style={{
                        width: 2, flex: 1, minHeight: 24, backgroundColor: connectorColor,
                        animation: animated ? `ie-timeline-line-fill 0.5s ${index * 0.1 + 0.2}s ease both` : undefined,
                      }}
                    />
                  )}
                </div>

                {/* Right: content */}
                <div style={{ paddingBottom: isLast ? 0 : 24, paddingTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: status === 'pending' ? '#555568' : '#e8e8f0' }}>
                      {item.title}
                    </div>
                    {item.timestamp && (
                      <div style={{ fontSize: 11, color: '#555568' }}>{item.timestamp}</div>
                    )}
                  </div>
                  {item.description && (
                    <div style={{ fontSize: 13, color: '#8888a0', lineHeight: 1.5 }}>{item.description}</div>
                  )}
                </div>
              </div>
            );
          }

          // Horizontal
          return (
            <div
              key={item.id}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                {index > 0 && <div style={{ flex: 1, height: 2, backgroundColor: connectorColor }} />}
                <div
                  style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: bg, border: `2px solid ${border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: border,
                    animation: animated ? `ie-timeline-dot-pop 0.4s ${index * 0.1}s ease-out both` : undefined,
                  }}
                >
                  {item.icon ?? icon}
                </div>
                {!isLast && <div style={{ flex: 1, height: 2, backgroundColor: connectorColor }} />}
              </div>
              <div style={{ marginTop: 10, textAlign: 'center', padding: '0 8px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: status === 'pending' ? '#555568' : '#e8e8f0' }}>{item.title}</div>
                {item.description && <div style={{ fontSize: 11, color: '#8888a0', marginTop: 2 }}>{item.description}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default IETimeline;
