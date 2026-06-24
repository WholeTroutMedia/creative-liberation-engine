/**
 * Agent Registry API Routes
 * Provides AGENT_BOOT_PROTOCOL compliance endpoints
 */

import express, { Request, Response } from 'express';
import { agentRegistry } from '../core/agent-registry-validator';

const router = express.Router();

/**
 * GET /api/agents/boot-report
 * Generate AGENT_BOOT_PROTOCOL compliance report
 */
router.get('/boot-report', (req: Request, res: Response) => {
  try {
    const report = agentRegistry.generateBootReport();
    res.json({
      success: true,
      protocol: 'AGENT_BOOT_PROTOCOL',
      report,
      message: 'Registry loaded successfully. Use this data for all agent operations.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load agent registry',
      message: error instanceof Error ? error.message : 'Unknown error',
      protocol_violation: true
    });
  }
});

/**
 * GET /api/agents/validate/:agentId
 * Validate specific agent exists
 */
router.get('/validate/:agentId', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const validation = agentRegistry.validateAgentExists(agentId);

  if (!validation.exists) {
    res.status(404).json({
      success: false,
      exists: false,
      error: validation.error,
      suggestions: validation.suggestions,
      all_agents: agentRegistry.getAllAgentNames()
    });
    return;
  }

  res.json({
    success: true,
    exists: true,
    agent: validation.agent,
    workspace: agentRegistry.getAgentWorkspace(agentId),
    status: agentRegistry.getAgentStatus(agentId)
  });
});

/**
 * GET /api/agents/list
 * Get all valid agent names
 */
router.get('/list', (req: Request, res: Response) => {
  try {
    const names = agentRegistry.getAllAgentNames();
    const counts = agentRegistry.getAgentCount();

    res.json({
      success: true,
      agents: names,
      counts,
      system_version: agentRegistry.getSystemVersion(),
      message: 'Use these exact names for all agent operations'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load agent list',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/agents/workspace/:agentId
 * Get agent workspace path
 */
router.get('/workspace/:agentId', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const workspace = agentRegistry.getAgentWorkspace(agentId);

  if (!workspace) {
    res.status(404).json({
      success: false,
      error: `Agent "${agentId}" not found or has no workspace`,
      suggestions: agentRegistry.getAllAgentNames().slice(0, 5)
    });
    return;
  }

  res.json({
    success: true,
    agentId,
    workspace,
    status: agentRegistry.getAgentStatus(agentId)
  });
});

export default router;
