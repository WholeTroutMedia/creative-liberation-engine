import http from 'http';
import url from 'url';
import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';

const PORT = process.env.PORT || 3000;
const HOST_MCP_URL = process.env.HOST_MCP_URL || 'http://192.168.2.25:8000';

// Check if we have credentials to run the Google Workspace MCP server natively on the NAS
const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET;
const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
const useLocalWorkspace = !!(clientId && clientSecret && refreshToken);

console.log('='.repeat(60));
console.log('[Google Workspace Bridge] Starting up...');
console.log(`[Google Workspace Bridge] Credentials Check: clientId=${clientId ? 'configured' : 'missing'}, clientSecret=${clientSecret ? 'configured' : 'missing'}, refreshToken=${refreshToken ? 'configured' : 'missing'}`);
console.log(`[Google Workspace Bridge] Mode: ${useLocalWorkspace ? 'NATIVE GOOGLE WORKSPACE MCP SERVER' : 'WORKSTATION PROXY FALLBACK'}`);
console.log('='.repeat(60));

if (useLocalWorkspace) {
  // ─── NATIVE GOOGLE WORKSPACE MCP SERVER MODE ────────────────────────────────
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Setup OAuth client
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  // Initialize APIs
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Define MCP Server
  const mcpServer = new McpServer({
    name: 'Sovereign Google Workspace MCP Server',
    version: '1.0.0',
  });

  // ─── GOOGLE DRIVE TOOLS ──────────────────────────────────────────────────────
  
  mcpServer.tool(
    'drive_search_files',
    'List or search files in Google Drive.',
    {
      query: z.string().optional().describe('Search query matching Google Drive v3 api filter (e.g. "name contains \'brief\'" or "mimeType = \'application/vnd.google-apps.document\'")'),
      limit: z.number().optional().default(10).describe('Maximum number of files to return')
    },
    async ({ query, limit }) => {
      try {
        const response = await drive.files.list({
          q: query,
          pageSize: limit,
          fields: 'files(id, name, mimeType, description, webViewLink)'
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data.files || [], null, 2) }]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Google Drive API Error: ${err.message}` }]
        };
      }
    }
  );

  mcpServer.tool(
    'drive_read_file',
    'Read the plain text content of a file in Google Drive. Google Docs are exported as plain text automatically.',
    {
      fileId: z.string().describe('The unique Google Drive File ID')
    },
    async ({ fileId }) => {
      try {
        const metadata = await drive.files.get({
          fileId,
          fields: 'id, name, mimeType'
        });
        
        let content = '';
        if (metadata.data.mimeType === 'application/vnd.google-apps.document') {
          // Google Doc: export as plain text
          const exportResponse = await drive.files.export({
            fileId,
            mimeType: 'text/plain'
          });
          content = exportResponse.data;
        } else if (metadata.data.mimeType.startsWith('text/') || metadata.data.mimeType === 'application/json' || metadata.data.mimeType.includes('javascript') || metadata.data.mimeType.includes('typescript')) {
          // Normal text files: fetch as media
          const fileResponse = await drive.files.get({
            fileId,
            alt: 'media'
          }, { responseType: 'text' });
          content = fileResponse.data;
        } else {
          content = `[File format ${metadata.data.mimeType} is binary or unsupported. Previewing is not supported.]`;
        }

        const result = `File Name: ${metadata.data.name}\nMIME Type: ${metadata.data.mimeType}\n\nContent:\n${content}`;
        return {
          content: [{ type: 'text', text: result }]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Google Drive API Error: ${err.message}` }]
        };
      }
    }
  );

  mcpServer.tool(
    'drive_create_file',
    'Create or upload a file in Google Drive.',
    {
      name: z.string().describe('The name of the file to create'),
      content: z.string().describe('Plaintext or string content to write to the file'),
      mimeType: z.string().optional().default('text/plain').describe('The file MIME type (e.g. "text/plain", "text/markdown", "application/json")'),
      folderId: z.string().optional().describe('Parent folder ID where the file should be created')
    },
    async ({ name, content, mimeType, folderId }) => {
      try {
        const fileMetadata = { name, mimeType };
        if (folderId) {
          fileMetadata.parents = [folderId];
        }
        
        const media = {
          mimeType,
          body: content
        };

        const response = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id, name, mimeType, webViewLink'
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Google Drive API Error: ${err.message}` }]
        };
      }
    }
  );

  // ─── GOOGLE CALENDAR TOOLS ──────────────────────────────────────────────────
  
  mcpServer.tool(
    'calendar_list_events',
    'List events on the user\'s primary calendar.',
    {
      timeMin: z.string().optional().describe('ISO-8601 start time (e.g., "2026-06-04T00:00:00Z"). Defaults to current time.'),
      timeMax: z.string().optional().describe('ISO-8601 end time (e.g., "2026-06-05T00:00:00Z").'),
      limit: z.number().optional().default(10).describe('Maximum number of calendar events to return')
    },
    async ({ timeMin, timeMax, limit }) => {
      try {
        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin: timeMin || new Date().toISOString(),
          timeMax: timeMax,
          maxResults: limit,
          singleEvents: true,
          orderBy: 'startTime'
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(response.data.items || [], null, 2) }]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Google Calendar API Error: ${err.message}` }]
        };
      }
    }
  );

  mcpServer.tool(
    'calendar_create_event',
    'Create an event on the user\'s primary calendar.',
    {
      summary: z.string().describe('Summary/title of the calendar event'),
      startTime: z.string().describe('ISO-8601 start time with timezone (e.g. "2026-06-04T15:00:00-04:00")'),
      endTime: z.string().describe('ISO-8601 end time with timezone (e.g. "2026-06-04T16:00:00-04:00")'),
      description: z.string().optional().describe('Description of the event'),
      attendees: z.array(z.string()).optional().describe('List of attendee email addresses')
    },
    async ({ summary, startTime, endTime, description, attendees }) => {
      try {
        const event = {
          summary,
          description,
          start: { dateTime: startTime },
          end: { dateTime: endTime }
        };
        if (attendees) {
          event.attendees = attendees.map(email => ({ email }));
        }

        const response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: event
        });

        return {
          content: [{ type: 'text', text: `Event created successfully. Event Link: ${response.data.htmlLink}` }]
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Google Calendar API Error: ${err.message}` }]
        };
      }
    }
  );

  // ─── SSE MOUNTING ──────────────────────────────────────────────────────────
  
  const transports = new Map();

  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', mode: 'native-mcp', port: PORT });
  });

  app.get('/mcp/sse', async (req, res) => {
    console.log('[Native MCP] New client connected via SSE');
    const transport = new SSEServerTransport('/mcp/messages', res);
    transports.set(transport.sessionId, transport);
    
    res.on('close', () => {
      console.log(`[Native MCP] Connection closed for session ${transport.sessionId}`);
      transports.delete(transport.sessionId);
    });

    await mcpServer.connect(transport);
  });

  app.post('/mcp/messages', async (req, res) => {
    const sessionId = req.query.sessionId;
    const transport = transports.get(sessionId);
    if (!transport) {
      return res.status(404).json({ error: 'Session not found' });
    }
    await transport.handlePostMessage(req, res);
  });

  // ─── NATIVE REMOTE SERVICES PROXY MOUNTING ──────────────────────────────────
  
  const serviceTransports = {
    drive: new Map(),
    calendar: new Map(),
    gmail: new Map(),
    stitch: new Map()
  };

  app.get('/mcp/:service/sse', (req, res) => {
    const service = req.params.service;
    if (!['drive', 'calendar', 'gmail', 'stitch'].includes(service)) {
      return res.status(400).json({ error: 'Invalid service. Must be drive, calendar, gmail, or stitch.' });
    }

    const sessionId = Math.random().toString(36).substring(2, 15);
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    res.write(`event: endpoint\ndata: /mcp/${service}/messages?sessionId=${sessionId}\n\n`);
    
    serviceTransports[service].set(sessionId, res);

    console.log(`[Google Workspace Bridge] Native remote MCP client connected to ${service} via SSE, sessionId=${sessionId}`);

    req.on('close', () => {
      console.log(`[Google Workspace Bridge] Native remote MCP connection closed for ${service}, sessionId=${sessionId}`);
      serviceTransports[service].delete(sessionId);
    });
  });

  app.post('/mcp/:service/messages', async (req, res) => {
    const service = req.params.service;
    const sessionId = req.query.sessionId;
    
    if (!['drive', 'calendar', 'gmail', 'stitch'].includes(service)) {
      return res.status(400).json({ error: 'Invalid service' });
    }

    const clientStream = serviceTransports[service].get(sessionId);
    if (!clientStream) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const msg = req.body;
    const method = msg.method;

    if (!method) {
      return res.status(400).json({ error: 'Missing JSON-RPC method' });
    }

    try {
      // Refresh and obtain current Google OAuth access token
      const tokenResponse = await oauth2Client.getAccessToken();
      const accessToken = tokenResponse.token;

      if (!accessToken) {
        throw new Error('Failed to retrieve active Google OAuth access token');
      }

      const serviceDomain = service === 'stitch' ? 'stitch.withgoogle.com' : `${service}mcp.googleapis.com`;
      const googleEndpoint = `https://${serviceDomain}/mcp/v1`;

      console.log(`[Google Workspace Bridge] Proxying native remote MCP [${method}] -> ${googleEndpoint}`);

      // Call Google's hosted Streamable HTTP endpoint
      const response = await fetch(googleEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(msg)
      });

      const responseBodyText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseBodyText);
      } catch (parseErr) {
        throw new Error(`Invalid JSON-RPC response from Google [${response.status}]: ${responseBodyText}`);
      }

      // Forward response to local client via stateful SSE
      clientStream.write(`event: message\ndata: ${JSON.stringify(responseData)}\n\n`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'sent' }));

    } catch (err) {
      console.error(`[Google Workspace Bridge] Proxy error on [${method}]:`, err.message);
      
      const rpcError = {
        jsonrpc: '2.0',
        id: msg.id || null,
        error: {
          code: -32603,
          message: `Internal Workspace Bridge proxy error: ${err.message}`
        }
      };
      clientStream.write(`event: message\ndata: ${JSON.stringify(rpcError)}\n\n`);

      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  // Backward compatibility with generic MCP routes (proxy style endpoint mapping)
  app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/sse') {
      return res.redirect('/mcp/sse');
    }
    next();
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Google Workspace Bridge] Running natively on http://0.0.0.0:${PORT}`);
  });

} else {
  // ─── WORKSTATION PROXY FALLBACK MODE ────────────────────────────────────────
  console.log(`[Google Workspace Bridge] Missing GMAIL credentials. Proxying all requests to workstation at ${HOST_MCP_URL}`);
  
  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url);
    const path = parsedUrl.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (path === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', mode: 'proxy', upstream: HOST_MCP_URL }));
      return;
    }

    const targetParsed = url.parse(HOST_MCP_URL);
    const options = {
      hostname: targetParsed.hostname,
      port: targetParsed.port || (targetParsed.protocol === 'https:' ? 443 : 80),
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: targetParsed.host
      }
    };

    console.log(`[Google Workspace Bridge] Proxying ${req.method} ${path} -> ${HOST_MCP_URL}${req.url}`);

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`[Google Workspace Bridge] Proxy error forwarding to ${HOST_MCP_URL}:`, err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Gateway', details: err.message }));
    });

    req.pipe(proxyReq);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Google Workspace Bridge] Proxy bridge listening on http://0.0.0.0:${PORT}`);
  });
}
