import { useState, useEffect } from 'react';

const NAS_SSE = `http://${window.location.hostname}:5050/sse`;

export function useTelemetry() {
  const [state, setState] = useState({
    latency: 0, systemsNominal: true, globalHeat: 0,
    nodesActive: 0, queueDepth: 0, activeAgents: 0,
    agents: [], isConnected: false, lastEvent: null
  });

  useEffect(() => {
    let es = null;
    let retryTimer;
    let retryDelay = 2000;

    const connect = () => {
      try {
        es = new EventSource(NAS_SSE);
        es.onopen = () => setState(s => ({ ...s, isConnected: true }));
        es.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            setState(s => ({ ...s, ...data, lastEvent: data.type ?? null, isConnected: true }));
          } catch {}
        };
        es.onerror = () => {
          es?.close();
          setState(s => ({ ...s, isConnected: false }));
          retryTimer = setTimeout(() => { retryDelay = Math.min(retryDelay * 1.5, 30000); connect(); }, retryDelay);
        };
      } catch { retryTimer = setTimeout(connect, retryDelay); }
    };

    connect();
    return () => { es?.close(); clearTimeout(retryTimer); };
  }, []);

  return state;
}

export { useTelemetry as default };
