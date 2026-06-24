#!/usr/bin/env node
/**
 * Vercel MCP Server — Creative Liberation Engine V6 wrapper
 *
 * Thin entry point that delegates to the vercel-mcp-server npm package.
 * The upstream package exposes a full MCP stdio server for Vercel API management
 * (deployments, domains, projects, DNS, env vars, logs, etc.)
 *
 * Environment:
 *   VERCEL_API_TOKEN — Required. Vercel API token for authentication.
 *
 * @package @cle/vercel-mcp
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';

const require = createRequire(import.meta.url);

// Resolve the vercel-mcp-server binary entrypoint
const vercelMcpPkg = require.resolve('vercel-mcp-server/package.json');
const vercelMcpDir = dirname(vercelMcpPkg);
const entrypoint = resolve(vercelMcpDir, 'dist', 'index.js');

// Validate VERCEL_API_TOKEN is set
if (!process.env.VERCEL_API_TOKEN) {
  console.error('[VERCEL-MCP] ⚠️  VERCEL_API_TOKEN not set — server will start but API calls will fail.');
}

console.error(`[VERCEL-MCP] Launching vercel-mcp-server from: ${entrypoint}`);

// Forward stdio to the upstream server directly (inherits stdin/stdout/stderr for MCP stdio transport)
try {
  execFileSync(process.execPath, [entrypoint], {
    stdio: 'inherit',
    env: process.env,
  });
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[VERCEL-MCP] Fatal error: ${message}`);
  process.exit(1);
}
