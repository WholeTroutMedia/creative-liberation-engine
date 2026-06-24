import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function main() {
    console.log('Creating transport...');
    const transport = new SSEClientTransport(new URL('http://127.0.0.1:5057/mcp'));
    const client = new Client(
        { name: 'test-client', version: '1.0.0' },
        { capabilities: {} }
    );
    
    console.log('Connecting...');
    await client.connect(transport);
    console.log('Connected! Listing tools...');
    
    const tools = await client.listTools();
    console.log(JSON.stringify(tools, null, 2));
    
    process.exit(0);
}

main().catch(console.error);
