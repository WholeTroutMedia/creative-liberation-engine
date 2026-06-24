/**
 * useDispatch — Centralized hook for CLE Dispatch Server REST + SSE
 * 
 * Connects to the NAS dispatch server at 127.0.0.1:5150 and provides:
 *   - Live SSE event stream (status snapshots, task mutations, blocker events)
 *   - REST API wrappers for tasks, agents, status, blockers
 *   - Connection state tracking with automatic reconnect
 * 
 * The SSE stream pushes full board snapshots on every mutation,
 * so consumers always have the latest state without polling.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

const DISPATCH_BASE = `http://${window.location.hostname}:5050`;

/**
 * useDispatchSSE — Subscribe to the live SSE event stream.
 * Returns { status, tasks, agents, isConnected } updated in real-time.
 */
export function useDispatchSSE() {
  const [board, setBoard] = useState({
    summary: { queued: 0, active: 0, done: 0, blocked: 0, total_agents: 0, total_projects: 0 },
    active_agents: [],
    idle_agents: [],
    queued_tasks: [],
    active_tasks: [],
  });
  const [isConnected, setIsConnected] = useState(false);
  const retryRef = useRef(null);

  useEffect(() => {
    let eventSource;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      try {
        eventSource = new EventSource(`${DISPATCH_BASE}/api/events`);

        eventSource.addEventListener('connected', () => {
          setIsConnected(true);
          console.log('[dispatch:sse] Connected to NAS dispatch stream');
        });

        eventSource.addEventListener('status', (e) => {
          try {
            const data = JSON.parse(e.data);
            setBoard(data);
          } catch (err) {
            console.error('[dispatch:sse] Parse error:', err);
          }
        });

        eventSource.addEventListener('blocker', (e) => {
          try {
            const data = JSON.parse(e.data);
            console.log(`[dispatch:sse] Blocker event: ${data.event} — ${data.blocker?.id}`);
          } catch { /* swallow */ }
        });

        eventSource.onerror = () => {
          setIsConnected(false);
          eventSource.close();
          // Exponential backoff reconnect (max 30s)
          if (!disposed) {
            const delay = Math.min(30000, 2000 + Math.random() * 3000);
            console.warn(`[dispatch:sse] Disconnected. Reconnecting in ${Math.round(delay)}ms...`);
            retryRef.current = setTimeout(connect, delay);
          }
        };
      } catch {
        console.warn('[dispatch:sse] Failed to create EventSource');
      }
    };

    connect();

    return () => {
      disposed = true;
      if (eventSource) eventSource.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, []);

  return { board, isConnected };
}

/**
 * useDispatchAPI — REST API wrappers for dispatch server operations.
 */
export function useDispatchAPI() {
  const fetchJSON = useCallback(async (path, options = {}) => {
    try {
      const res = await fetch(`${DISPATCH_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`[dispatch:api] ${options.method || 'GET'} ${path} failed:`, err);
      return null;
    }
  }, []);

  /** GET /api/status — full board snapshot */
  const getStatus = useCallback(() => fetchJSON('/api/status'), [fetchJSON]);

  /** GET /api/tasks — list tasks, optionally filtered */
  const getTasks = useCallback((params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchJSON(`/api/tasks${qs ? '?' + qs : ''}`);
  }, [fetchJSON]);

  /** GET /api/tasks/:id — single task detail */
  const getTask = useCallback((id) => fetchJSON(`/api/tasks/${id}`), [fetchJSON]);

  /** POST /api/tasks — add a new task */
  const addTask = useCallback((task) => fetchJSON('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  }), [fetchJSON]);

  /** POST /api/tasks/claim — claim a task */
  const claimTask = useCallback((taskId, agentId) => fetchJSON('/api/tasks/claim', {
    method: 'POST',
    body: JSON.stringify({ task_id: taskId, agent_id: agentId }),
  }), [fetchJSON]);

  /** PATCH /api/tasks/:id — update task fields */
  const updateTask = useCallback((id, updates) => fetchJSON(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  }), [fetchJSON]);

  /** POST /api/tasks/:id/resolve — force-complete */
  const resolveTask = useCallback((id, agentId, note, artifacts) => fetchJSON(`/api/tasks/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId, note, artifacts }),
  }), [fetchJSON]);

  /** GET /api/blockers — list blockers */
  const getBlockers = useCallback((params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchJSON(`/api/blockers${qs ? '?' + qs : ''}`);
  }, [fetchJSON]);

  /** GET /api/projects — list projects */
  const getProjects = useCallback(() => fetchJSON('/api/projects'), [fetchJSON]);

  /** GET /api/archive — list archive */
  const getArchive = useCallback(() => fetchJSON('/api/archive'), [fetchJSON]);

  /** GET /dira/metrics — DIRA resolution metrics */
  const getDiraMetrics = useCallback(() => fetchJSON('/dira/metrics'), [fetchJSON]);

  return {
    getStatus, getTasks, getTask, addTask, claimTask,
    updateTask, resolveTask, getBlockers, getProjects, getArchive, getDiraMetrics,
  };
}
