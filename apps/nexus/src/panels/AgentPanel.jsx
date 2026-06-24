import React, { useState } from 'react';

const DISPATCH_BASE = `http://${window.location.hostname}:5050`;

export function AgentPanel({ dispatch }) {
  const { tasks } = dispatch;
  const activeTasks = tasks.filter(t => t.status === 'active' || t.status === 'pending');
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [overridePrompt, setOverridePrompt] = useState('');
  
  const injectOverride = async () => {
    if (!overrideTarget || !overridePrompt.trim()) return;
    try {
      await fetch(`${DISPATCH_BASE}/api/tasks/${overrideTarget}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: overridePrompt })
      });
      setOverridePrompt('');
      setOverrideTarget(null);
    } catch (e) {
      console.error('Failed to inject override:', e);
    }
  };

  const haltTask = async (id) => {
    try {
      await fetch(`${DISPATCH_BASE}/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'failed', _reason: 'HALTED BY OPERATOR' })
      });
    } catch (e) {
      console.error('Failed to halt task:', e);
    }
  };

  return (
    <div className="agent-panel">
      <div className="agent-list">
        {activeTasks.length === 0 && <div className="empty-state">No active swarm tasks...</div>}
        {activeTasks.map(t => (
          <div key={t.id} className="agent-card">
            <div className="agent-card-header">
              <span className="agent-task-id">{t.id?.slice(0, 8)}</span>
              <span className="agent-task-type">{t.type}</span>
              <span className={`task-badge st-${t.status}`}>{t.status?.toUpperCase()}</span>
            </div>
            <div className="agent-telemetry">
              <div className="telemetry-row"><span>AGENT:</span> <span className="hl">ALPHA-7</span></div>
              <div className="telemetry-row"><span>MEMORY:</span> <span>1.2GB / 8GB</span></div>
              <div className="telemetry-row"><span>TOKENS:</span> <span>14,024</span></div>
              <div className="telemetry-row"><span>FOCUS:</span> <span className="hl">{t.payload?.prompt || 'Autonomous Execution'}</span></div>
            </div>
            <div className="agent-actions">
               <button className="agent-action-btn" onClick={() => setOverrideTarget(t.id)}>
                 ⚡ INJECT OVERRIDE
               </button>
               <button className="agent-action-btn danger" onClick={() => haltTask(t.id)}>
                 ✕ HALT
               </button>
            </div>
          </div>
        ))}
      </div>

      {overrideTarget && (
        <div className="override-overlay">
          <div className="override-box">
             <div className="override-header">
               <span>INJECT DIRECTIVE: {overrideTarget.slice(0, 8)}</span>
               <button onClick={() => setOverrideTarget(null)}>✕</button>
             </div>
             <textarea 
               autoFocus
               className="override-input"
               placeholder="Enter course-correction prompt to redirect swarm..."
               value={overridePrompt}
               onChange={e => setOverridePrompt(e.target.value)}
             />
             <button className="override-submit" onClick={injectOverride}>TRANSMIT OVERRIDE</button>
          </div>
        </div>
      )}
    </div>
  );
}
