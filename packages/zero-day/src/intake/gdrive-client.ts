import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

// ─── Google Drive MCP Client ────────────────────────────────────────────────
// Connects to the @modelcontextprotocol/server-gdrive npx server.
// Uploads creative briefs to a designated folder when intake completes.

// Uses the environment variables documented in the KI for the Ryobi UGC setup.
/** v5-only defaults — override with GDRIVE_*_PATH env vars for your machine */
const GDRIVE_OAUTH_PATH =
    process.env.GDRIVE_OAUTH_PATH ||
    'D:\\Google Antigravity\\Infusion Engine Brainchild\\creative-liberation-engine\\.agents\\credentials\\gcp-oauth.keys.json';
const GDRIVE_CREDENTIALS_PATH =
    process.env.GDRIVE_CREDENTIALS_PATH ||
    'D:\\Google Antigravity\\Infusion Engine Brainchild\\creative-liberation-engine\\.agents\\credentials\\.gdrive-server-credentials.json';

let mcpClient: Client | null = null;
let transport: StdioClientTransport | null = null;

export async function getGDriveClient(): Promise<Client> {
    if (mcpClient) return mcpClient;

    console.log('[ZERO-DAY] 🔌 Initializing Google Drive MCP Client...');

    transport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-gdrive'],
        env: {
            ...process.env,
            GDRIVE_OAUTH_PATH,
            GDRIVE_CREDENTIALS_PATH,
        },
    });

    mcpClient = new Client(
        { name: 'zero-day-gdrive-client', version: '1.0.0' },
        { capabilities: {} }
    );

    // Give it a moment to connect. StdioClientTransport doesn't always throw nicely on connect.
    await mcpClient.connect(transport);
    console.log('[ZERO-DAY] ✅ Google Drive MCP Client connected.');
    return mcpClient;
}

/**
 * Uploads text content to a new file in Google Drive using the gdrive_create_file tool.
 */
export async function uploadBriefToDrive(filename: string, content: string): Promise<void> {
    try {
        const client = await getGDriveClient();
        console.log(`[ZERO-DAY] 📤 Uploading ${filename} to Google Drive...`);

        const result = await client.callTool({
            name: 'gdrive_create_file',
            arguments: {
                name: filename,
                content: content,
                mimeType: 'text/markdown',
            },
        });

        console.log(`[ZERO-DAY] ✅ Upload complete: ${JSON.stringify(result)}`);
    } catch (err) {
        console.error('[ZERO-DAY] ❌ Failed to upload brief to Google Drive:', (err as Error).message);
    }
}

export async function closeGDriveClient(): Promise<void> {
    if (transport) {
        await transport.close();
        transport = null;
        mcpClient = null;
    }
}
