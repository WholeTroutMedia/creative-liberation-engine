import { createMcpServer } from './mcp-server.js';

async function main() {
  const server = createMcpServer();
  console.log("Server properties:", Object.keys(server));
  console.log("Server instance keys:", Object.getOwnPropertyNames(server));
  console.log("Server prototype keys:", Object.getOwnPropertyNames(Object.getPrototypeOf(server)));
  
  // Let's print the actual server structure
  console.log("Server JSON stringified or raw properties:");
  for (const key of Object.getOwnPropertyNames(server)) {
    try {
      const val = (server as any)[key];
      console.log(`- ${key}: ${typeof val} (constructor: ${val?.constructor?.name})`);
    } catch (e) {}
  }
}

main().catch(console.error);
