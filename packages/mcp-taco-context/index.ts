import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "mcp-taco-context",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// TACO Context Compression Logic
function compressTerminalContext(rawLog: string, maxLines: number = 50): string {
  const lines = rawLog.split('\n');
  if (lines.length <= maxLines) return rawLog;

  // Preserve first 20 and last 30 lines, removing redundant middle
  const head = lines.slice(0, 20);
  const tail = lines.slice(-30);
  return [...head, `\n... [TACO COMPRESSION: Removed ${lines.length - 50} redundant lines] ...\n`, ...tail].join('\n');
}

function compressCodeObservation(code: string): string {
    // Basic compression: strip out large blocks of comments or empty lines for token efficiency
    return code.replace(/\/\*[\s\S]*?\*\/|(?<=\n)\s*\/\/.*/g, '').replace(/\n\s*\n/g, '\n');
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "compress_terminal_context",
        description: "Compresses large terminal outputs by stripping redundant middle sections to save token budget (IE-IDX-0049).",
        inputSchema: {
          type: "object",
          properties: {
            raw_log: { type: "string", description: "The raw terminal output string" },
            max_lines: { type: "number", description: "Max lines to preserve (default 50)" }
          },
          required: ["raw_log"],
        },
      },
      {
        name: "compress_code_observation",
        description: "Compresses code string observations by removing large comment blocks and empty lines.",
        inputSchema: {
          type: "object",
          properties: {
            code_snippet: { type: "string", description: "The raw code snippet" }
          },
          required: ["code_snippet"],
        },
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "compress_terminal_context") {
    const raw_log = String(request.params.arguments?.raw_log);
    const max_lines = Number(request.params.arguments?.max_lines || 50);
    const compressed = compressTerminalContext(raw_log, max_lines);
    return {
      content: [{ type: "text", text: compressed }],
    };
  }
  
  if (request.params.name === "compress_code_observation") {
    const code_snippet = String(request.params.arguments?.code_snippet);
    const compressed = compressCodeObservation(code_snippet);
    return {
      content: [{ type: "text", text: compressed }],
    };
  }

  throw new Error("Tool not found");
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("TACO Context Compression MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
