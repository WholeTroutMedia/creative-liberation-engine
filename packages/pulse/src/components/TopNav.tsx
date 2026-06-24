import { usePulseStore } from '../store/usePulseStore';

export function TopNav() {
  const setShowHistory = usePulseStore(s => s.setShowHistory);
  const missionControlMode = usePulseStore(s => s.missionControlMode);
  const setMissionControlMode = usePulseStore(s => s.setMissionControlMode);

  return (
    <nav className="top-nav">
      <span className="top-nav-wordmark font-display">
        <span>{missionControlMode ? 'MISSION CONTROL' : 'PULSE'}</span>
        {' '}· {missionControlMode ? 'Edge Node Mesh' : 'Design Intelligence'}
      </span>
      <div className="top-nav-divider" />
      <div className="top-nav-links">
        <button
          className={`nav-link nav-link--mc ${missionControlMode ? 'nav-link--mc-active' : ''}`}
          onClick={() => setMissionControlMode(!missionControlMode)}
          title="Toggle Mission Control"
          id="mission-control-toggle"
          aria-pressed={missionControlMode}
        >
          {missionControlMode ? '← Design' : '◉ Mission Control'}
        </button>
        <a
          href="http://127.0.0.1:9001"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-link"
        >
          Penpot ↗
        </a>
        <button className="nav-link" onClick={() => setShowHistory(true)}>
          History
        </button>
        <a
          href="http://localhost:4401"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-link"
        >
          VERA ↗
        </a>
      </div>
    </nav>
  );
}
