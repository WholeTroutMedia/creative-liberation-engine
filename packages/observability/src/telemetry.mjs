/**
 * Host Telemetry — workstation and NAS resource metrics.
 *
 * Collects CPU, memory, disk, GPU, and network metrics
 * from the local workstation and NAS infrastructure.
 *
 * @capabilityId cap_host_telemetry
 */

import { cpus, totalmem, freemem, hostname, platform, arch, uptime } from 'os';

export class HostTelemetry {
  /** Collect current system metrics. */
  collect() {
    const cpuInfo = cpus();
    return {
      timestamp: new Date().toISOString(),
      host: {
        hostname: hostname(),
        platform: platform(),
        arch: arch(),
        uptime: uptime(),
      },
      cpu: {
        model: cpuInfo[0]?.model || 'unknown',
        cores: cpuInfo.length,
        speed: cpuInfo[0]?.speed || 0,
      },
      memory: {
        total: totalmem(),
        free: freemem(),
        used: totalmem() - freemem(),
        usagePercent: ((totalmem() - freemem()) / totalmem() * 100).toFixed(1),
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
      },
    };
  }

  /** Get system info summary. */
  getSystemInfo() {
    const cpuInfo = cpus();
    return {
      hostname: hostname(),
      platform: platform(),
      arch: arch(),
      cpuModel: cpuInfo[0]?.model || 'unknown',
      cpuCores: cpuInfo.length,
      totalMemoryGB: (totalmem() / 1024 / 1024 / 1024).toFixed(1),
      nodeVersion: process.version,
    };
  }
}

export function collectMetrics() { return new HostTelemetry().collect(); }
export function getSystemInfo() { return new HostTelemetry().getSystemInfo(); }
