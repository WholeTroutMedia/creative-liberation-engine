/**
 * packages/dispatch/src/events.ts
 * Creative Liberation Engine — Dispatch EventEmitter
 *
 * Shared event bus for the dispatch server. Decouples mutation logic
 * from notification targets (SSE, mobile-bridge, Redis, webhooks).
 *
 * Wave 37 contract: wireDispatchWebhooks(dispatchEmitter) subscribes
 * to these events and pushes ntfy/mobile notifications.
 *
 * Listeners are fire-and-forget — errors are caught and logged,
 * never blocking the request path.
 */

import { EventEmitter } from 'events';

export interface DispatchTaskEvent {
  id: string;
  title: string;
  workstream?: string;
  priority?: string;
  status?: string;
  claimed_by?: string;
  assigned_to_agent?: string;
}

export interface DispatchBlockerEvent {
  id: string;
  severity: string;
  type: string;
  description: string;
  filed_by: string;
  task_id?: string;
}

export interface DispatchHandoffEvent {
  from: string;
  phase: string;
  task: string;
  workstream?: string;
  timestamp: string;
}

export interface DispatchEventMap {
  'task:created': DispatchTaskEvent;
  'task:claimed': DispatchTaskEvent;
  'task:completed': DispatchTaskEvent;
  'task:delegated': DispatchTaskEvent;
  'blocker:filed': DispatchBlockerEvent;
  'blocker:claimed': DispatchBlockerEvent;
  'blocker:resolved': DispatchBlockerEvent;
  'handoff:phase-change': DispatchHandoffEvent;
  'dispatch:idle': { timestamp: string };
  'dispatch:dream-complete': { stats: any };
}

class DispatchEventBus extends EventEmitter {
  emitSafe<K extends keyof DispatchEventMap>(event: K, data: DispatchEventMap[K]): void {
    try {
      this.emit(event, data);
    } catch (err) {
      console.error(`[dispatch:events] Listener error on ${event}:`, err);
    }
  }
}

export const dispatchEmitter = new DispatchEventBus();
