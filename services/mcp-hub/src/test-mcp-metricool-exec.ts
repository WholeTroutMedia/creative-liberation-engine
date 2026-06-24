import { createMcpServer } from './mcp-server.js';

async function runTest() {
  console.log("Initializing MCP Server...");
  const server = createMcpServer();
  
  const toolName = 'metricool_get_profiles';
  console.log(`Locating tool: ${toolName}...`);
  const tool = (server as any)._registeredTools?.[toolName];
  if (!tool) {
    console.error(`FAIL: Tool ${toolName} not found in registered tools.`);
    process.exit(1);
  }
  
  console.log(`Executing tool handler for ${toolName} with uid 'jaharoni'...`);
  try {
    const result = await (server as any).executeToolHandler(tool, { uid: 'jaharoni' }, {});
    console.log("Tool execution succeeded!");
    console.log("Result:", JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err: any) {
    console.error("Tool execution failed with error:");
    console.error(err.stack || err.message || err);
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
