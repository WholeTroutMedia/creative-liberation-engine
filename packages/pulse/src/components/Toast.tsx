import { useEffect } from 'react';
import { usePulseStore } from '../store/usePulseStore';

export function Toast() {
  const pushStatus = usePulseStore(s => s.pushStatus);
  const clearPushStatus = usePulseStore(s => s.clearPushStatus);

  useEffect(() => {
    if (pushStatus !== 'idle') {
      const t = setTimeout(clearPushStatus, 3000);
      return () => clearTimeout(t);
    }
  }, [pushStatus, clearPushStatus]);

  if (pushStatus === 'idle') return null;

  return (
    <div className={`toast ${pushStatus}`}>
      {pushStatus === 'success' ? (
        <><span style={{ color: 'var(--green)' }}>✓</span> Pushed to Penpot</>
      ) : (
        <><span style={{ color: 'var(--red)' }}>✕</span> Penpot unreachable — check NAS</>
      )}
    </div>
  );
}
