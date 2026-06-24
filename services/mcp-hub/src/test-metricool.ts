import { createMcpServer } from './mcp-server.js';

async function test() {
  const server = createMcpServer();
  const tools = (server as any)._registeredTools;
  
  if (!tools) {
    console.error("FAIL: No tools found registered on MCP server.");
    process.exit(1);
  }

  const expectedTools = [
    'metricool_get_profiles',
    'metricool_schedule_post',
    'metricool_get_analytics'
  ];

  for (const tool of expectedTools) {
    if (!tools[tool]) {
      console.error(`FAIL: Tool '${tool}' was not found in the MCP server registration.`);
      process.exit(1);
    }
    console.log(`SUCCESS: Tool '${tool}' is registered successfully.`);
  }

  console.log("All Metricool tools successfully verified in the Sovereign MCP Hub registry.");
  process.exit(0);
}

test().catch((err) => {
  console.error("Verification script failed:", err);
  process.exit(1);
});
