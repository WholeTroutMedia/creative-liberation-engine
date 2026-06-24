#!/usr/bin/env node
/**
 * cle-scribe MCP Server
 *
 * Exposes SCRIBE v2 memory and context-paging as MCP tools consumable
 * by Claude Code or any MCP-compatible client.
 *
 * This is a zero-dependency implementation of the Model Context Protocol (MCP)
 * over standard input/output (stdio), complying with standard JSON-RPC 2.0.
 *
 * Tools:
 *   scribe.remember    — Store a memory entry (key, value, tags, ttl)
 *   scribe.recall      — Retrieve memories by key, tag, or semantic query
 *   scribe.context     — Get paged context window for current session
 *   scribe.forget      — Remove a memory entry by key
 *   scribe.handoff     — Generate HANDOFF.md from current session state
 *   scribe.fs_list     — List files in the sandboxed directory
 *   scribe.fs_read     — Read text file from the sandbox
 *   scribe.fs_write    — Write text file to the sandbox
 *   scribe.fs_search   — Search text files recursively inside sandbox
 *
 * @package scribe-mcp
 * @issue #30 — Phase A
 * @agent COMET (AURORA hive)
 */

import * as fs from 'fs';
import * as path from 'path';
import { createInterface } from 'readline';

// —— Types ——————————————————————————————————

export interface MemoryEntry {
  key: string;
  value: string;
  tags: string[];
  timestamp: string;
  ttl?: number;       // seconds, null = permanent
  source: string;     // agent ID that created this
  session?: string;
}

export interface ContextPage {
  pageIndex: number;
  totalPages: number;
  entries: MemoryEntry[];
  tokenEstimate: number;
  sessionId: string;
}

// —— In-Memory Store (Phase A — upgrades to AlloyDB/Redis in Phase B) ———

const BUFFER_PATH = path.resolve(process.cwd(), '.agents/scribe-buffer.json');
let memoryStore: Map<string, MemoryEntry> = new Map();

// Load initial state
try {
  if (fs.existsSync(BUFFER_PATH)) {
    const data = JSON.parse(fs.readFileSync(BUFFER_PATH, 'utf-8'));
    memoryStore = new Map(Object.entries(data));
  }
} catch (e) {
  console.error('[SCRIBE-MCP] Failed to load buffer:', e);
}

function persistStore() {
  try {
    fs.mkdirSync(path.dirname(BUFFER_PATH), { recursive: true });
    fs.writeFileSync(BUFFER_PATH, JSON.stringify(Object.fromEntries(memoryStore), null, 2), 'utf-8');
  } catch (e) {
    console.error('[SCRIBE-MCP] Failed to flush to disk', e);
  }
}

const PAGE_SIZE = 20;
let sessionId = `session-${Date.now()}`;

function generateKey(): string {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// —— Sandboxed Filesystem Core ———————————————
const SANDBOX_ROOT = path.resolve(process.env.SCRIBE_SANDBOX_ROOT || process.cwd());

function validatePath(targetPath: string): string {
  const resolved = path.resolve(SANDBOX_ROOT, targetPath);
  if (!resolved.startsWith(SANDBOX_ROOT)) {
    throw new Error(`Access Denied: Path traversal detected. Target path '${targetPath}' resolved outside sandbox root '${SANDBOX_ROOT}'`);
  }
  return resolved;
}

// —— Tool Handlers ——————————————————————————

async function executeTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'scribe.remember': {
      const key = (args?.key as string) || generateKey();
      const entry: MemoryEntry = {
        key,
        value: args?.value as string,
        tags: (args?.tags as string[]) || [],
        timestamp: new Date().toISOString(),
        ttl: args?.ttl as number | undefined,
        source: (args?.source as string) || 'unknown',
        session: sessionId,
      };
      memoryStore.set(key, entry);
      persistStore();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ stored: true, key, totalMemories: memoryStore.size }),
        }],
      };
    }

    case 'scribe.recall': {
      let results: MemoryEntry[] = [];
      const limit = (args?.limit as number) || 10;

      if (args?.key) {
        const entry = memoryStore.get(args.key as string);
        if (entry) results.push(entry);
      } else {
        const allEntries = Array.from(memoryStore.values());
        if (args?.tag) {
          results = allEntries.filter(e => e.tags.includes(args!.tag as string));
        } else if (args?.query) {
          const q = (args.query as string).toLowerCase();
          results = allEntries.filter(e =>
            e.value.toLowerCase().includes(q) || e.key.toLowerCase().includes(q)
          );
        } else {
          results = allEntries;
        }
      }

      // Evict expired entries
      const now = Date.now();
      results = results.filter(e => {
        if (!e.ttl) return true;
        const created = new Date(e.timestamp).getTime();
        return (now - created) < (e.ttl * 1000);
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ count: Math.min(results.length, limit), results: results.slice(0, limit) }),
        }],
      };
    }

    case 'scribe.context': {
      const page = (args?.page as number) || 0;
      const size = (args?.pageSize as number) || PAGE_SIZE;
      let entries = Array.from(memoryStore.values());

      if (args?.sessionFilter) {
        entries = entries.filter(e => e.session === args!.sessionFilter);
      }

      // Sort by timestamp descending (most recent first)
      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const totalPages = Math.ceil(entries.length / size);
      const paged = entries.slice(page * size, (page + 1) * size);
      const tokenEstimate = paged.reduce((sum, e) => sum + estimateTokens(e.value), 0);

      const contextPage: ContextPage = {
        pageIndex: page,
        totalPages,
        entries: paged,
        tokenEstimate,
        sessionId,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(contextPage) }],
      };
    }

    case 'scribe.forget': {
      const deleted = memoryStore.delete(args?.key as string);
      if (deleted) persistStore();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ deleted, key: args?.key, remaining: memoryStore.size }),
        }],
      };
    }

    case 'scribe.handoff': {
      const sessionEntries = Array.from(memoryStore.values())
        .filter(e => e.session === sessionId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const handoff = [
        `# HANDOFF: ${args?.agentId} Session`,
        '',
        `**From:** ${args?.agentId}`,
        `**Phase:** ${args?.phase || 'SHIP'}`,
        `**Timestamp:** ${new Date().toISOString()}`,
        `**Memories:** ${sessionEntries.length}`,
        '',
        '## Summary',
        '',
        args?.summary as string,
        '',
        '## Session Memories',
        '',
        '| Key | Tags | Value (truncated) |',
        '| ---- | ---- | ---- |',
        ...sessionEntries.map(e =>
          `| ${e.key} | ${e.tags.join(', ')} | ${e.value.slice(0, 80)}${e.value.length > 80 ? '...' : ''} |`
        ),
      ].join('\n');

      return {
        content: [{ type: 'text', text: handoff }],
      };
    }

    case 'scribe.fs_list': {
      try {
        const relPath = (args?.directoryPath as string) || '.';
        const resolved = validatePath(relPath);
        if (!fs.existsSync(resolved)) {
          return {
            content: [{ type: 'text', text: `Directory not found: ${relPath}` }],
            isError: true,
          };
        }
        const stats = fs.statSync(resolved);
        if (!stats.isDirectory()) {
          return {
            content: [{ type: 'text', text: `Path is not a directory: ${relPath}` }],
            isError: true,
          };
        }
        const entries = fs.readdirSync(resolved, { withFileTypes: true });
        const list = entries.map(e => {
          const fullFilePath = path.join(resolved, e.name);
          let size = 0;
          try {
            size = fs.statSync(fullFilePath).size;
          } catch {}
          return {
            name: e.name,
            isDirectory: e.isDirectory(),
            isFile: e.isFile(),
            size,
          };
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ directoryPath: relPath, entries: list }) }],
        };
      } catch (e: any) {
        return {
          content: [{ type: 'text', text: `Error listing directory: ${e.message}` }],
          isError: true,
        };
      }
    }

    case 'scribe.fs_read': {
      try {
        const relPath = args?.filePath as string;
        const resolved = validatePath(relPath);
        if (!fs.existsSync(resolved)) {
          return {
            content: [{ type: 'text', text: `File not found: ${relPath}` }],
            isError: true,
          };
        }
        const stats = fs.statSync(resolved);
        if (!stats.isFile()) {
          return {
            content: [{ type: 'text', text: `Path is not a file: ${relPath}` }],
            isError: true,
          };
        }
        const content = fs.readFileSync(resolved, 'utf-8');
        return {
          content: [{ type: 'text', text: content }],
        };
      } catch (e: any) {
        return {
          content: [{ type: 'text', text: `Error reading file: ${e.message}` }],
          isError: true,
        };
      }
    }

    case 'scribe.fs_write': {
      try {
        const relPath = args?.filePath as string;
        const content = args?.content as string;
        const resolved = validatePath(relPath);
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        fs.writeFileSync(resolved, content, 'utf-8');
        return {
          content: [{ type: 'text', text: JSON.stringify({ written: true, filePath: relPath, bytes: Buffer.byteLength(content) }) }],
        };
      } catch (e: any) {
        return {
          content: [{ type: 'text', text: `Error writing file: ${e.message}` }],
          isError: true,
        };
      }
    }

    case 'scribe.fs_search': {
      try {
        const relPath = (args?.directoryPath as string) || '.';
        const query = (args?.query as string).toLowerCase();
        const resolved = validatePath(relPath);
        if (!fs.existsSync(resolved)) {
          return {
            content: [{ type: 'text', text: `Directory not found: ${relPath}` }],
            isError: true,
          };
        }
        
        const results: Array<{ filePath: string; lineNumber: number; lineContent: string }> = [];
        
        function searchDir(dir: string) {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            const fullPath = path.join(dir, e.name);
            if (e.isDirectory()) {
              if (fullPath.startsWith(SANDBOX_ROOT)) {
                searchDir(fullPath);
              }
            } else if (e.isFile()) {
              try {
                const text = fs.readFileSync(fullPath, 'utf-8');
                const lines = text.split('\n');
                lines.forEach((line, idx) => {
                  if (line.toLowerCase().includes(query)) {
                    const relativeFilePath = path.relative(SANDBOX_ROOT, fullPath);
                    results.push({
                      filePath: relativeFilePath,
                      lineNumber: idx + 1,
                      lineContent: line.trim(),
                    });
                  }
                });
              } catch {}
            }
          }
        }
        
        searchDir(resolved);
        return {
          content: [{ type: 'text', text: JSON.stringify({ query, results: results.slice(0, 100) }) }],
        };
      } catch (e: any) {
        return {
          content: [{ type: 'text', text: `Error searching directory: ${e.message}` }],
          isError: true,
        };
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// —— JSON-RPC 2.0 Message Handling ———————————

function sendResponse(id: any, result: any) {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    id,
    result,
  }) + '\n');
}

function sendError(id: any, code: number, message: string, data?: any) {
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data,
    },
  }) + '\n');
}

const TOOLS = [
  {
    name: 'scribe.remember',
    description: 'Store a memory entry in SCRIBE. Supports key-value pairs with optional tags and TTL.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Memory key (auto-generated if omitted)' },
        value: { type: 'string', description: 'Content to remember' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Categorization tags' },
        ttl: { type: 'number', description: 'Time-to-live in seconds (null = permanent)' },
        source: { type: 'string', description: 'Agent ID storing this memory' },
      },
      required: ['value'],
    },
  },
  {
    name: 'scribe.recall',
    description: 'Retrieve memories by key, tag filter, or text search.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Exact key lookup' },
        tag: { type: 'string', description: 'Filter by tag' },
        query: { type: 'string', description: 'Text search across values' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
    },
  },
  {
    name: 'scribe.context',
    description: 'Get paged context window for current session. Returns entries with token estimates for context management.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page index (0-based, default 0)' },
        pageSize: { type: 'number', description: 'Entries per page (default 20)' },
        sessionFilter: { type: 'string', description: 'Filter to specific session' },
      },
    },
  },
  {
    name: 'scribe.forget',
    description: 'Remove a memory entry by key.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key of memory to remove' },
      },
      required: ['key'],
    },
  },
  {
    name: 'scribe.handoff',
    description: 'Generate a HANDOFF.md document from current session state, including all memories tagged with the session.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent generating the handoff' },
        phase: { type: 'string', description: 'Current phase (IDEATE/PLAN/SHIP/VALIDATE)' },
        summary: { type: 'string', description: 'Session summary' },
      },
      required: ['agentId', 'summary'],
    },
  },
  {
    name: 'scribe.fs_list',
    description: 'List contents of a sandboxed directory path, including files and subdirectories with stats.',
    inputSchema: {
      type: 'object',
      properties: {
        directoryPath: { type: 'string', description: 'Relative path of directory to list (defaults to root)' },
      },
    },
  },
  {
    name: 'scribe.fs_read',
    description: 'Read the text content of a sandboxed file.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Relative path of the file to read' },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'scribe.fs_write',
    description: 'Write or overwrite text content to a sandboxed file path. Automatically creates parent directories if missing.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Relative path of the file to write' },
        content: { type: 'string', description: 'Content to write to the file' },
      },
      required: ['filePath', 'content'],
    },
  },
  {
    name: 'scribe.fs_search',
    description: 'Perform a recursive, portable text search (grep) under a sandboxed directory path.',
    inputSchema: {
      type: 'object',
      properties: {
        directoryPath: { type: 'string', description: 'Relative path of the directory to search (defaults to root)' },
        query: { type: 'string', description: 'String query to search for' },
      },
      required: ['query'],
    },
  },
];

async function handleRequest(request: any) {
  const { jsonrpc, id, method, params } = request;
  
  if (jsonrpc !== '2.0') {
    return; // JSON-RPC 2.0 required
  }

  try {
    switch (method) {
      case 'initialize':
        sendResponse(id, {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
          },
          serverInfo: {
            name: 'cle-scribe',
            version: '1.0.0',
          },
        });
        break;

      case 'notifications/initialized':
        // Acknowledge notification silently (no response allowed in JSON-RPC)
        break;

      case 'tools/list':
        sendResponse(id, {
          tools: TOOLS,
        });
        break;

      case 'tools/call': {
        const { name, arguments: args } = params || {};
        const result = await executeTool(name, args);
        sendResponse(id, result);
        break;
      }

      case 'resources/list':
        sendResponse(id, {
          resources: [
            {
              uri: `scribe://session/${sessionId}`,
              name: 'Current SCRIBE Session',
              description: `Active memory session with ${memoryStore.size} entries`,
              mimeType: 'application/json',
            },
          ],
        });
        break;

      default:
        sendError(id, -32601, `Method not found: ${method}`);
        break;
    }
  } catch (err: any) {
    sendError(id, -32603, `Internal error: ${err.message}`);
  }
}

// —— Start readline loop ——————————————————————

function main() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const request = JSON.parse(trimmed);
      handleRequest(request);
    } catch (e: any) {
      sendError(null, -32700, `Parse error: ${e.message}`);
    }
  });

  console.error('[SCRIBE-MCP] Zero-dependency MCP server started — SCRIBE v2 memory layer online');
}

// Check if running as main module
if (import.meta.url.startsWith('file:')) {
  const modulePath = path.resolve(process.argv[1]);
  const currentPath = path.resolve(new URL(import.meta.url).pathname);
  // Match check handles platform differences
  if (modulePath === currentPath || process.argv[1].endsWith('mcp-server.js') || process.argv[1].endsWith('mcp-server.ts')) {
    main();
  }
}
