/**
 * MCP Server — Standardized tool-calling for CORTEX and agent swarms.
 * Exposes Sentinel Track and Scholar Hive as MCP-protocol tools via SSE transport.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { semanticSearch } from './vectorize.js';
import WebSocket from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const DATA_DIR = process.env.MCP_HUB_DATA_DIR || path.join(ROOT_DIR, 'services', 'mcp-hub', 'data');
const ISSUES_FILE = path.join(DATA_DIR, 'issues.json');
const DOCS_FILE = path.join(DATA_DIR, 'docs.json');

function readJSON(file: string): any[] {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return []; }
}
function writeJSON(file: string, data: any[]): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

interface MetricoolSession {
  token: string;
  cookies: string;
  userId: string;
  blogId: string;
  timestamp: number;
}

let cachedSession: MetricoolSession | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

async function fetchMetricoolSessionFromCDP(): Promise<MetricoolSession> {
  if (cachedSession && (Date.now() - cachedSession.timestamp) < CACHE_TTL_MS) {
    return cachedSession;
  }

  const nasHost = '127.0.0.1';
  const cdpPort = '9224';
  const res = await fetch(`http://${nasHost}:${cdpPort}/json`);
  if (!res.ok) {
    throw new Error(`Failed to query CDP tabs: ${res.statusText}`);
  }
  const tabs = await res.json() as any[];
  
  const metricoolTab = tabs.find(t => t.url && t.url.includes("metricool.com"));
  if (!metricoolTab) {
    throw new Error("Metricool tab not found in active browser session");
  }
  
  const urlObj = new URL(metricoolTab.url);
  const blogId = urlObj.searchParams.get("blogId") || "";
  const userId = urlObj.searchParams.get("userId") || "";
  
  const wsUrl = metricoolTab.webSocketDebuggerUrl.replace("localhost:9223", `${nasHost}:${cdpPort}`);
  
  const session = await new Promise<{ cookies: any[]; token: string }>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let token = "";
    let cookies: any[] = [];
    let checks = 0;
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: "Network.getCookies",
        params: { urls: ["https://app.metricool.com"] }
      }));
      ws.send(JSON.stringify({
        id: 2,
        method: "Runtime.evaluate",
        params: { expression: "localStorage.getItem('global.authData')" }
      }));
    });
    
    ws.on('message', (data) => {
      try {
        const resp = JSON.parse(data.toString());
        if (resp.id === 1 && resp.result && resp.result.cookies) {
          cookies = resp.result.cookies;
          checks++;
        } else if (resp.id === 2 && resp.result && resp.result.result && resp.result.result.value) {
          const authData = JSON.parse(resp.result.result.value);
          token = authData.token;
          checks++;
        }
        if (checks >= 2) {
          ws.close();
          resolve({ cookies, token });
        }
      } catch (e) {
        ws.close();
        reject(e);
      }
    });
    
    ws.on('error', (err) => {
      ws.close();
      reject(err);
    });
    
    setTimeout(() => {
      ws.close();
      resolve({ cookies, token });
    }, 4000);
  });

  const cookieHeader = session.cookies.map(c => `${c.name}=${c.value}`).join('; ');
  
  cachedSession = {
    token: session.token,
    cookies: cookieHeader,
    userId,
    blogId,
    timestamp: Date.now()
  };

  return cachedSession;
}

function getMetricoolConfig(): { apiToken: string; userId?: string; blogId?: string } {
  const configFile = path.join(DATA_DIR, 'metricool_config.json');
  let token = process.env.METRICOOL_API_TOKEN || '';
  let userId = process.env.METRICOOL_USER_ID || '';
  let blogId = process.env.METRICOOL_BLOG_ID || '';

  if (fs.existsSync(configFile)) {
    try {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      if (config.apiToken) token = config.apiToken;
      if (config.userId) userId = config.userId;
      if (config.blogId) blogId = config.blogId;
    } catch {}
  }
  return { apiToken: token, userId, blogId };
}

async function resolveMetricoolConfig(uid?: string): Promise<{ apiToken: string; userId?: string; blogId?: string; cookies?: string }> {
  const defaultUid = uid || 'jaharoni';
  try {
    const dispatchUrl = process.env.DISPATCH_INTERNAL_URL || 'http://dispatch:5150';
    const response = await fetch(`${dispatchUrl}/api/integrations/${defaultUid}/metricool`);
    if (response.ok) {
      const data = await response.json() as any;
      if (data && data.credentials) {
        const token = data.credentials.userToken || data.credentials.apiToken || '';
        const userId = data.credentials.userId || data.accountId || '';
        const blogId = data.credentials.blogId || '';
        
        if (token.startsWith('eyJ') || data.credentials.isSession) {
          try {
            const cdpSession = await fetchMetricoolSessionFromCDP();
            return {
              apiToken: cdpSession.token || token,
              userId: cdpSession.userId || userId,
              blogId: cdpSession.blogId || blogId,
              cookies: cdpSession.cookies
            };
          } catch (cdpErr: any) {
            console.warn(`[MCP] Failed to fetch live CDP session for ${defaultUid}, falling back to stored credentials:`, cdpErr.message);
          }
        }
        
        return {
          apiToken: token,
          userId,
          blogId,
        };
      }
    }
  } catch (err: any) {
    console.error(`[MCP] Failed to resolve Metricool config from dispatch for user ${defaultUid}:`, err.message);
  }
  
  const staticConfig = getMetricoolConfig();
  if (staticConfig.apiToken.startsWith('eyJ')) {
    try {
      const cdpSession = await fetchMetricoolSessionFromCDP();
      return {
        apiToken: cdpSession.token || staticConfig.apiToken,
        userId: cdpSession.userId || staticConfig.userId,
        blogId: cdpSession.blogId || staticConfig.blogId,
        cookies: cdpSession.cookies
      };
    } catch (cdpErr: any) {
      console.warn(`[MCP] Failed to fetch live CDP session for static config:`, cdpErr.message);
    }
  }
  return staticConfig;
}

async function metricoolRequest<T>(endpoint: string, method: string = 'GET', body?: any, uid?: string): Promise<T> {
  const config = await resolveMetricoolConfig(uid);
  if (!config.apiToken) {
    throw new Error(`Metricool API token is not configured for user '${uid || 'default'}'. Please define METRICOOL_API_TOKEN or configure it in dispatch.`);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Mc-Auth': config.apiToken,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  if (config.cookies) {
    headers['Cookie'] = config.cookies;
  }

  const response = await fetch(`https://app.metricool.com${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Metricool API Error [${response.status}]: ${errText || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function createMcpServer(): any {
  const server: any = new McpServer({
    name: 'Sovereign MCP Hub',
    version: '2.0.0',
  });

  // ========================
  // SENTINEL TRACK TOOLS
  // ========================

  server.tool(
    'track_list_issues',
    'List all Sentinel Track issues with optional filters',
    {
      status: z.string().optional().describe('Filter by status (BACKLOG, IDEATION, DESIGN, PLAN, SHIP, VALIDATION, DONE)'),
      assignee: z.string().optional().describe('Filter by assignee agent name'),
      type: z.string().optional().describe('Filter by issue type (epic, story, task, bug)'),
    },
    async ({ status, assignee, type }) => {
      let issues = readJSON(ISSUES_FILE);
      if (status) issues = issues.filter((i: any) => i.status === status);
      if (assignee) issues = issues.filter((i: any) => i.assignee === assignee);
      if (type) issues = issues.filter((i: any) => i.type === type);
      return { content: [{ type: 'text', text: JSON.stringify(issues, null, 2) }] };
    }
  );

  server.tool(
    'track_create_issue',
    'Create a new Sentinel Track issue (task, story, epic, or bug)',
    {
      title: z.string().describe('Issue title'),
      description: z.string().optional().describe('Issue description'),
      type: z.enum(['epic', 'story', 'task', 'bug']).describe('Issue type'),
      assignee: z.string().optional().describe('Agent or human assignee'),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('Priority level'),
      tags: z.array(z.string()).optional().describe('Tags for categorization'),
      parent_id: z.string().optional().describe('Parent issue ID for hierarchy'),
    },
    async ({ title, description, type, assignee, priority, tags, parent_id }) => {
      const issues = readJSON(ISSUES_FILE);
      const newIssue = {
        id: `trk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title, description: description || '', type,
        status: 'BACKLOG',
        assignee: assignee || 'unassigned',
        priority: priority || 'medium',
        tags: tags || [],
        parent_id: parent_id || null,
        reporter: 'CORTEX-MCP',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      issues.push(newIssue);
      writeJSON(ISSUES_FILE, issues);
      return { content: [{ type: 'text', text: `Created issue ${newIssue.id}: ${title}` }] };
    }
  );

  server.tool(
    'track_update_issue',
    'Update an existing Sentinel Track issue',
    {
      id: z.string().describe('Issue ID to update'),
      title: z.string().optional(),
      description: z.string().optional(),
      assignee: z.string().optional(),
      priority: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
    async ({ id, ...updates }) => {
      const issues = readJSON(ISSUES_FILE);
      const idx = issues.findIndex((i: any) => i.id === id);
      if (idx === -1) return { content: [{ type: 'text', text: `Error: Issue ${id} not found` }] };
      const clean = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
      issues[idx] = { ...issues[idx], ...clean, updated_at: new Date().toISOString() };
      writeJSON(ISSUES_FILE, issues);
      return { content: [{ type: 'text', text: `Updated issue ${id}` }] };
    }
  );

  server.tool(
    'track_transition_issue',
    'Transition a Sentinel Track issue to a new status',
    {
      id: z.string().describe('Issue ID'),
      to: z.enum(['BACKLOG', 'IDEATION', 'DESIGN', 'PLAN', 'SHIP', 'VALIDATION', 'DONE', 'BLOCKED']).describe('Target status'),
    },
    async ({ id, to }) => {
      const issues = readJSON(ISSUES_FILE);
      const idx = issues.findIndex((i: any) => i.id === id);
      if (idx === -1) return { content: [{ type: 'text', text: `Error: Issue ${id} not found` }] };
      const VALID: Record<string, string[]> = {
        BACKLOG: ['IDEATION'], IDEATION: ['DESIGN', 'BACKLOG'], DESIGN: ['PLAN', 'IDEATION'],
        PLAN: ['SHIP', 'DESIGN'], SHIP: ['VALIDATION', 'PLAN'], VALIDATION: ['DONE', 'SHIP'],
        DONE: [], BLOCKED: ['BACKLOG', 'IDEATION', 'DESIGN', 'PLAN', 'SHIP', 'VALIDATION'],
      };
      const allowed = VALID[issues[idx].status] || [];
      if (!allowed.includes(to)) {
        return { content: [{ type: 'text', text: `Invalid transition: ${issues[idx].status} → ${to}. Allowed: ${allowed.join(', ')}` }] };
      }
      issues[idx] = { ...issues[idx], status: to, updated_at: new Date().toISOString() };
      writeJSON(ISSUES_FILE, issues);
      return { content: [{ type: 'text', text: `Transitioned ${id}: → ${to}` }] };
    }
  );

  server.tool(
    'track_delete_issue',
    'Delete a Sentinel Track issue',
    { id: z.string().describe('Issue ID to delete') },
    async ({ id }) => {
      let issues = readJSON(ISSUES_FILE);
      const idx = issues.findIndex((i: any) => i.id === id);
      if (idx === -1) return { content: [{ type: 'text', text: `Error: Issue ${id} not found` }] };
      issues.splice(idx, 1);
      writeJSON(ISSUES_FILE, issues);
      return { content: [{ type: 'text', text: `Deleted issue ${id}` }] };
    }
  );

  server.tool(
    'track_get_board',
    'Get the full Kanban board with stats',
    {},
    async () => {
      const issues = readJSON(ISSUES_FILE);
      const statuses = ['BACKLOG', 'IDEATION', 'DESIGN', 'PLAN', 'SHIP', 'VALIDATION', 'DONE', 'BLOCKED'];
      const board: Record<string, number> = {};
      for (const s of statuses) board[s] = issues.filter((i: any) => i.status === s).length;
      return { content: [{ type: 'text', text: JSON.stringify({ total: issues.length, by_status: board }, null, 2) }] };
    }
  );

  // ========================
  // SCHOLAR HIVE TOOLS
  // ========================

  server.tool(
    'hive_list_docs',
    'List all Scholar Hive knowledge documents',
    {
      type: z.string().optional().describe('Filter by document type (adr, runbook, postmortem, guide, reference)'),
      q: z.string().optional().describe('Full-text search query'),
    },
    async ({ type, q }) => {
      let docs = readJSON(DOCS_FILE);
      if (type) docs = docs.filter((d: any) => d.document_type === type);
      if (q) {
        const query = q.toLowerCase();
        docs = docs.filter((d: any) => d.title.toLowerCase().includes(query) || d.content?.toLowerCase().includes(query));
      }
      return { content: [{ type: 'text', text: JSON.stringify(docs.map((d: any) => ({ id: d.id, title: d.title, type: d.document_type })), null, 2) }] };
    }
  );

  server.tool(
    'hive_create_doc',
    'Create a new Scholar Hive knowledge document',
    {
      title: z.string().describe('Document title'),
      content: z.string().describe('Document content (markdown)'),
      document_type: z.enum(['adr', 'runbook', 'postmortem', 'guide', 'reference']).describe('Document type'),
      tags: z.array(z.string()).optional().describe('Tags'),
      author: z.string().optional().describe('Author agent or human'),
    },
    async ({ title, content, document_type, tags, author }) => {
      const docs = readJSON(DOCS_FILE);
      const newDoc = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title, content, document_type,
        tags: tags || [],
        author: author || 'CORTEX-MCP',
        vector_reference: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      docs.push(newDoc);
      writeJSON(DOCS_FILE, docs);
      return { content: [{ type: 'text', text: `Created doc ${newDoc.id}: ${title}` }] };
    }
  );

  server.tool(
    'hive_get_doc',
    'Get a specific Scholar Hive document by ID',
    { id: z.string().describe('Document ID') },
    async ({ id }) => {
      const docs = readJSON(DOCS_FILE);
      const doc = docs.find((d: any) => d.id === id);
      if (!doc) return { content: [{ type: 'text', text: `Error: Document ${id} not found` }] };
      return { content: [{ type: 'text', text: JSON.stringify(doc, null, 2) }] };
    }
  );

  server.tool(
    'hive_update_doc',
    'Update a Scholar Hive document',
    {
      id: z.string().describe('Document ID'),
      title: z.string().optional(),
      content: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
    async ({ id, ...updates }) => {
      const docs = readJSON(DOCS_FILE);
      const idx = docs.findIndex((d: any) => d.id === id);
      if (idx === -1) return { content: [{ type: 'text', text: `Error: Document ${id} not found` }] };
      const clean = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
      docs[idx] = { ...docs[idx], ...clean, updated_at: new Date().toISOString() };
      writeJSON(DOCS_FILE, docs);
      return { content: [{ type: 'text', text: `Updated doc ${id}` }] };
    }
  );

  server.tool(
    'hive_delete_doc',
    'Delete a Scholar Hive document',
    { id: z.string().describe('Document ID') },
    async ({ id }) => {
      let docs = readJSON(DOCS_FILE);
      const idx = docs.findIndex((d: any) => d.id === id);
      if (idx === -1) return { content: [{ type: 'text', text: `Error: Document ${id} not found` }] };
      docs.splice(idx, 1);
      writeJSON(DOCS_FILE, docs);
      return { content: [{ type: 'text', text: `Deleted doc ${id}` }] };
    }
  );

  server.tool(
    'hive_semantic_search',
    'Semantic search across Scholar Hive documents using vector similarity',
    {
      query: z.string().describe('Natural language search query'),
      limit: z.number().optional().describe('Max results (default 5)'),
    },
    async ({ query, limit }) => {
      const results = await semanticSearch(query, limit || 5);
      if (results.length === 0) {
        return { content: [{ type: 'text', text: 'No results found (vector store may be empty or unavailable).' }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
  );

  // ========================
  // SYSTEM TOOLS
  // ========================

  server.tool(
    'system_stats',
    'Get system statistics for Sentinel Track and Scholar Hive',
    {},
    async () => {
      const issues = readJSON(ISSUES_FILE);
      const docs = readJSON(DOCS_FILE);
      const stats = {
        sentinel_track: {
          total: issues.length,
          by_status: issues.reduce((a: any, i: any) => { a[i.status] = (a[i.status] || 0) + 1; return a; }, {}),
        },
        scholar_hive: {
          total: docs.length,
          vectorized: docs.filter((d: any) => d.vector_reference).length,
        },
      };
      return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
    }
  );

  // ========================
  // SENSOR MESH TOOLS
  // ========================

  server.tool(
    'sensor_mesh_list_nodes',
    'List all registered sensor nodes (soil moisture, OBD-II vehicles, battery logs)',
    {},
    async () => {
      const sessionDir = path.join(process.cwd(), '..', '..', 'runtime', 'session');
      const venzaPath = path.join(sessionDir, 'venza-state.json');
      const soilPath = path.join(sessionDir, 'soil-mesh-state.json');
      
      const nodes: any[] = [];
      
      // Load Venza
      try {
        if (fs.existsSync(venzaPath)) {
          const venza = JSON.parse(fs.readFileSync(venzaPath, 'utf-8'));
          nodes.push({
            node_id: venza.node_id,
            device_class: venza.device_class,
            hostname: venza.hostname,
            status: venza.mesh_status,
            last_updated: venza.last_updated
          });
        }
      } catch {}
      
      // Load Soil
      try {
        if (fs.existsSync(soilPath)) {
          const soil = JSON.parse(fs.readFileSync(soilPath, 'utf-8'));
          nodes.push(...(soil.nodes || []));
        } else {
          // Initialize default mock soil sensors if they don't exist
          const defaultSoil = {
            nodes: [
              {
                node_id: "soil_sensor_north_garden",
                device_class: "soil_moisture_sensor",
                hostname: "ESP32-Soil-North",
                status: "ONLINE",
                last_updated: new Date().toISOString(),
                telemetry: {
                  moisture_percent: 58.4,
                  temperature_c: 22.1,
                  battery_voltage: 3.28
                }
              },
              {
                node_id: "soil_sensor_south_lawn",
                device_class: "soil_moisture_sensor",
                hostname: "ESP32-Soil-South",
                status: "ONLINE",
                last_updated: new Date().toISOString(),
                telemetry: {
                  moisture_percent: 41.2,
                  temperature_c: 24.5,
                  battery_voltage: 3.12
                }
              }
            ]
          };
          fs.writeFileSync(soilPath, JSON.stringify(defaultSoil, null, 2));
          nodes.push(...defaultSoil.nodes);
        }
      } catch {}
      
      return { content: [{ type: 'text', text: JSON.stringify(nodes, null, 2) }] };
    }
  );

  server.tool(
    'sensor_mesh_get_telemetry',
    'Get telemetry for a specific sensor node by its ID',
    {
      node_id: z.string().describe('ID of the sensor node (e.g. venza_mobility_node, soil_sensor_north_garden)'),
    },
    async ({ node_id }) => {
      const sessionDir = path.join(process.cwd(), '..', '..', 'runtime', 'session');
      const venzaPath = path.join(sessionDir, 'venza-state.json');
      const soilPath = path.join(sessionDir, 'soil-mesh-state.json');
      
      if (node_id === 'venza_mobility_node') {
        try {
          if (fs.existsSync(venzaPath)) {
            const venza = JSON.parse(fs.readFileSync(venzaPath, 'utf-8'));
            return { content: [{ type: 'text', text: JSON.stringify(venza, null, 2) }] };
          }
        } catch {}
      } else {
        try {
          if (fs.existsSync(soilPath)) {
            const soil = JSON.parse(fs.readFileSync(soilPath, 'utf-8'));
            const node = (soil.nodes || []).find((n: any) => n.node_id === node_id);
            if (node) {
              return { content: [{ type: 'text', text: JSON.stringify(node, null, 2) }] };
            }
          }
        } catch {}
      }
      
      return { content: [{ type: 'text', text: `Error: Sensor node '${node_id}' not found.` }] };
    }
  );

  server.tool(
    'sensor_mesh_push_telemetry',
    'Submit telemetry from a pocket edge node or local sensor to the NAS core',
    {
      node_id: z.string().describe('ID of the sensor node submitting telemetry'),
      device_class: z.string().describe('Device classification (e.g. mobile_client, soil_moisture_sensor)'),
      telemetry: z.any().describe('Key-value telemetry payload'),
    },
    async ({ node_id, device_class, telemetry }) => {
      const sessionDir = path.join(process.cwd(), '..', '..', 'runtime', 'session');
      
      if (node_id === 'venza_mobility_node') {
        const venzaPath = path.join(sessionDir, 'venza-state.json');
        try {
          if (fs.existsSync(venzaPath)) {
            const venza = JSON.parse(fs.readFileSync(venzaPath, 'utf-8'));
            venza.telemetry = { ...venza.telemetry, ...telemetry };
            venza.last_updated = new Date().toISOString();
            venza.mesh_status = "CONNECTED";
            fs.writeFileSync(venzaPath, JSON.stringify(venza, null, 2));
            return { content: [{ type: 'text', text: `Telemetry successfully merged into Toyota Venza node.` }] };
          }
        } catch (e: any) {
          return { content: [{ type: 'text', text: `Error merging Venza telemetry: ${e.message}` }] };
        }
      } else {
        const soilPath = path.join(sessionDir, 'soil-mesh-state.json');
        try {
          let soil = { nodes: [] as any[] };
          if (fs.existsSync(soilPath)) {
            soil = JSON.parse(fs.readFileSync(soilPath, 'utf-8'));
          }
          const idx = soil.nodes.findIndex((n: any) => n.node_id === node_id);
          const timestamp = new Date().toISOString();
          if (idx !== -1) {
            soil.nodes[idx].telemetry = { ...soil.nodes[idx].telemetry, ...telemetry };
            soil.nodes[idx].last_updated = timestamp;
            soil.nodes[idx].status = "ONLINE";
          } else {
            soil.nodes.push({
              node_id,
              device_class,
              hostname: node_id,
              status: "ONLINE",
              last_updated: timestamp,
              telemetry
            });
          }
          fs.writeFileSync(soilPath, JSON.stringify(soil, null, 2));
          return { content: [{ type: 'text', text: `Telemetry successfully logged for sensor node '${node_id}'.` }] };
        } catch (e: any) {
          return { content: [{ type: 'text', text: `Error logging telemetry: ${e.message}` }] };
        }
      }
      return { content: [{ type: 'text', text: `Node not processed.` }] };
    }
  );

  // ========================
  // METRICOOL TOOLS
  // ========================

  server.tool(
    'metricool_get_profiles',
    'Retrieve all profiles/brands configured in the Metricool account',
    {
      uid: z.string().optional().describe('Active user UID (defaults to jaharoni)'),
    },
    async ({ uid }) => {
      try {
        const config = await resolveMetricoolConfig(uid);
        const data: any = await metricoolRequest('/api/admin/simpleProfiles', 'GET', undefined, uid);
        
        if (data.userId && (!config.userId || !config.blogId)) {
          try {
            const dispatchUrl = process.env.DISPATCH_INTERNAL_URL || 'http://dispatch:5150';
            const updatedCredentials = {
              userToken: config.apiToken,
              userId: data.userId,
              blogId: config.blogId || (data.profiles && data.profiles[0]?.blogId) || '',
            };
            await fetch(`${dispatchUrl}/api/integrations/${uid || 'jaharoni'}/metricool`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accountId: data.userId,
                credentials: updatedCredentials,
                metadata: {
                  brandName: (data.profiles && data.profiles[0]?.name) || 'Creative Liberation Engine System',
                  channels: ['youtube', 'facebook', 'instagram', 'threads']
                }
              })
            });
          } catch (e: any) {
            console.error('[MCP] Failed to update resolved profiles back to dispatch:', e.message);
          }
        }
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }] };
      }
    }
  );

  server.tool(
    'metricool_schedule_post',
    'Schedule a social post across multiple networks (e.g. twitter, linkedin, facebook, instagram)',
    {
      text: z.string().describe('Body copy of the social media post'),
      dateTime: z.string().describe('Scheduled time (YYYY-MM-DDTHH:mm:ss format, e.g., 2026-06-15T10:00:00)'),
      timezone: z.string().optional().describe('Timezone of scheduling (default: UTC)'),
      networks: z.array(z.string()).describe('Social networks to schedule to (e.g. ["twitter", "linkedin"])'),
      mediaUrls: z.array(z.string()).optional().describe('Optional public image or video URLs to normalize and attach'),
      uid: z.string().optional().describe('Active user UID (defaults to jaharoni)'),
    },
    async ({ text, dateTime, timezone, networks, mediaUrls, uid }) => {
      try {
        const config = await resolveMetricoolConfig(uid);
        let uId = config.userId;
        let bId = config.blogId;

        if (!uId || !bId) {
          const data: any = await metricoolRequest('/api/admin/simpleProfiles', 'GET', undefined, uid);
          uId = data.userId;
          bId = bId || (data.profiles && data.profiles[0]?.blogId);
          if (!uId || !bId) {
            throw new Error('Could not automatically resolve userId or blogId.');
          }
        }

        let processedUrls: string[] = [];
        if (mediaUrls && mediaUrls.length > 0) {
          processedUrls = await Promise.all(
            mediaUrls.map(async (url) => {
              const params = new URLSearchParams({
                userId: uId!,
                blogId: bId!,
                url,
              });
              const data: any = await metricoolRequest(`/api/actions/normalize/image/url?${params.toString()}`, 'GET', undefined, uid);
              return data.url;
            })
          );
        }

        const payload = {
          userId: uId,
          blogId: bId,
          publicationDate: {
            dateTime,
            timezone: timezone || 'UTC',
          },
          text,
          providers: networks.map((network) => ({ network })),
          ...(processedUrls.length > 0 ? { mediaUrls: processedUrls } : {}),
        };

        const result = await metricoolRequest('/api/v2/scheduler/posts', 'POST', payload, uid);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }] };
      }
    }
  );

  server.tool(
    'metricool_get_analytics',
    'Fetch analytics statistics for a specific social network channel',
    {
      network: z.enum(['twitter', 'facebook', 'linkedin', 'instagram', 'tiktok', 'youtube', 'pinterest']).describe('Target network stats'),
      fromDate: z.string().describe('Start date (YYYY-MM-DD)'),
      toDate: z.string().describe('End date (YYYY-MM-DD)'),
      uid: z.string().optional().describe('Active user UID (defaults to jaharoni)'),
    },
    async ({ network, fromDate, toDate, uid }) => {
      try {
        const config = await resolveMetricoolConfig(uid);
        const uId = config.userId;
        const bId = config.blogId;

        if (!uId || !bId) {
          throw new Error('userId and blogId are required. Please run metricool_get_profiles first to auto-resolve and register them.');
        }

        const params = new URLSearchParams({
          userId: uId,
          blogId: bId,
          from: fromDate,
          to: toDate,
        });

        const data = await metricoolRequest(`/api/v2/analytics/${network}/stats?${params.toString()}`, 'GET', undefined, uid);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }] };
      }
    }
  );

  // ========================
  // SOVEREIGN HOME TOOLS
  // ========================

  server.tool(
    'sovereign_home_get_state',
    'Get current state of home automation devices (lights, switches, thermostats)',
    {
      entity_id: z.string().optional().describe('Optional entity ID to filter by (e.g. light.living_room_overhead)'),
    },
    async ({ entity_id }) => {
      const sessionDir = path.join(ROOT_DIR, 'runtime', 'session');
      const homePath = path.join(sessionDir, 'home-mesh-state.json');
      
      let homeState = {
        entities: [
          { entity_id: "light.living_room_overhead", state: "off", attributes: { brightness: null, friendly_name: "Living Room Overhead" } },
          { entity_id: "light.studio_ambient", state: "on", attributes: { brightness: 180, friendly_name: "Studio Ambient" } },
          { entity_id: "switch.sprinkler_pump", state: "off", attributes: { friendly_name: "Sprinkler Pump" } },
          { entity_id: "climate.main_house", state: "cool", attributes: { temperature: 72, current_temperature: 73, friendly_name: "Main Thermostat" } }
        ]
      };
      
      try {
        if (fs.existsSync(homePath)) {
          homeState = JSON.parse(fs.readFileSync(homePath, 'utf-8'));
        } else {
          fs.writeFileSync(homePath, JSON.stringify(homeState, null, 2));
        }
      } catch {}
      
      if (entity_id) {
        const entity = homeState.entities.find((e: any) => e.entity_id === entity_id);
        if (entity) {
          return { content: [{ type: 'text', text: JSON.stringify(entity, null, 2) }] };
        }
        return { content: [{ type: 'text', text: `Error: Entity '${entity_id}' not found.` }] };
      }
      
      return { content: [{ type: 'text', text: JSON.stringify(homeState.entities, null, 2) }] };
    }
  );

  server.tool(
    'sovereign_home_set_state',
    'Change the state of a home automation entity (turn light on/off, set temperature)',
    {
      entity_id: z.string().describe('Entity ID of the home device'),
      state: z.string().describe('Target state (e.g. on, off, cool, heat)'),
      attributes: z.any().optional().describe('Optional key-value attribute changes (e.g. brightness, temperature)'),
    },
    async ({ entity_id, state, attributes }) => {
      const sessionDir = path.join(ROOT_DIR, 'runtime', 'session');
      const homePath = path.join(sessionDir, 'home-mesh-state.json');
      
      let homeState = {
        entities: [
          { entity_id: "light.living_room_overhead", state: "off", attributes: { brightness: null, friendly_name: "Living Room Overhead" } },
          { entity_id: "light.studio_ambient", state: "on", attributes: { brightness: 180, friendly_name: "Studio Ambient" } },
          { entity_id: "switch.sprinkler_pump", state: "off", attributes: { friendly_name: "Sprinkler Pump" } },
          { entity_id: "climate.main_house", state: "cool", attributes: { temperature: 72, current_temperature: 73, friendly_name: "Main Thermostat" } }
        ]
      };
      
      try {
        if (fs.existsSync(homePath)) {
          homeState = JSON.parse(fs.readFileSync(homePath, 'utf-8'));
        }
      } catch {}
      
      const idx = homeState.entities.findIndex((e: any) => e.entity_id === entity_id);
      if (idx !== -1) {
        homeState.entities[idx].state = state;
        if (attributes) {
          homeState.entities[idx].attributes = { ...homeState.entities[idx].attributes, ...attributes };
        }
        try {
          fs.writeFileSync(homePath, JSON.stringify(homeState, null, 2));
        } catch {}
        return { content: [{ type: 'text', text: `Successfully updated entity '${entity_id}' state to '${state}'.` }] };
      }
      
      return { content: [{ type: 'text', text: `Error: Entity '${entity_id}' not found.` }] };
    }
  );

  return server;
}

// SSE transport bindings for Express
export function mountMcpSSE(app: express.Application): void {
  const server = createMcpServer();
  const transports: Map<string, SSEServerTransport> = new Map();

  app.get('/mcp/sse', async (req: Request, res: Response) => {
    const transport = new SSEServerTransport('/mcp/messages', res);
    transports.set(transport.sessionId, transport);
    res.on('close', () => transports.delete(transport.sessionId));
    await server.connect(transport);
  });

  app.post('/mcp/messages', async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);
    if (!transport) return res.status(404).json({ error: 'Session not found' });
    await transport.handlePostMessage(req, res);
  });

  console.log('[MCP] SSE transport mounted at /mcp/sse');
}

export function runMcpStdio(): void {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  server.connect(transport).then(() => {
    console.error('[MCP Hub] Running in stdio mode');
  }).catch(console.error);
}
