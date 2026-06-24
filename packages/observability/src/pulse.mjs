/**
 * Pulse Client — fleet health monitoring.
 *
 * Sends heartbeats, queries fleet status, and aggregates health data.
 * Maps to routes in pulse.manifest.json.
 *
 * @capabilityId cap_pulse_service
 */

import { getConfig } from '@cle/config';

export class PulseClient {
  constructor(opts = {}) {
    this.url = opts.url || getConfig('PULSE_URL', 'http://localhost:5060');
  }

  async heartbeat(serviceId, status = {}) {
    const res = await fetch(`${this.url}/api/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        ...status,
      }),
    });
    if (!res.ok) throw new Error(`Heartbeat failed: ${res.status}`);
    return res.json();
  }

  async getFleetStatus() {
    const res = await fetch(`${this.url}/api/fleet`);
    if (!res.ok) throw new Error(`Fleet status failed: ${res.status}`);
    return res.json();
  }
}

export function heartbeat(serviceId, status) { return new PulseClient().heartbeat(serviceId, status); }
export function getFleetStatus() { return new PulseClient().getFleetStatus(); }
