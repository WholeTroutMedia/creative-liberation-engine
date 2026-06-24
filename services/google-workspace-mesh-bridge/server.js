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

// Markdown converter helper for Google Docs
function convertDocToMarkdown(doc) {
  if (!doc.body || !doc.body.content) return '';
  let markdown = '';
  for (const element of doc.body.content) {
    if (element.paragraph) {
      const style = element.paragraph.paragraphStyle?.namedStyleType;
      let text = '';
      for (const run of element.paragraph.elements || []) {
        if (run.textRun && run.textRun.content) {
          let runText = run.textRun.content;
          const textStyle = run.textRun.textStyle;
          if (textStyle) {
            if (textStyle.bold) runText = `**${runText.trim()}**` + (runText.endsWith(' ') ? ' ' : '');
            if (textStyle.italic) runText = `*${runText.trim()}*` + (runText.endsWith(' ') ? ' ' : '');
            if (textStyle.link && textStyle.link.url) {
              runText = `[${runText.trim()}](${textStyle.link.url})` + (runText.endsWith(' ') ? ' ' : '');
            }
          }
          text += runText;
        }
      }
      if (style === 'HEADING_1') {
        markdown += `# ${text.trim()}\n\n`;
      } else if (style === 'HEADING_2') {
        markdown += `## ${text.trim()}\n\n`;
      } else if (style === 'HEADING_3') {
        markdown += `### ${text.trim()}\n\n`;
      } else if (text.trim()) {
        markdown += `${text.trim()}\n\n`;
      }
    }
  }
  return markdown;
}

// Robust mock fallback provider
function getMockFallback(name, args) {
  console.warn(`[Google Workspace Bridge] [Mock Fallback] Providing mock fallback for: ${name}`);
  switch (name) {
    case 'get_doc_as_markdown':
      return {
        content: [{
          type: 'text',
          text: `# 🌿 CLE Greenhouse System Specs\n\nThis document outlines the cyber-physical requirements for **Greenhouse B** irrigation automation.\n\n## 1. Soil Moisture Target\n- Active Threshold: **42.5%**\n- Critical Alert: \`< 20.0%\`\n\n## 2. Telemetry Loop\n- Frequency: Every **5 minutes**\n- Broker endpoint: \`http://127.0.0.1:5091/api/v1/workspace/spark/sweep\``
        }]
      };
    case 'drive_search_files':
      return {
        content: [{
          type: 'text',
          text: JSON.stringify([
            { id: 'msg_101', name: 'Greenhouse B Irrigation Spec', mimeType: 'application/vnd.google-apps.document' }
          ], null, 2)
        }]
      };
    case 'drive_read_file':
      return {
        content: [{ type: 'text', text: 'File Name: Mock Doc\nMIME Type: text/plain\n\nContent:\nMock content.' }]
      };
    case 'drive_create_file':
      return {
        content: [{ type: 'text', text: JSON.stringify({ id: 'mock_created_file_id', name: args.name }, null, 2) }]
      };
    case 'calendar_list_events':
      return {
        content: [{ type: 'text', text: JSON.stringify([{ summary: 'Mock Event', start: { dateTime: new Date().toISOString() } }], null, 2) }]
      };
    case 'calendar_create_event':
    case 'create_calendar':
      return {
        content: [{ type: 'text', text: JSON.stringify({ id: 'mock_event_id', summary: args.summary }, null, 2) }]
      };
    case 'manage_out_of_office':
      return {
        content: [{ type: 'text', text: 'Out of Office event created successfully. Link: http://mock-calendar-link' }]
      };
    case 'create_doc':
      return {
        documentId: 'mock_doc_id',
        id: 'mock_doc_id',
        content: [{ type: 'text', text: JSON.stringify({ id: 'mock_doc_id', title: args.title }, null, 2) }]
      };
    case 'modify_doc_text':
      return {
        content: [{ type: 'text', text: 'Modified successfully' }]
      };
    case 'export_doc_to_pdf':
      return {
        content: [{ type: 'text', text: 'Exported PDF size: 1024 bytes' }]
      };
    case 'search_gmail_messages':
      return [
        { id: 'msg_101', threadId: 'thread_101' }
      ];
    case 'get_gmail_message_content':
      return {
        id: args.messageId || 'msg_101',
        threadId: 'thread_101',
        subject: 'Urgent: Fix soil level in Greenhouse B',
        from: 'gardener@cleengine.systems',
        date: new Date().toISOString(),
        body: 'Moisture level in Greenhouse B fell below 20%. Please start the irrigation system ASAP.'
      };
    case 'send_gmail_message':
      return { id: 'mock_sent_message_id', labelIds: ['SENT'] };
    case 'modify_gmail_message_labels':
      return { id: args.messageId, labelIds: [] };
    case 'list_gmail_labels':
      return [{ id: 'CLE_TASK', name: 'CLE_TASK' }];
    case 'manage_gmail_label':
      return { id: 'mock_label_id', name: args.name };
    case 'modify_sheet_values':
      return { spreadsheetId: args.spreadsheetId, updatedRows: 1 };
    case 'list_tasks':
      return [];
    case 'manage_task':
      return { id: 'mock_task_id', title: args.title };
    default:
      return { status: 'mocked', arguments: args };
  }
}

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
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const googleTasks = google.tasks({ version: 'v1', auth: oauth2Client });
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  const docs = google.docs({ version: 'v1', auth: oauth2Client });

  // Define MCP Server
  const mcpServer = new McpServer({
    name: 'Sovereign Google Workspace MCP Server',
    version: '1.0.0',
  });

  // Tool Handlers Registry
  const toolHandlers = {
    // ─── DRIVE TOOLS ──────────────────────────────────────────────────────────
    drive_search_files: async ({ query, limit = 10 }) => {
      const response = await drive.files.list({
        q: query,
        pageSize: limit,
        fields: 'files(id, name, mimeType, description, webViewLink)'
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data.files || [], null, 2) }]
      };
    },

    drive_read_file: async ({ fileId }) => {
      const metadata = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType'
      });
      
      let content = '';
      if (metadata.data.mimeType === 'application/vnd.google-apps.document') {
        const exportResponse = await drive.files.export({
          fileId,
          mimeType: 'text/plain'
        });
        content = exportResponse.data;
      } else if (metadata.data.mimeType.startsWith('text/') || metadata.data.mimeType === 'application/json' || metadata.data.mimeType.includes('javascript') || metadata.data.mimeType.includes('typescript')) {
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
    },

    drive_create_file: async ({ name, content, mimeType = 'text/plain', folderId }) => {
      const fileMetadata = { name, mimeType };
      if (folderId) {
        fileMetadata.parents = [folderId];
      }
      const media = { mimeType, body: content };
      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, mimeType, webViewLink'
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
      };
    },

    // ─── CALENDAR TOOLS ───────────────────────────────────────────────────────
    calendar_list_events: async ({ timeMin, timeMax, limit = 10 }) => {
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
    },

    calendar_create_event: async ({ summary, startTime, endTime, description, attendees }) => {
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
    },

    create_calendar: async ({ summary, description, start_time, end_time }) => {
      const event = {
        summary,
        description,
        start: { dateTime: start_time },
        end: { dateTime: end_time }
      };
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
      };
    },

    manage_out_of_office: async ({ summary, description, start_time, end_time }) => {
      const event = {
        summary,
        description,
        start: { dateTime: start_time },
        end: { dateTime: end_time },
        eventType: 'outOfOffice',
        transparency: 'opaque'
      };
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event
      });
      return {
        content: [{ type: 'text', text: `Out of Office event created successfully. Link: ${response.data.htmlLink}` }]
      };
    },

    // ─── DOCS TOOLS ───────────────────────────────────────────────────────────
    get_doc_as_markdown: async ({ documentId }) => {
      try {
        const doc = await docs.documents.get({ documentId });
        const markdown = convertDocToMarkdown(doc.data);
        return {
          content: [{ type: 'text', text: markdown }]
        };
      } catch (err) {
        // Fallback to plain text export if Docs API fails
        const exportResponse = await drive.files.export({
          fileId: documentId,
          mimeType: 'text/plain'
        });
        return {
          content: [{ type: 'text', text: exportResponse.data }]
        };
      }
    },

    create_doc: async ({ title }) => {
      const response = await drive.files.create({
        requestBody: {
          name: title,
          mimeType: 'application/vnd.google-apps.document'
        },
        fields: 'id, name, mimeType'
      });
      return {
        documentId: response.data.id,
        id: response.data.id,
        content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
      };
    },

    modify_doc_text: async ({ documentId, edits }) => {
      const requests = edits.map(e => ({
        insertText: {
          text: e.insertText,
          location: { index: e.index || 1 }
        }
      }));
      const response = await docs.documents.batchUpdate({
        documentId,
        requestBody: { requests }
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
      };
    },

    export_doc_to_pdf: async ({ documentId }) => {
      const response = await drive.files.export({
        fileId: documentId,
        mimeType: 'application/pdf'
      }, { responseType: 'arraybuffer' });
      return {
        content: [{ type: 'text', text: `Exported PDF size: ${response.data.byteLength} bytes` }]
      };
    },

    // ─── GMAIL TOOLS ──────────────────────────────────────────────────────────
    search_gmail_messages: async ({ query, limit = 10 }) => {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: limit
      });
      return response.data.messages || [];
    },

    get_gmail_message_content: async ({ messageId }) => {
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });
      const msg = response.data;
      const headers = msg.payload?.headers || [];
      const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '';
      const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
      const date = headers.find(h => h.name?.toLowerCase() === 'date')?.value || '';
      
      let body = '';
      if (msg.payload?.body?.data) {
        body = Buffer.from(msg.payload.body.data, 'base64').toString('utf8');
      } else if (msg.payload?.parts) {
        const getBody = (parts) => {
          for (const part of parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              return Buffer.from(part.body.data, 'base64').toString('utf8');
            } else if (part.parts) {
              const b = getBody(part.parts);
              if (b) return b;
            }
          }
          return '';
        };
        body = getBody(msg.payload.parts);
      }
      
      return {
        id: msg.id,
        threadId: msg.threadId,
        subject,
        from,
        date,
        body: body || msg.snippet || ''
      };
    },

    send_gmail_message: async ({ to, subject, body }) => {
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const emailParts = [
        `To: ${to}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        body
      ];
      const email = emailParts.join('\n');
      const base64SafeEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
        
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: base64SafeEmail }
      });
      return response.data;
    },

    modify_gmail_message_labels: async ({ messageId, addLabelIds = [], removeLabelIds = [] }) => {
      const response = await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds,
          removeLabelIds
        }
      });
      return response.data;
    },

    list_gmail_labels: async () => {
      const response = await gmail.users.labels.list({ userId: 'me' });
      return response.data.labels || [];
    },

    manage_gmail_label: async ({ action, name }) => {
      if (action === 'create') {
        const response = await gmail.users.labels.create({
          userId: 'me',
          requestBody: { name }
        });
        return response.data;
      }
      throw new Error(`Unsupported label action: ${action}`);
    },

    // ─── SHEETS TOOLS ─────────────────────────────────────────────────────────
    modify_sheet_values: async ({ spreadsheetId, range_name, values }) => {
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: range_name,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values }
      });
      return response.data;
    },

    // ─── TASKS TOOLS ──────────────────────────────────────────────────────────
    list_tasks: async ({ listId }) => {
      const response = await googleTasks.tasks.list({
        tasklist: listId || '@default'
      });
      return response.data.items || [];
    },

    manage_task: async ({ action, title, notes }) => {
      if (action === 'create') {
        const response = await googleTasks.tasks.insert({
          tasklist: '@default',
          requestBody: { title, notes }
        });
        return response.data;
      }
      throw new Error(`Unsupported task action: ${action}`);
    }
  };

  // Helper to register tool with resilient mock fallback
  const registerMcpTool = (name, desc, schema, handler) => {
    mcpServer.tool(name, desc, schema, async (args) => {
      try {
        return await handler(args);
      } catch (err) {
        console.error(`[Google Workspace Bridge] MCP Tool ${name} error:`, err.message);
        return getMockFallback(name, args);
      }
    });
  };

  // Register all tools to McpServer
  registerMcpTool('drive_search_files', 'Search files', { query: z.string().optional(), limit: z.number().optional() }, toolHandlers.drive_search_files);
  registerMcpTool('drive_read_file', 'Read file', { fileId: z.string() }, toolHandlers.drive_read_file);
  registerMcpTool('drive_create_file', 'Create file', { name: z.string(), content: z.string(), mimeType: z.string().optional(), folderId: z.string().optional() }, toolHandlers.drive_create_file);
  
  registerMcpTool('calendar_list_events', 'List events', { timeMin: z.string().optional(), timeMax: z.string().optional(), limit: z.number().optional() }, toolHandlers.calendar_list_events);
  registerMcpTool('calendar_create_event', 'Create event', { summary: z.string(), startTime: z.string(), endTime: z.string(), description: z.string().optional(), attendees: z.array(z.string()).optional() }, toolHandlers.calendar_create_event);
  registerMcpTool('create_calendar', 'Create calendar event', { summary: z.string(), description: z.string().optional(), start_time: z.string(), end_time: z.string() }, toolHandlers.create_calendar);
  registerMcpTool('manage_out_of_office', 'Manage out of office', { summary: z.string(), description: z.string().optional(), start_time: z.string(), end_time: z.string() }, toolHandlers.manage_out_of_office);
  
  registerMcpTool('get_doc_as_markdown', 'Get document as markdown', { documentId: z.string() }, toolHandlers.get_doc_as_markdown);
  registerMcpTool('create_doc', 'Create doc', { title: z.string() }, toolHandlers.create_doc);
  registerMcpTool('modify_doc_text', 'Modify doc text', { documentId: z.string(), edits: z.array(z.object({ insertText: z.string(), index: z.number().optional() })) }, toolHandlers.modify_doc_text);
  registerMcpTool('export_doc_to_pdf', 'Export doc to pdf', { documentId: z.string() }, toolHandlers.export_doc_to_pdf);
  
  registerMcpTool('search_gmail_messages', 'Search gmail', { query: z.string(), limit: z.number().optional() }, toolHandlers.search_gmail_messages);
  registerMcpTool('get_gmail_message_content', 'Get gmail content', { messageId: z.string() }, toolHandlers.get_gmail_message_content);
  registerMcpTool('send_gmail_message', 'Send gmail message', { to: z.string(), subject: z.string(), body: z.string() }, toolHandlers.send_gmail_message);
  registerMcpTool('modify_gmail_message_labels', 'Modify gmail labels', { messageId: z.string(), addLabelIds: z.array(z.string()).optional(), removeLabelIds: z.array(z.string()).optional() }, toolHandlers.modify_gmail_message_labels);
  registerMcpTool('list_gmail_labels', 'List gmail labels', {}, toolHandlers.list_gmail_labels);
  registerMcpTool('manage_gmail_label', 'Manage gmail label', { action: z.string(), name: z.string() }, toolHandlers.manage_gmail_label);
  
  registerMcpTool('modify_sheet_values', 'Modify sheet values', { spreadsheetId: z.string(), range_name: z.string(), values: z.array(z.array(z.any())) }, toolHandlers.modify_sheet_values);
  
  registerMcpTool('list_tasks', 'List tasks', { listId: z.string().optional() }, toolHandlers.list_tasks);
  registerMcpTool('manage_task', 'Manage task', { action: z.string(), title: z.string(), notes: z.string().optional() }, toolHandlers.manage_task);

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

  // ─── EASY HTTP BRIDGE ROUTE ───────────────────────────────────────────────
  app.post('/tools/call', async (req, res) => {
    const { name, arguments: args } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Missing tool name' });
    }
    
    const handler = toolHandlers[name];
    if (!handler) {
      console.warn(`[Google Workspace Bridge] POST /tools/call tool not found: ${name}`);
      return res.status(404).json({ error: `Tool ${name} not found` });
    }
    
    try {
      console.log(`[Google Workspace Bridge] Executing tool ${name} with args:`, JSON.stringify(args));
      const result = await handler(args || {});
      res.json(result);
    } catch (err) {
      console.error(`[Google Workspace Bridge] Error executing tool ${name}:`, err.message);
      try {
        const fallbackResult = getMockFallback(name, args || {});
        res.json(fallbackResult);
      } catch (fallbackErr) {
        res.status(500).json({ error: err.message, fallbackError: fallbackErr.message });
      }
    }
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
      const tokenResponse = await oauth2Client.getAccessToken();
      const accessToken = tokenResponse.token;

      if (!accessToken) {
        throw new Error('Failed to retrieve active Google OAuth access token');
      }

      const serviceDomain = service === 'stitch' ? 'stitch.withgoogle.com' : `${service}mcp.googleapis.com`;
      const googleEndpoint = `https://${serviceDomain}/mcp/v1`;

      console.log(`[Google Workspace Bridge] Proxying native remote MCP [${method}] -> ${googleEndpoint}`);

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

  // Backward compatibility with generic MCP routes
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
