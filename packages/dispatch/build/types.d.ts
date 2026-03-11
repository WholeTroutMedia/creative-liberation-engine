export type TaskStatus = 'queued' | 'active' | 'blocked' | 'done' | 'failed' | 'handoff';
export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type AgentTool = 'antigravity' | 'cursor' | 'claude-desktop' | 'script' | 'cron' | 'unknown';
export interface Task {
    id: string;
    org: string;
    project: string;
    workstream: string;
    title: string;
    description?: string;
    acceptance_criteria?: string[];
    priority: TaskPriority;
    status: TaskStatus;
    dependencies: string[];
    parent_task_id: string | null;
    spawned_by: string | null;
    assigned_to_agent: string | null;
    assigned_to_capability: string | null;
    claimed_by: string | null;
    claimed_at: string | null;
    completed_at: string | null;
    handoff_note: string | null;
    artifacts: string[];
    created: string;
    created_by: string;
    updated: string;
}
export type AgentStatus = 'active' | 'idle' | 'stale';
export interface Agent {
    agent_id: string;
    tool: AgentTool;
    capabilities: string[];
    session_id: string;
    connected_at: string;
    last_seen: string;
    active_task_id: string | null;
    notifications: AgentNotification[];
    window?: string;
    workstream?: string;
    status?: AgentStatus;
    current_task?: string;
}
export interface AgentNotification {
    from: string;
    message: string;
    task_id?: string;
    sent_at: string;
    read: boolean;
}
export interface Project {
    id: string;
    org: string;
    name: string;
    repo_url: string;
    workstreams: string[];
    registered_at: string;
    active: boolean;
}
export interface DispatchStore {
    tasks: Task[];
    agents: Agent[];
    projects: Project[];
    sessions: SessionLog[];
}
export interface SessionLog {
    session_id: string;
    agent_id: string;
    started_at: string;
    ended_at: string | null;
    tasks_claimed: string[];
    tasks_completed: string[];
}
