import React, { useState } from 'react';

const DISPATCH_BASE = `http://${window.location.hostname}:5050`;

export function OpsPanel({ dispatch }) {
  const [activeTab, setActiveTab] = useState('queue');
  const { tasks, blockers, isConnected, queueDepth } = dispatch;

  const submitTask = async () => {
    const type = prompt('Task type:');
    if (!type) return;
    await dispatch.createTask({ type, status: 'pending', created: new Date().toISOString() });
  };

  return (
    <div className="ops-panel">
      <div className="ops-stat-bar">
        <Stat label="QUEUED" value={queueDepth} color="#00FFCC" />
        <Stat label="ACTIVE" value={tasks.filter(t => t.status === 'active').length} color="#4facfe" />
        <Stat label="BLOCKERS" value={blockers.length} color="#FF3366" />
        <Stat label="DISPATCH" value={isConnected ? 'LIVE' : 'OFF'} color={isConnected ? '#00FFCC' : '#FF3366'} />
      </div>

      <div className="ops-tabs">
        {['queue', 'blockers', 'agents'].map(t => (
          <button key={t} className={`ops-tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t.toUpperCase()}
          </button>
        ))}
        <button className="ops-action-btn" onClick={submitTask}>+ TASK</button>
      </div>

      <div className="ops-body">
        {activeTab === 'queue' && (
          <div className="task-list">
            {tasks.length === 0 && <div className="empty-state">No tasks in queue</div>}
            {tasks.map(t => (
              <div key={t.id} className={`task-row status-${t.status}`}>
                <span className="task-id">{t.id?.slice(0, 8) ?? '—'}</span>
                <span className="task-type">{t.type}</span>
                <span className={`task-badge st-${t.status}`}>{t.status?.toUpperCase()}</span>
                <span className="task-time">{t.created ? new Date(t.created).toLocaleTimeString() : '—'}</span>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'blockers' && (
          <div className="blocker-list">
            {blockers.length === 0 && <div className="empty-state">No blockers 🟢</div>}
            {blockers.map(b => (
              <div key={b.id} className={`blocker-row sev-${b.severity}`}>
                <span className={`blocker-sev sev-${b.severity}`}>{b.severity?.toUpperCase()}</span>
                <span className="blocker-desc">{b.description}</span>
                <span className="blocker-time">{b.filed ? new Date(b.filed).toLocaleTimeString() : '—'}</span>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'agents' && (
          <div className="empty-state">Agent telemetry — connect to dispatch SSE for live data</div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="ops-stat">
      <div className="ops-stat-value" style={{ color }}>{value}</div>
      <div className="ops-stat-label">{label}</div>
    </div>
  );
}
