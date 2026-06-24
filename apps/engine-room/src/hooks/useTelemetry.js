import { useState, useEffect } from 'react';

const NAS_SSE_URL = 'http://127.0.0.1:5050/sse';

export function useTelemetry() {
  const [telemetry, setTelemetry] = useState({
    latency: 12,
    systemsNominal: true,
    globalHeat: 78.4,
    nodesActive: 14209,
    dispatch: {
      pending: 3,
      active: 1,
      resolved: 12
    },
    inbox: {
      newAlerts: 2
    }
  });

  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let eventSource;
    let fallbackInterval;

    const connectSSE = () => {
      try {
        eventSource = new EventSource(NAS_SSE_URL);
        
        eventSource.onopen = () => {
          setIsConnected(true);
          console.log('Connected to NAS Telemetry Stream');
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setTelemetry(prev => ({
              ...prev,
              ...data
            }));
          } catch (e) {
            console.error('Error parsing SSE telemetry:', e);
          }
        };

        eventSource.onerror = (error) => {
          console.warn('SSE connection lost or failed. Falling back to simulation.');
          eventSource.close();
          setIsConnected(false);
          startFallback();
        };
      } catch (e) {
        console.warn('Failed to initialize EventSource. Falling back to simulation.');
        startFallback();
      }
    };

    const startFallback = () => {
      if (fallbackInterval) return;
      fallbackInterval = setInterval(() => {
        setTelemetry(prev => ({
          ...prev,
          latency: Math.max(5, Math.floor(prev.latency + (Math.random() * 4 - 2))),
          globalHeat: Math.min(100, Math.max(0, +(prev.globalHeat + (Math.random() * 2 - 1)).toFixed(1))),
          nodesActive: prev.nodesActive + Math.floor(Math.random() * 5 - 2)
        }));
      }, 2000);
    };

    // Attempt connection
    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, []);

  return { ...telemetry, isConnected };
}
