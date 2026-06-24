# @cle/agent-sdk

> Register any agent into the Creative Liberation Engine mesh from any cloud in under 10 lines.

## Install

```bash
npm install @cle/agent-sdk
```

## Quickstart (5 lines)

```ts
import { AgentWorker } from '@cle/agent-sdk';
import type { TaskEnvelope, TaskResult } from '@cle/agent-sdk';

class MyAgent extends AgentWorker {
  async handle(task: TaskEnvelope): Promise<TaskResult> {
    // Your logic here
    const output = await doWork(task.payload);
    return {
      taskId: task.taskId,
      agentId: this.manifest.agentId,
      status: 'completed',
      output,
      durationMs: 0, // fill with actual timer
    };
  }
}

const agent = new MyAgent({
  manifest: {
    agentId: 'myorg/my-agent',
    name: 'My Agent',
    version: '1.0.0',
    capabilities: ['my-capability'],
    dispatchEndpoint: 'https://dispatch.your-cle-engine.com',
    cloudProvider: 'cloudflare',  // or 'aws', 'gcp', 'fly', 'local'
    endpoint: 'https://my-agent.workers.dev',
    apiKey: process.env.IE_API_KEY,
  },
});

await agent.run();  // registers, starts heartbeat, awaits tasks
```

## Cloudflare Workers (serverless)

```ts
import { AgentWorker } from '@cle/agent-sdk/cloudflare';

export default {
  async fetch(request: Request): Promise<Response> {
    const task = await request.json();
    const result = await agent.handleWebhook(task);
    return Response.json(result);
  }
};
```

## AWS Lambda

```ts
export const handler = async (event) => {
  const result = await agent.handleOnce(event.task);
  return { statusCode: 200, body: JSON.stringify(result) };
};
```

## MCP Protocol Support

```ts
import { McpBridge } from '@cle/agent-sdk';

const bridge = new McpBridge(manifest);
bridge.onTask(myHandler);

// In your request handler:
const mcpResponse = await bridge.handleMcpRequest(incomingJsonRpcRequest);
```

Your agent's capabilities automatically appear as MCP tools in `tools/list`.

---

## Architecture

```
Your Agent (any cloud)
    │
    ├─── CLEAgentClient ── registers with dispatch
    │         │                   sends heartbeats
    │         └─ TaskHandler  ── receives tasks via webhook or SSE
    │
    └─── McpBridge ──── wraps client with MCP JSON-RPC 2.0
                         exposes capabilities as tools/list
```

---

Built for the [Creative Liberation Engine](https://wholeTroutMedia.com) — the universal agentic OS.
