/**
 * RBAC — Role-Based Access Control for the Sovereign MCP Hub.
 * Agents authenticate via x-agent-id header. Roles define permissions.
 */
import { Request, Response, NextFunction } from 'express';

export interface AgentRole {
  name: string;
  permissions: string[]; // e.g. 'track:read', 'track:write', 'hive:read', 'hive:write', 'admin'
}

const AGENT_ROLES: Record<string, AgentRole> = {
  'CORTEX-Architect': {
    name: 'CORTEX-Architect',
    permissions: ['track:read', 'track:write', 'hive:read', 'hive:write', 'admin'],
  },
  'Swarm-Builder': {
    name: 'Swarm-Builder',
    permissions: ['track:read', 'track:write', 'hive:read'],
  },
  'Harvester': {
    name: 'Harvester',
    permissions: ['hive:read', 'hive:write'],
  },
  'Human': {
    name: 'Human',
    permissions: ['track:read', 'track:write', 'hive:read', 'hive:write', 'admin'],
  },
  // Default fallback for unknown agents
  'anonymous': {
    name: 'anonymous',
    permissions: ['track:read', 'hive:read'],
  },
};

export function getAgentRole(agentId: string): AgentRole {
  // Match by prefix for swarm agents (e.g., 'Swarm-Builder-1' matches 'Swarm-Builder')
  for (const [key, role] of Object.entries(AGENT_ROLES)) {
    if (agentId.startsWith(key)) return role;
  }
  return AGENT_ROLES['anonymous'];
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const agentId = (req.headers['x-agent-id'] as string) || 'Human';
    const role = getAgentRole(agentId);

    if (!role.permissions.includes(permission) && !role.permissions.includes('admin')) {
      return res.status(403).json({
        error: 'Forbidden',
        agent: agentId,
        role: role.name,
        required: permission,
        granted: role.permissions,
      });
    }

    // Attach agent info to request for downstream use
    (req as any).agentId = agentId;
    (req as any).agentRole = role;
    next();
  };
}
