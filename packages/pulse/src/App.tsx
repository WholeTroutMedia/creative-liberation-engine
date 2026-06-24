import { TopNav } from './components/TopNav';
import { InstrumentPanel } from './components/InstrumentPanel/InstrumentPanel';
import { SpatialCanvas } from './components/SpatialCanvas/SpatialCanvas';
import { AuditPanel } from './components/AuditPanel/AuditPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { Toast } from './components/Toast';
import { MissionControl } from './components/MissionControl/MissionControl';
import { useVeraAudit } from './hooks/useVeraAudit';
import { usePulseStore } from './store/usePulseStore';

export default function App() {
  useVeraAudit(); // runs audit in background, updates store
  const showHistory = usePulseStore(s => s.showHistory);
  const missionControlMode = usePulseStore(s => s.missionControlMode);

  return (
    <div className="pulse-root">
      <TopNav />
      {missionControlMode ? (
        <div className="pulse-body pulse-body--mc">
          <MissionControl />
        </div>
      ) : (
        <div className="pulse-body">
          <InstrumentPanel />
          <SpatialCanvas />
          <AuditPanel />
        </div>
      )}
      {showHistory && <HistoryPanel />}
      <Toast />
    </div>
  );
}
