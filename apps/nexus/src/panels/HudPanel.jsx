import React from 'react';

export function HudPanel({ dispatch }) {
  const { tasks, blockers, queueDepth, isConnected } = dispatch;
  const active = tasks.filter(t => t.status === 'active').length;
  const done = tasks.filter(t => t.status === 'done').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const failed = tasks.filter(t => t.status === 'failed').length;

  return (
    <div className="hud-panel">
      <div className="hud-connection">
        <div className={`hud-pip ${isConnected ? 'live' : 'dead'}`} />
        <span>{isConnected ? 'DISPATCH CONNECTED' : 'RECONNECTING...'}</span>
      </div>

      <div className="hud-grid">
        <HudStat label="QUEUE DEPTH" value={queueDepth} color="#00FFCC" />
        <HudStat label="ACTIVE" value={active} color="#4facfe" />
        <HudStat label="PENDING" value={pending} color="#f59e0b" />
        <HudStat label="DONE" value={done} color="#4ade80" />
        <HudStat label="FAILED" value={failed} color="#FF3366" />
        <HudStat label="BLOCKERS" value={blockers.length} color={blockers.length > 0 ? '#FF3366' : '#4ade80'} />
      </div>

      <div className="hud-recent">
        <div className="hud-section-label">RECENT EVENTS</div>
        {tasks.slice(0, 8).map(t => (
          <div key={t.id} className="hud-event">
            <span className={`hud-dot st-${t.status}`} />
            <span className="hud-event-type">{t.type}</span>
            <span className="hud-event-time">{t.created ? new Date(t.created).toLocaleTimeString() : ''}</span>
          </div>
        ))}
        {tasks.length === 0 && <div className="empty-state">Awaiting dispatch events...</div>}
      </div>
    </div>
  );
}

function HudStat({ label, value, color }) {
  return (
    <div className="hud-stat">
      <div className="hud-stat-value" style={{ color }}>{value}</div>
      <div className="hud-stat-label">{label}</div>
    </div>
  );
}
