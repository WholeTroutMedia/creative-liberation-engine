# Creative Liberation Engine Dispatch

This skill allows Gemma 4 to dispatch tasks directly into the Creative Liberation Engine running on the NAS.

## Usage Instructions

Use this skill when the user issues a command that requires complex processing, coding, project scaffolding, or running agents. Do not use this skill for simple Q&A that you can answer yourself.

**Examples of when to dispatch:**
- "Build a new React app for a gallery."
- "Start the Cortex agent to monitor signups."
- "Deploy the Cloudflare tunnel."

When dispatching, extract the user's raw intent and pass it in the `payload` parameter.

## Tool Definition

```json
{
  "name": "dispatch_cle_task",
  "description": "Dispatches a complex task to the sovereign Creative Liberation Engine on the local network.",
  "parameters": {
    "type": "object",
    "properties": {
      "intent": {
        "type": "string",
        "description": "The exact natural language request from the user."
      },
      "priority": {
        "type": "string",
        "enum": ["high", "normal", "low"],
        "description": "The priority of the task. Default to normal unless specified."
      }
    },
    "required": ["intent"]
  }
}
```
