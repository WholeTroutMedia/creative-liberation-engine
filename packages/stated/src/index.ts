import { z } from 'zod';

export interface StateNode {
  id: string;
  type: 'task' | 'decision' | 'breakpoint';
  execute: (context: any) => Promise<any>;
  onSuccess?: string;
  onFailure?: string;
  onCondition?: (result: any) => string;
}

export interface ExecutionFrame {
  currentNodeId: string;
  context: any;
  history: string[];
  status: 'running' | 'suspended' | 'completed' | 'failed';
  breakpointReason?: string;
}

export class DAGEngine {
  private nodes: Map<string, StateNode> = new Map();

  addNode(node: StateNode) {
    this.nodes.set(node.id, node);
  }

  async run(startNodeId: string, initialContext: any, onBreakpoint?: (frame: ExecutionFrame) => void): Promise<ExecutionFrame> {
    const frame: ExecutionFrame = {
      currentNodeId: startNodeId,
      context: initialContext,
      history: [],
      status: 'running'
    };

    return this.step(frame, onBreakpoint);
  }

  async step(frame: ExecutionFrame, onBreakpoint?: (frame: ExecutionFrame) => void): Promise<ExecutionFrame> {
    while (frame.status === 'running') {
      const node = this.nodes.get(frame.currentNodeId);
      if (!node) {
        frame.status = 'failed';
        frame.context.error = `Node ${frame.currentNodeId} not found.`;
        break;
      }

      frame.history.push(frame.currentNodeId);

      // Handle Human-in-the-loop breakpoint before execution
      if (node.type === 'breakpoint') {
        frame.status = 'suspended';
        frame.breakpointReason = `Human-in-the-loop approval required at node: ${node.id}`;
        if (onBreakpoint) {
          onBreakpoint(frame);
        }
        break;
      }

      try {
        const result = await node.execute(frame.context);
        frame.context[node.id] = result;

        // Routing logic
        let nextNodeId: string | undefined;
        if (node.onCondition) {
          nextNodeId = node.onCondition(result);
        } else {
          nextNodeId = node.onSuccess;
        }

        if (nextNodeId) {
          frame.currentNodeId = nextNodeId;
        } else {
          frame.status = 'completed';
        }
      } catch (err: any) {
        frame.context.error = err?.message || String(err);
        if (node.onFailure) {
          frame.currentNodeId = node.onFailure;
        } else {
          frame.status = 'failed';
          break;
        }
      }
    }

    return frame;
  }

  // Hot-reload frame context and resume
  async resume(frame: ExecutionFrame, approvedContext: any, onBreakpoint?: (frame: ExecutionFrame) => void): Promise<ExecutionFrame> {
    if (frame.status !== 'suspended') {
      throw new Error(`Cannot resume a frame that is not suspended. Current status: ${frame.status}`);
    }

    // Hot-reload context
    frame.context = { ...frame.context, ...approvedContext };
    frame.status = 'running';
    delete frame.breakpointReason;

    // Advance to next state since breakpoint is resolved
    const node = this.nodes.get(frame.currentNodeId);
    if (node && node.onSuccess) {
      frame.currentNodeId = node.onSuccess;
    } else {
      frame.status = 'completed';
    }

    return this.step(frame, onBreakpoint);
  }
}
