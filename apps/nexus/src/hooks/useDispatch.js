const DISPATCH_BASE = `http://${window.location.hostname}:5050`;
import { useState, useEffect, useRef } from 'react';

export function useDispatch() {
  const [state, setState] = useState({ tasks: [], blockers: [], isConnected: false, queueDepth: 0 });
  const esRef = useRef(null);

  useEffect(() => {
    let retryDelay = 1000;
    let retryTimer;

    const connect = () => {
      try {
        const es = new EventSource(`${DISPATCH_BASE}/sse`);
        esRef.current = es;
        es.onopen = () => { setState(s => ({ ...s, isConnected: true })); retryDelay = 1000; };
        es.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            setState(s => {
              const next = { ...s };
              if (data.type === 'task:new' && data.task) next.tasks = [data.task, ...s.tasks].slice(0, 100);
              if (data.type === 'task:update' && data.task) {
                const idx = next.tasks.findIndex(t => t.id === data.task.id);
                const tasks = [...next.tasks];
                if (idx >= 0) tasks[idx] = data.task; else tasks.unshift(data.task);
                next.tasks = tasks.slice(0, 100);
              }
              if (data.type === 'blocker:filed' && data.blocker) next.blockers = [data.blocker, ...s.blockers].slice(0, 50);
              if (data.type === 'blocker:resolved') next.blockers = s.blockers.filter(b => b.id !== data.blocker?.id);
              if (data.queue_depth !== undefined) next.queueDepth = data.queue_depth;
              if (data.tasks) next.tasks = data.tasks;
              if (data.blockers) next.blockers = data.blockers;
              return next;
            });
          } catch {}
        };
        es.onerror = () => {
          es.close(); esRef.current = null;
          setState(s => ({ ...s, isConnected: false }));
          retryTimer = setTimeout(() => { retryDelay = Math.min(retryDelay * 2, 30000); connect(); }, retryDelay);
        };
      } catch { retryTimer = setTimeout(connect, retryDelay); }
    };

    connect();
    return () => { esRef.current?.close(); clearTimeout(retryTimer); };
  }, []);

  const api = async (path, opts = {}) => {
    const r = await fetch(`${DISPATCH_BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
    return r.json();
  };

  return {
    ...state,
    createTask: (payload) => api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) }),
    getStatus: () => api('/api/status'),
  };
}
