import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";

// NAS Path for the Media Vault
const BASE_RAW_PATH = process.env.RAW_BACKUPS_PATH || "/volume2/The Vault/RAW Backups";

// Ensure a path is within the allowed base path
const isSafePath = (targetPath) => {
  const resolvedPath = path.resolve(BASE_RAW_PATH, targetPath);
  return resolvedPath.startsWith(path.resolve(BASE_RAW_PATH));
};

const server = new Server(
  {
    name: "synology-media-mcp",
    version: "6.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_barnstorm_media",
        description: "List Barnstorm raw media and proxies from the Synology RAW Backups directory. Sorted by years.",
        inputSchema: {
          type: "object",
          properties: {
            year: {
              type: "string",
              description: "The year directory to check (e.g., '2025', '2026'). If omitted, lists available years.",
            },
            directory: {
              type: "string",
              description: "A specific Barnstorm directory inside the year folder to list files for.",
            }
          },
        },
      },
      {
        name: "get_media_info",
        description: "Get detailed information about a specific media file or proxy on the NAS.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "The relative path to the media file.",
            }
          },
          required: ["filePath"]
        }
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "list_barnstorm_media") {
    const { year, directory } = request.params.arguments || {};
    
    try {
      if (!year) {
        // List years
        const entries = await fs.readdir(BASE_RAW_PATH, { withFileTypes: true });
        const years = entries
          .filter(e => e.isDirectory() && /^\d{4}$/.test(e.name))
          .map(e => e.name);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ availableYears: years }, null, 2)
            }
          ]
        };
      }

      if (year && !directory) {
        // List Barnstorm directories in the year
        const yearPath = path.join(BASE_RAW_PATH, year);
        if (!isSafePath(yearPath)) throw new Error("Invalid path");
        
        const entries = await fs.readdir(yearPath, { withFileTypes: true });
        const barnstormDirs = entries
          .filter(e => e.isDirectory() && e.name.toLowerCase().includes("barnstorm"))
          .map(e => e.name);
          
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ year, barnstormDirectories: barnstormDirs }, null, 2)
            }
          ]
        };
      }

      if (year && directory) {
        const targetPath = path.join(BASE_RAW_PATH, year, directory);
        if (!isSafePath(targetPath)) throw new Error("Invalid path");
        
        // Find raw files and their proxies
        const files = await fs.readdir(targetPath, { recursive: true, withFileTypes: true });
        
        const rawFiles = [];
        const proxyFiles = [];
        
        for (const file of files) {
          if (file.isDirectory()) continue;
          
          const fullPath = path.join(file.parentPath || targetPath, file.name);
          const relPath = path.relative(targetPath, fullPath);
          
          if (fullPath.includes("Proxies") || file.name.toLowerCase().includes("proxy")) {
            proxyFiles.push(relPath);
          } else if (file.name.match(/\.(mp4|mov|mxf|braw|r3d|raw)$/i)) {
            rawFiles.push(relPath);
          }
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ 
                directory: targetPath, 
                rawMediaCount: rawFiles.length,
                proxyCount: proxyFiles.length,
                rawMedia: rawFiles.slice(0, 50), // Limit output
                proxies: proxyFiles.slice(0, 50)
              }, null, 2)
            }
          ]
        };
      }
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: `Error accessing media: ${e.message}`
          }
        ],
        isError: true
      };
    }
  }

  if (request.params.name === "get_media_info") {
    const { filePath } = request.params.arguments || {};
    try {
      const fullPath = path.join(BASE_RAW_PATH, filePath);
      if (!isSafePath(fullPath)) throw new Error("Invalid path");
      
      const stats = await fs.stat(fullPath);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              file: filePath,
              size: stats.size,
              created: stats.birthtime,
              modified: stats.mtime,
              isProxy: fullPath.includes("Proxies") || filePath.toLowerCase().includes("proxy")
            }, null, 2)
          }
        ]
      }
    } catch(e) {
      return {
        content: [{ type: "text", text: `Error: ${e.message}` }],
        isError: true
      };
    }
  }

  throw new Error(`Tool not found: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Synology Media MCP Server running on stdio");
}

main().catch(console.error);
