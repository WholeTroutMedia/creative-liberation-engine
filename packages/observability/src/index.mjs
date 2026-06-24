/**
 * @cle/observability — V6 Observability Stack
 *
 * Host telemetry, pulse health monitoring, and compose hardening.
 *
 * @capabilityIds cap_host_telemetry, cap_pulse_service, cap_compose_hardener
 */

export { PulseClient, heartbeat, getFleetStatus } from './pulse.mjs';
export { HostTelemetry, collectMetrics, getSystemInfo } from './telemetry.mjs';
export { ComposeHardener, validateCompose, hardenCompose } from './hardener.mjs';
export { TraceRecorder, traceStorage } from './trace-recorder.mjs';
