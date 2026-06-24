// Agent and Canvas type definitions for Creative Liberation Engine

export interface Agent {
  id: string
  name: string
  status: 'idle' | 'busy' | 'error'
  capabilities: string[]
}

export interface Task {
  id: string
  description: string
  agentId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: string
  createdAt: Date
}

// WebSocket message types
export interface WebSocketMessage {
  type: string
  [key: string]: any
}

export interface AgentStatusMessage extends WebSocketMessage {
  type: 'agent_status'
  agentId: string
  status: Agent['status']
  capabilities: string[]
}

export interface TaskResultMessage extends WebSocketMessage {
  type: 'task_result'
  taskId: string
  result: string
  status: 'success' | 'error'
}

export interface AgentStreamMessage extends WebSocketMessage {
  type: 'agent_stream'
  agentId: string
  chunk: string
}

// Canvas types
export interface CanvasNode {
  id: string
  agentId: string
  agentName: string
  x: number
  y: number
  width: number
  height: number
  data?: any
}

export interface CanvasConnection {
  id: string
  from: string // node id
  to: string // node id
  label?: string
}

export interface CanvasViewport {
  x: number
  y: number
  zoom: number
}

export interface WorkflowState {
  nodes: CanvasNode[]
  connections: CanvasConnection[]
  viewport: CanvasViewport
}
