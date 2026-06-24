import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
// @ts-ignore
import { WebSocketServer } from 'ws';

export class SovereignGateway {
  private mcpServer: Server;
  private wss: any = null;
  private connectedClients: Set<any> = new Set();

  constructor() {
    this.mcpServer = new Server(
      {
        name: 'SovereignGateway',
        version: '1.0.0-genesis',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.registerTools();
  }

  private registerTools() {
    // Register tool to push new tasks
    this.mcpServer.setRequestHandler(
      // Note: We use dynamic string check as in standard SDK setup
      { method: 'tools/list' as any },
      async () => ({
        tools: [
          {
            name: 'dispatch_task',
            description: 'Dispatches a new task into the orchestratord queue.',
            inputSchema: {
              type: 'object',
              properties: {
                taskName: { type: 'string' },
                payload: { type: 'object' },
              },
              required: ['taskName', 'payload'],
            },
          },
          {
            name: 'query_memd',
            description: 'Queries the offline memd vector index database.',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
              },
              required: ['query'],
            },
          },
        ],
      })
    );

    this.mcpServer.setRequestHandler(
      { method: 'tools/call' as any },
      async (request: any) => {
        const { name, arguments: args } = request.params;
        this.broadcastLog(`MCP tool called: ${name}`);

        if (name === 'dispatch_task') {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  status: 'queued',
                  taskId: `task_${Math.random().toString(36).substring(2, 9)}`,
                  taskName: args.taskName,
                }),
              },
            ],
          };
        }

        if (name === 'query_memd') {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  results: [
                    { id: '1', score: 0.95, text: `Vector search match for '${args.query}'` },
                  ],
                }),
              },
            ],
          };
        }

        throw new Error(`Tool not found: ${name}`);
      }
    );
  }

  // Start STDIO transport for IDE integration
  async startStdio() {
    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);
    this.broadcastLog('Sovereign Gateway started over STDIO transport.');
  }

  // Start WebSocket Gateway for external dashboards (Tauri/Web apps)
  startWebSockets(port: number = 8080) {
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', (ws: any) => {
      this.connectedClients.add(ws);
      ws.send(JSON.stringify({ type: 'welcome', status: 'connected', server: 'gatewayd' }));

      ws.on('close', () => {
        this.connectedClients.delete(ws);
      });
    });

    this.broadcastLog(`Sovereign Gateway WebSocket server running on port ${port}`);
  }

  // Broadcast logs to web clients
  broadcastLog(message: string) {
    const payload = JSON.stringify({
      type: 'log',
      timestamp: new Date().toISOString(),
      message,
    });

    for (const client of this.connectedClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}
export default SovereignGateway;
