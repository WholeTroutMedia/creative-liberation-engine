/**
 * EventBus — Lightweight in-process pub/sub for the Sovereign MCP Hub.
 * Enables decoupled reactions: vectorization hooks, webhook dispatch, audit trails.
 */
type Listener = (payload: any) => void;

export class EventBus {
  private listeners: Map<string, Listener[]> = new Map();

  on(event: string, fn: Listener): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(fn);
  }

  off(event: string, fn: Listener): void {
    const fns = this.listeners.get(event);
    if (fns) this.listeners.set(event, fns.filter(f => f !== fn));
  }

  emit(event: string, payload: any): void {
    const fns = this.listeners.get(event) || [];
    for (const fn of fns) {
      try { fn(payload); } catch (err) { console.error(`[EventBus] Error in ${event} handler:`, err); }
    }
    // Wildcard listeners
    const wildcards = this.listeners.get('*') || [];
    for (const fn of wildcards) {
      try { fn({ event, payload }); } catch (err) { console.error(`[EventBus] Error in wildcard handler:`, err); }
    }
  }
}
