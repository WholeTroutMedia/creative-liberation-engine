import { createMcpServer } from './mcp-server.js';

async function test() {
  const hostUrl = 'http://127.0.0.1:5160';
  const internalUrl = 'http://dispatch:5150';
  
  console.log("--- DEBUGGING INTEGRATION ENDPOINTS ---");
  for (const url of [hostUrl, internalUrl]) {
    try {
      console.log(`Fetching from ${url}/api/integrations/jaharoni/metricool...`);
      const res = await fetch(`${url}/api/integrations/jaharoni/metricool`);
      console.log(`Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`Data:`, JSON.stringify(data, null, 2));
      } else {
        console.log(`Error Text:`, await res.text());
      }
    } catch (e: any) {
      console.error(`Fetch to ${url} failed:`, e.message);
    }
  }
  
  process.env.DISPATCH_INTERNAL_URL = 'http://dispatch:5150';
  const server = createMcpServer();
  const tools = (server as any)._registeredTools;
  const tool = tools['metricool_get_profiles'];
  
  console.log("\nCalling tool handler directly...");
  try {
    const result = await tool.handler({ uid: 'jaharoni' });
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error("Handler error:", err.message);
  }
}

test();
