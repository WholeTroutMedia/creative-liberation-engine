import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Ollama } from 'ollama';

// Configure the Ollama instance to hit the local sovereign model (usually on the NAS or workstation)
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://host.docker.internal:11434';
const ollamaClient = new Ollama({ host: OLLAMA_HOST });

const server = new Server(
  {
    name: "ollama-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_local_models",
        description: "List all AI models currently available on the sovereign local hardware via Ollama.",
        inputSchema: {
          type: "object" as const,
          properties: {},
          required: [],
        },
      },
      {
        name: "generate_local",
        description: "Generate text or code using a specific local sovereign model (e.g. qwen2.5-coder:32b). Use this whenever strict privacy or offline capability is needed.",
        inputSchema: {
          type: "object" as const,
          properties: {
            model: {
              type: "string",
              description: "The name of the local model to use (e.g., qwen2.5-coder:32b)",
            },
            prompt: {
              type: "string",
              description: "The instruction or prompt to send to the model",
            },
            system: {
              type: "string",
              description: "Optional system instructions for the model",
            }
          },
          required: ["model", "prompt"],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "list_local_models") {
    try {
      const response = await ollamaClient.list();
      const modelNames = response.models.map((m: { name: string }) => m.name);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ availableModels: modelNames }, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to connect to local Ollama instance at ${OLLAMA_HOST}: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (request.params.name === "generate_local") {
    try {
      const args = request.params.arguments as Record<string, unknown>;
      const response = await ollamaClient.generate({
        model: args.model as string,
        prompt: args.prompt as string,
        system: args.system as string | undefined,
        stream: false,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: response.response,
          },
        ],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Local inference failed for model '${request.params.arguments?.model}': ${message}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

// Start the stdio server
async function run() {
  console.error(`Starting MCP Server: ollama-mcp (Host: ${OLLAMA_HOST})`);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server successfully connected via stdio.");
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
