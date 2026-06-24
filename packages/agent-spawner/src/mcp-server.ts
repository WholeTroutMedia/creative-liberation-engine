import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { AgentSpawner } from "./spawner.js";

const spawner = new AgentSpawner();

const server = new Server(
  {
    name: "agent-spawner-mcp",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "spawner.spawn_from_manifest",
        description: "Dynamically spin up a new operational agent based on a SkillManifest. Auto-checkpoints to NAS for multi-day persistence.",
        inputSchema: {
          type: "object",
          properties: {
            agent: {
              type: "string",
              description: "The name of the agent to spawn",
            },
            skills: {
              type: "array",
              description: "Array of skills the agent should have",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                },
                required: ["name"],
              },
            },
            port: {
              type: "number",
              description: "Optional port to run the agent on",
            },
            targetDir: {
              type: "string",
              description: "Optional target directory for the agent runtime files",
            },
            resumeFromCheckpoint: {
              type: "boolean",
              description: "If true, attempt to resume from a prior NAS checkpoint",
            },
            resumeToken: {
              type: "string",
              description: "Resume token from a prior hibernation",
            },
          },
          required: ["agent", "skills"],
        },
      },
      {
        name: "spawner.hibernate_agent",
        description: "Persist an active agent's execution context to the NAS for multi-day hibernation. Returns a resume token.",
        inputSchema: {
          type: "object",
          properties: {
            agentId: {
              type: "string",
              description: "The ID of the agent to hibernate",
            },
            context: {
              type: "object",
              description: "The agent's current execution context to persist",
            },
          },
          required: ["agentId", "context"],
        },
      },
      {
        name: "spawner.resume_agent",
        description: "Resume a hibernated agent from its NAS checkpoint using a resume token.",
        inputSchema: {
          type: "object",
          properties: {
            agentId: {
              type: "string",
              description: "The ID of the agent to resume",
            },
            resumeToken: {
              type: "string",
              description: "The resume token received from hibernation",
            },
          },
          required: ["agentId", "resumeToken"],
        },
      },
      {
        name: "spawner.compress_context",
        description: "Compress raw DOM or terminal output into lean actionable markdown via local Ollama inference (qwen3-coder).",
        inputSchema: {
          type: "object",
          properties: {
            rawInput: {
              type: "string",
              description: "The raw DOM or terminal output to compress",
            },
            strategy: {
              type: "string",
              enum: ["dom", "terminal"],
              description: "Compression strategy: 'dom' for HTML/DOM content, 'terminal' for CLI output",
            },
          },
          required: ["rawInput"],
        },
      },
      {
        name: "spawner.purge_expired_checkpoints",
        description: "Purge NAS-stored agent checkpoints older than a specified number of days. Default: 7 days.",
        inputSchema: {
          type: "object",
          properties: {
            maxAgeDays: {
              type: "number",
              description: "Maximum age in days before a checkpoint is purged. Defaults to 7.",
            },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "spawner.spawn_from_manifest": {
        const manifest = {
          agent: (args as any).agent,
          skills: (args as any).skills,
        };
        const options = {
          port: (args as any).port,
          targetDir: (args as any).targetDir,
          resumeFromCheckpoint: (args as any).resumeFromCheckpoint,
          resumeToken: (args as any).resumeToken,
        };

        const result = await spawner.spawnFromManifest(manifest, options);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, result }, null, 2),
            },
          ],
        };
      }

      case "spawner.hibernate_agent": {
        const result = await spawner.hibernateAgent(
          (args as any).agentId,
          (args as any).context
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: !!result, result }, null, 2),
            },
          ],
        };
      }

      case "spawner.resume_agent": {
        const context = await spawner.resumeAgent(
          (args as any).agentId,
          (args as any).resumeToken
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: !!context, context }, null, 2),
            },
          ],
        };
      }

      case "spawner.compress_context": {
        const compressed = await spawner.compressContext(
          (args as any).rawInput,
          (args as any).strategy || 'dom'
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                originalLength: (args as any).rawInput.length,
                compressedLength: compressed.length,
                reductionPercent: Math.round((1 - compressed.length / (args as any).rawInput.length) * 100),
                compressed,
              }, null, 2),
            },
          ],
        };
      }

      case "spawner.purge_expired_checkpoints": {
        const result = await spawner.purgeExpiredCheckpoints(
          (args as any)?.maxAgeDays
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, ...result }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Agent Spawner MCP v2.0 — Cognitive Upgrade (Hibernate/Resume/Compress/Purge)");
}

run().catch((error) => {
  console.error("Fatal error running Agent Spawner MCP server:", error);
  process.exit(1);
});
