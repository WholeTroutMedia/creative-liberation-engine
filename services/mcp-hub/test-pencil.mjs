import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function main() {
    console.log('Connecting to OpenPencil via StreamableHTTPClientTransport...');
    // Connect via the exposed port on the host network
    const transport = new StreamableHTTPClientTransport(new URL('http://pencil-mcp:3101/mcp'));
    const client = new Client({ name: 'cli', version: '1.0.0' }, { capabilities: {} });
    await client.connect(transport);
    console.log('Connected.');

    try {
        const tools = await client.listTools();
        console.log('TOOLS:', JSON.stringify(tools, null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
    process.exit(0);
}
main().catch(console.error);
