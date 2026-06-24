import { Blackboard } from "./blackboard.js";

export class EventEmitter {
  private listeners: Record<string, Function[]> = {};

  public on(event: string, listener: Function): this {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
    return this;
  }

  public emit(event: string, ...args: any[]): boolean {
    const list = this.listeners[event];
    if (!list) return false;
    for (const listener of list) {
      listener(...args);
    }
    return true;
  }
}

export type StepStatus = 'pending' | 'running' | 'completed' | 'suspended' | 'failed';

export interface TaskStep {
  id: string;
  workerType: string;
  payload: Record<string, any>;
  dependsOn: string[];
  requireApproval?: boolean;
  status?: StepStatus;
  output?: any;
}

export class SovereignStateEngine extends EventEmitter {
  private workflows = new Map<string, TaskStep[]>();
  public blackboard: Blackboard;

  constructor() {
    super();
    this.blackboard = new Blackboard();
  }

  public registerWorkflow(workflowId: string, steps: TaskStep[]): void {
    const initializedSteps = steps.map(step => ({
      ...step,
      status: (step.status || 'pending') as StepStatus
    }));
    this.workflows.set(workflowId, initializedSteps);

    // Seed the blackboard with initial step payloads
    for (const step of initializedSteps) {
      this.blackboard.write(`step:payload:${step.id}`, step.payload, {
        activationEnergy: 1.0,
        decayRate: 0.05, // Decays slowly since it's initial payload definition
        metadata: { workflowId, type: 'definition' }
      });
    }
  }

  public getWorkflowSteps(workflowId: string): TaskStep[] | undefined {
    return this.workflows.get(workflowId);
  }

  public evaluateGraph(workflowId: string): void {
    const steps = this.workflows.get(workflowId);
    if (!steps) return;

    for (const step of steps) {
      if (step.status === 'pending') {
        const canExecute = step.dependsOn.every(depId => {
          const depStep = steps.find(s => s.id === depId);
          return depStep && depStep.status === 'completed';
        });

        if (canExecute) {
          if (step.requireApproval) {
            step.status = 'suspended';
            this.emit("workflow:breakpoint", { workflowId, stepId: step.id });
          } else {
            step.status = 'running';
            this.emit("workflow:dispatch", {
              workflowId,
              stepId: step.id,
              target: step.workerType,
              payload: step.payload
            });
          }
        }
      }
    }
  }

  public async releaseBreakpoint(
    workflowId: string,
    stepId: string,
    resolution: {
      manualOverrideVerified?: boolean;
      output?: any;
      biometricAuth?: {
        credentialId: string;
        signature: string;
        deviceType: 'Glasses' | 'Watch' | 'SecureEnclave';
      };
    }
  ): Promise<void> {
    const steps = this.workflows.get(workflowId);
    if (!steps) return;

    const step = steps.find(s => s.id === stepId);
    if (step) {
      if (resolution.manualOverrideVerified === false) {
        step.status = 'failed';
      } else {
        step.status = 'completed';
        if (resolution.output) {
          step.output = resolution.output;
        }
        
        // Write the execution output directly to the shared Blackboard state
        this.blackboard.write(step.id, resolution.output ?? true, {
          activationEnergy: 1.0,
          decayRate: 0.15, // standard operational result decay
          metadata: { workflowId, stepId: step.id, status: 'completed' }
        });

        // Store biometric metadata if provided
        if (resolution.biometricAuth) {
          step.payload.biometricSignature = resolution.biometricAuth.signature;
          step.payload.biometricDevice = resolution.biometricAuth.deviceType;
          
          this.blackboard.write(`biometric:${step.id}`, resolution.biometricAuth, {
            activationEnergy: 0.8,
            decayRate: 0.25, // biometric metadata decays fast after verification
            metadata: { workflowId, stepId: step.id }
          });
        }
      }

      // Run turn-based synaptic pruning/decay cycles across the blackboard
      const decayResult = await this.blackboard.decay();
      if (decayResult.prunedKeys.length > 0) {
        this.emit("blackboard:pruned", { workflowId, keys: decayResult.prunedKeys });
      }

      this.evaluateGraph(workflowId);
    }
  }
}

