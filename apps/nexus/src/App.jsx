import React, { useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDispatch } from './hooks/useDispatch.js';
import { CanvasLayer } from './canvas/CanvasLayer.jsx';
import { OpsPanel } from './panels/OpsPanel.jsx';
import { IDEPanel } from './panels/IDEPanel.jsx';
import { CreativePanel } from './panels/CreativePanel.jsx';
import { HudPanel } from './panels/HudPanel.jsx';
import { AgentPanel } from './panels/AgentPanel.jsx';
import { MatrixPanel } from './panels/MatrixPanel.jsx';
import { CognitiveCorePanel } from './panels/CognitiveCorePanel.jsx';
import './nexus.css';

const PANELS = ['ops', 'ide', 'creative', 'swarm', 'matrix', 'cognitive', 'hud'];

export default function App() {
  const dispatch = useDispatch();
  const [activePanel, setActivePanel] = useState(null);
  const [canvasMode, setCanvasMode] = useState('city');
  const cameraControlsRef = useRef(null);

  const togglePanel = useCallback((panel) => {
    setActivePanel(p => p === panel ? null : panel);
  }, []);

  return (
    <div className="nexus-root">
      {/* Background 3D Canvas Layer */}
      <CanvasLayer mode={canvasMode} dispatchState={dispatch} cameraControlsRef={cameraControlsRef} />

      {/* Global HUD bar */}
      <header className="nexus-topbar">
        <div className="nexus-brand">
          <span className="nexus-logo">◈</span>
          <span className="nexus-title">NEXUS</span>
          <span className="nexus-sub">CLE ENGINE V6</span>
        </div>

        <nav className="nexus-nav">
          {PANELS.map(p => (
            <button
              key={p}
              className={`nexus-nav-btn ${activePanel === p ? 'active' : ''}`}
              onClick={() => togglePanel(p)}
            >
              {PANEL_ICONS[p]}
              <span>{p.toUpperCase()}</span>
            </button>
          ))}
        </nav>

        <div className="nexus-status">
          <div className={`status-pip ${dispatch.isConnected ? 'live' : 'dead'}`} />
          <span>{dispatch.isConnected ? 'DISPATCH LIVE' : 'DISPATCH OFFLINE'}</span>
          <span className="queue-badge">{dispatch.queueDepth} QUEUED</span>
          <button
            className="canvas-toggle"
            onClick={() => setCanvasMode(m => m === 'city' ? 'venue' : 'city')}
          >
            {canvasMode === 'city' ? '🏙 CITY' : '🎪 VENUE'}
          </button>
        </div>
      </header>

      {/* Floating Panel System */}
      <AnimatePresence>
        {activePanel === 'ops' && (
          <FloatingPanel key="ops" title="ENGINE ROOM // OPS" onClose={() => setActivePanel(null)}
            defaultPos={{ x: 20, y: 70 }} width={680}>
            <OpsPanel dispatch={dispatch} />
          </FloatingPanel>
        )}
        {activePanel === 'ide' && (
          <FloatingPanel key="ide" title="KADE // SOVEREIGN IDE" onClose={() => setActivePanel(null)}
            defaultPos={{ x: 80, y: 70 }} width={880}>
            <IDEPanel dispatch={dispatch} />
          </FloatingPanel>
        )}
        {activePanel === 'creative' && (
          <FloatingPanel key="creative" title="CREATIVE ENGINE" onClose={() => setActivePanel(null)}
            defaultPos={{ x: 40, y: 40 }} width={1200}>
            <CreativePanel dispatch={dispatch} />
          </FloatingPanel>
        )}
        {activePanel === 'swarm' && (
          <FloatingPanel key="swarm" title="AGENT SWARM MESH" onClose={() => setActivePanel(null)}
            defaultPos={{ x: 100, y: 90 }} width={700}>
            <AgentPanel dispatch={dispatch} />
          </FloatingPanel>
        )}
        {activePanel === 'matrix' && (
          <FloatingPanel key="matrix" title="GENERATIVE LAYOUT MATRIX" onClose={() => setActivePanel(null)}
            defaultPos={{ x: 120, y: 110 }} width={800}>
            <MatrixPanel dispatch={dispatch} />
          </FloatingPanel>
        )}
        {activePanel === 'cognitive' && (
          <FloatingPanel key="cognitive" title="COGNITIVE CORE" onClose={() => setActivePanel(null)}
            defaultPos={{ x: 160, y: 130 }} width={800}>
            <CognitiveCorePanel dispatch={dispatch} />
          </FloatingPanel>
        )}
        {activePanel === 'hud' && (
          <FloatingPanel key="hud" title="TELEMETRY HUD" onClose={() => setActivePanel(null)}
            defaultPos={{ x: 60, y: 70 }} width={480}>
            <HudPanel dispatch={dispatch} />
          </FloatingPanel>
        )}
      </AnimatePresence>

      {/* Task Feed — bottom right always-on */}
      <TaskFeed tasks={dispatch.tasks} />
    </div>
  );
}

const PANEL_ICONS = {
  ops: '⚙',
  ide: '◻',
  creative: '✦',
  swarm: '⎈',
  matrix: '▤',
  cognitive: '🧠',
  hud: '◈',
};

function FloatingPanel({ title, onClose, defaultPos, width, children }) {
  const [pos, setPos] = useState(defaultPos);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);

  const onMouseDown = (e) => {
    setDragging(true);
    setDragStart({ mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y });
  };

  const onMouseMove = useCallback((e) => {
    if (!dragging || !dragStart) return;
    setPos({ x: dragStart.px + (e.clientX - dragStart.mx), y: dragStart.py + (e.clientY - dragStart.my) });
  }, [dragging, dragStart]);

  const onMouseUp = () => { setDragging(false); setDragStart(null); };

  return (
    <motion.div
      className="nexus-panel"
      style={{ left: pos.x, top: pos.y, width }}
      initial={{ opacity: 0, scale: 0.92, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div className="panel-titlebar" onMouseDown={onMouseDown} style={{ cursor: dragging ? 'grabbing' : 'grab' }}>
        <span className="panel-title">{title}</span>
        <button className="panel-close" onClick={onClose}>✕</button>
      </div>
      <div className="panel-body">{children}</div>
    </motion.div>
  );
}

function TaskFeed({ tasks }) {
  const recent = tasks.slice(0, 5);
  if (!recent.length) return null;
  return (
    <div className="task-feed">
      {recent.map(t => (
        <div key={t.id} className={`task-item status-${t.status}`}>
          <span className="task-type">{t.type}</span>
          <span className={`task-status st-${t.status}`}>{t.status?.toUpperCase()}</span>
        </div>
      ))}
    </div>
  );
}
