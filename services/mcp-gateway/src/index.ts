import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const app = express();
const PORT = process.env.MCP_GATEWAY_PORT || 5057; // Hub is 5056, Home Mesh is 5055, Gateway is 5057

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const SKILLS_FILE = path.join(ROOT_DIR, 'runtime', 'registry', 'skills.canonical.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health Check
app.get('/health', (_req, res) => {
  res.json({
    status: 'operational',
    service: 'sovereign-mcp-gateway',
    version: '1.0.0',
    skills_loaded: fs.existsSync(SKILLS_FILE) ? JSON.parse(fs.readFileSync(SKILLS_FILE, 'utf-8')).skills?.length || 0 : 0,
    uptime: process.uptime(),
  });
});

// Dynamic Tool Creator from Canonical Skills
export function createMcpGatewayServer(): McpServer {
  const server = new McpServer({
    name: 'Sovereign MCP Gateway',
    version: '1.0.0',
  });

  if (!fs.existsSync(SKILLS_FILE)) {
    console.error(`[MCP Gateway] Canonical skills registry not found at: ${SKILLS_FILE}`);
    return server;
  }

  try {
    const registry = JSON.parse(fs.readFileSync(SKILLS_FILE, 'utf-8'));
    const skills = registry.skills || [];
    let count = 0;

    for (const skill of skills) {
      if (skill.status !== 'active' || skill.agentCallable !== true) {
        continue;
      }

      // Convert skill-id kebab case to mcp snake case
      const toolName = `skill_${skill.skillId.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const toolDesc = `[SKILL: ${skill.domain}] ${skill.summary} (Input Hints: ${skill.inputHints || 'None'})`;

      server.tool(
        toolName,
        toolDesc,
        {
          input: z.string().describe(`Primary input or payload context. Input expectations: ${skill.inputHints || 'None'}`),
          task_context: z.string().optional().describe('Optional system metadata or conversational context.'),
        } as any,
        (async (args: any) => {
          const { input, task_context } = args;
          const skillPath = path.join(ROOT_DIR, skill.path);
          let instructions = '';

          try {
            if (fs.existsSync(skillPath)) {
              instructions = fs.readFileSync(skillPath, 'utf-8');
            } else {
              instructions = `No detailed SKILL.md file found at expected path: ${skill.path}. Fallback to description: ${skill.summary}`;
            }
          } catch (err: any) {
            instructions = `Error loading skill instructions: ${err.message}`;
          }

          // Return structured payload so the calling agent has full contract instructions
          const responsePayload = {
            skillId: skill.skillId,
            name: skill.name,
            domain: skill.domain,
            input_received: input,
            task_context: task_context || 'None',
            canonical_contract: instructions,
            guideline: `Execute the above SKILL.md contract instructions step-by-step using your local shell and sandbox tools. Enforce Article IX (no MVP) and comply with all listed guardrails. Output the exact outcomes specified in the contract.`
          };

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(responsePayload, null, 2),
              },
            ],
          };
        }) as any
      );

      count++;
    }

    console.log(`[MCP Gateway] Dynamically loaded ${count} canonical skills as native MCP tools.`);
  } catch (err: any) {
    console.error(`[MCP Gateway] Failed to parse skills canonical registry: ${err.message}`);
  }

  return server;
}

// SSE Transport Mounting or Stdio Transport
const mcpServer = createMcpGatewayServer();

if (process.argv.includes('--stdio')) {
  const transport = new StdioServerTransport();
  mcpServer.connect(transport).then(() => {
    console.error('[MCP Gateway] Running in stdio mode');
  }).catch(console.error);
} else {
  const transports: Map<string, SSEServerTransport> = new Map();

  app.get('/mcp/sse', async (req, res) => {
    const transport = new SSEServerTransport('/mcp/messages', res);
    transports.set(transport.sessionId, transport);
    res.on('close', () => transports.delete(transport.sessionId));
    await mcpServer.connect(transport);
  });

  app.post('/mcp/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);
    if (!transport) return res.status(404).json({ error: 'Session not found' });
    await transport.handlePostMessage(req, res);
  });

  app.listen(PORT, () => {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║        🌐  SOVEREIGN MCP GATEWAY v1.0.0                  ║');
    console.log('║        Dynamic Canonical Skill Orchestration             ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log(`  REST API:    http://localhost:${PORT}/health             `);
    console.log(`  MCP SSE:     http://localhost:${PORT}/mcp/sse            `);
    console.log(`  Registry:    ${SKILLS_FILE}                              `);
    console.log('=============================================================');
  });
}


