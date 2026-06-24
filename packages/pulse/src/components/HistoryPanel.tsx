import { usePulseStore, type HistorySnapshot } from '../store/usePulseStore';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function HistoryPanel() {
  const history = usePulseStore(s => s.history);
  const setShowHistory = usePulseStore(s => s.setShowHistory);
  const restoreSnapshot = usePulseStore(s => s.restoreSnapshot);

  return (
    <div className="history-overlay" onClick={() => setShowHistory(false)}>
      <div className="history-panel" onClick={e => e.stopPropagation()}>
        <div className="history-header">
          <span className="font-display text-white" style={{ fontSize: 13, fontWeight: 600 }}>
            Session History
          </span>
          <button className="history-close" onClick={() => setShowHistory(false)}>×</button>
        </div>

        <div className="history-list">
          {history.length === 0 ? (
            <p className="label-sm" style={{ padding: '16px 12px' }}>
              No snapshots yet — apply an intent to create one.
            </p>
          ) : (
            history.map((snapshot: HistorySnapshot) => (
              <div
                key={snapshot.id}
                className="history-item"
                onClick={() => restoreSnapshot(snapshot)}
              >
                <div className="history-item-time font-mono">{formatTime(snapshot.timestamp)}</div>
                <div className="history-item-intent">{snapshot.intent}</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                  {(['primary', 'surface', 'accent'] as const).map(k => (
                    <div
                      key={k}
                      style={{
                        width: 12, height: 12, borderRadius: 2,
                        background: snapshot.colorSystem[k],
                        border: '1px solid var(--border)',
                      }}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
