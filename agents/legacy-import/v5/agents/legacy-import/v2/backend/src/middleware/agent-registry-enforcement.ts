/**
 * Agent Registry Enforcement Middleware
 * Blocks API requests for invalid agents
 */

import { Request, Response, NextFunction } from 'express';
import { agentRegistry } from '../core/agent-registry-validator';

/**
 * Middleware to validate agent existence before processing request
 */
export function enforceAgentRegistry(req: Request, res: Response, next: NextFunction): void {
  const agentId = req.params.agentId || req.body.agentId || req.query.agentId;

  if (!agentId) {
    // No agent specified, let request through
    return next();
  }

  const validation = agentRegistry.validateAgentExists(agentId as string);

  if (!validation.exists) {
    res.status(404).json({
      error: 'AGENT_NOT_FOUND',
      message: validation.error,
      suggestions: validation.suggestions,
      protocol_violation: 'AGENT_BOOT_PROTOCOL requires loading .agent-status.json first',
      boot_report: agentRegistry.generateBootReport()
    });
    return;
  }

  // Attach agent data to request for downstream use
  (req as any).validatedAgent = validation.agent;
  next();
}

/**
 * Middleware to attach boot protocol report to response
 */
export function attachBootReport(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = function(data: any) {
    const enrichedData = {
      ...data,
      _boot_protocol: {
        system_version: agentRegistry.getSystemVersion(),
        total_agents: agentRegistry.getAgentCount().decompressed,
        validated: true,
        timestamp: new Date().toISOString()
      }
    };
    return originalJson(enrichedData);
  };

  next();
}

/**
 * Express router-level validation
 */
export function createAgentValidationRouter() {
  const express = require('express');
  const router = express.Router();

  // Load registry on router initialization
  agentRegistry.loadRegistry();

  // Validate all agent-related requests
  router.use(enforceAgentRegistry);

  return router;
}
