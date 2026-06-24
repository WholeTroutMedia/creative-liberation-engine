/**
 * Observability Trace Ingestion Module
 * Helix α — Extension for shadow-qa service
 * Ingests agent execution traces and produces real-time observability data.
 */

import { randomUUID as uuidv4 } from 'crypto';

// --- Types matching AGENT_OBSERVABILITY schema ---
export interface ExecutionTrace {
  trace_id: string;
  agent_id: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  spans: TraceSpan[];
  metadata: Record<string, unknown>;
}

export interface TraceSpan {
  span_id: string;
  parent_span_id: string | null;
  operation: string;
  service: string;
  started_at: string;
  ended_at: string | null;
  duration_ms: number;
  status: 'ok' | 'error' | 'timeout';
  attributes: Record<string, unknown>;
  events: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timestamp: string;
  attributes: Record<string, unknown>;
}

export interface DriftAlert {
  alert_id: string;
  trace_id: string;
  agent_id: string;
  drift_type: 'latency_spike' | 'error_rate_increase' | 'goal_deviation' | 'resource_exhaustion';
  severity: 'low' | 'medium' | 'high' | 'critical';
  baseline_value: number;
  observed_value: number;
  threshold: number;
  detected_at: string;
}

// --- Trace Store ---
const traces = new Map<string, ExecutionTrace>();
const driftAlerts: DriftAlert[] = [];

// --- Baselines for drift detection ---
const latencyBaselines = new Map<string, number[]>();
const DRIFT_WINDOW = 50;
const DRIFT_THRESHOLD_MULTIPLIER = 2.5;

export function ingestTrace(trace: ExecutionTrace): { trace_id: string; drift_detected: boolean; alerts: DriftAlert[] } {
  traces.set(trace.trace_id, trace);

  // Compute total duration
  const totalDuration = trace.spans.reduce((sum, s) => sum + s.duration_ms, 0);

  // Update baseline
  const key = trace.agent_id;
  if (!latencyBaselines.has(key)) latencyBaselines.set(key, []);
  const baseline = latencyBaselines.get(key)!;
  baseline.push(totalDuration);
  if (baseline.length > DRIFT_WINDOW) baseline.shift();

  // Drift detection
  const alerts: DriftAlert[] = [];
  if (baseline.length >= 10) {
    const avg = baseline.reduce((a, b) => a + b, 0) / baseline.length;
    if (totalDuration > avg * DRIFT_THRESHOLD_MULTIPLIER) {
      const alert: DriftAlert = {
        alert_id: uuidv4(),
        trace_id: trace.trace_id,
        agent_id: trace.agent_id,
        drift_type: 'latency_spike',
        severity: totalDuration > avg * 5 ? 'critical' : totalDuration > avg * 3 ? 'high' : 'medium',
        baseline_value: Math.round(avg),
        observed_value: totalDuration,
        threshold: Math.round(avg * DRIFT_THRESHOLD_MULTIPLIER),
        detected_at: new Date().toISOString(),
      };
      alerts.push(alert);
      driftAlerts.push(alert);
    }
  }

  // Error rate drift
  const errorSpans = trace.spans.filter(s => s.status === 'error');
  if (errorSpans.length > trace.spans.length * 0.3 && trace.spans.length > 3) {
    const alert: DriftAlert = {
      alert_id: uuidv4(),
      trace_id: trace.trace_id,
      agent_id: trace.agent_id,
      drift_type: 'error_rate_increase',
      severity: errorSpans.length > trace.spans.length * 0.5 ? 'critical' : 'high',
      baseline_value: 0.1,
      observed_value: errorSpans.length / trace.spans.length,
      threshold: 0.3,
      detected_at: new Date().toISOString(),
    };
    alerts.push(alert);
    driftAlerts.push(alert);
  }

  return { trace_id: trace.trace_id, drift_detected: alerts.length > 0, alerts };
}

export function getTrace(traceId: string): ExecutionTrace | undefined {
  return traces.get(traceId);
}

export function getRecentAlerts(limit = 50): DriftAlert[] {
  return driftAlerts.slice(-limit);
}

export function getAgentMetrics(agentId: string): {
  total_traces: number;
  avg_duration_ms: number;
  error_rate: number;
  p95_duration_ms: number;
  active_alerts: number;
} {
  const agentTraces = Array.from(traces.values()).filter(t => t.agent_id === agentId);
  const durations = agentTraces.map(t => t.spans.reduce((sum, s) => sum + s.duration_ms, 0));
  const sorted = [...durations].sort((a, b) => a - b);
  const errorCount = agentTraces.filter(t => t.status === 'failed').length;

  return {
    total_traces: agentTraces.length,
    avg_duration_ms: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    error_rate: agentTraces.length ? errorCount / agentTraces.length : 0,
    p95_duration_ms: sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0,
    active_alerts: driftAlerts.filter(a => a.agent_id === agentId).length,
  };
}
