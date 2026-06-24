/**
 * ChronoGraph — Temporal Workflow Observability Types
 * Adheres strictly to the V7.0.0 Design System and Carbon Monochrome HUD Spec.
 */

/**
 * Execution status for individual workflow actions, subagents, and parent runs.
 */
export enum TaskStatus {
  IDLE = 'IDLE',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
  RETRIED = 'RETRIED'
}

/**
 * Resource utilization and financial telemetry for accurate trace tracking.
 */
export interface CostMetric {
  /**
   * Actual compute cost in fractional USD (e.g., $0.00342)
   */
  financialCost: number;
  /**
   * Execution duration in milliseconds
   */
  latencyMs: number;
  /**
   * Quantitative AI tokens used (sum of prompt, completion, and system cached tokens)
   */
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /**
   * CPU instructions/units, memory bytes, or container execution credits
   */
  computeUnits?: number;
}

/**
 * A discrete action node representing a step, human approval point, or model inference.
 */
export interface WorkflowNode {
  id: string;
  label: string;
  type: 'INFERENCE' | 'ACTION' | 'HUMAN_APPROVAL' | 'SUBAGENT_CALL' | 'ROUTING_GATE';
  status: TaskStatus;
  cost: CostMetric;
  startedAt: string; // ISO 8601 Timestamp
  completedAt?: string; // ISO 8601 Timestamp
  /**
   * Sequence or layout lane index for vertical placement in the timeline grid.
   */
  laneIndex: number;
  /**
   * IDs of upstream nodes that must successfully complete before this node can run.
   */
  dependencies: string[];
  /**
   * Error message payload if status is TaskStatus.FAILED
   */
  errorDetails?: {
    code: string;
    message: string;
    stackTrace?: string;
  };
  /**
   * Rich execution metadata pool mapped dynamically per node category.
   */
  metadata?: {
    agentId?: string;
    modelName?: string;
    allocatedMemoryMb?: number;
    retryCount?: number;
    customLogs?: string[];
  };
}

/**
 * The complete trace snapshot of an active or finalized temporal workflow execution.
 */
export interface TimelineTrace {
  traceId: string;
  workflowName: string;
  version: string;
  status: TaskStatus;
  nodes: WorkflowNode[];
  totalCost: CostMetric;
  triggeredBy: {
    actor: 'OPERATOR' | 'SCHEDULER' | 'CI_CD' | 'TRIGGER_EVENT';
    userId?: string;
    eventId?: string;
  };
  startedAt: string; // ISO 8601 Timestamp
  completedAt?: string; // ISO 8601 Timestamp
  /**
   * Ordered list of node IDs forming the timeline's critical sequence path.
   */
  criticalPath: string[];
}

/**
 * Real-time performance benchmark comparisons.
 */
export interface PerformanceBenchmark {
  metricName: string;
  currentValue: number;
  baselineValue: number;
  unit: string;
  status: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
}
