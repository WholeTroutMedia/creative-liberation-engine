import { randomUUID } from 'crypto';
import { join } from 'path';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';

const REPO_ROOT = process.env.CLE_REPO_ROOT || 'Y:\\creative-liberation-engine';
const QUEUE_DIR = join(REPO_ROOT, '.agents', 'terminal_queue');

async function ensureQueueDir(): Promise<void> {
    if (!existsSync(QUEUE_DIR)) {
        await fs.mkdir(QUEUE_DIR, { recursive: true });
    }
}

async function writeRequest(taskId: string, command: string, cwd?: string): Promise<void> {
    await ensureQueueDir();
    const payload = {
        id: taskId,
        command,
        cwd,
        status: 'pending',
        timestamp: new Date().toISOString()
    };
    await fs.writeFile(join(QUEUE_DIR, `request-${taskId}.json`), JSON.stringify(payload, null, 2));
}

async function pollResponse(taskId: string, timeoutMs: number = 60000): Promise<Record<string, unknown>> {
    const responsePath = join(QUEUE_DIR, `response-${taskId}.json`);
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        if (existsSync(responsePath)) {
            const data = await fs.readFile(responsePath, 'utf8');
            try {
                const parsed = JSON.parse(data) as Record<string, unknown>;
                await fs.unlink(join(QUEUE_DIR, `request-${taskId}.json`)).catch(() => {});
                await fs.unlink(responsePath).catch(() => {});
                return parsed;
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`[Terminal Handoff] Failed to parse response: ${msg}`);
            }
        }
        await new Promise(r => setTimeout(r, 500));
    }

    throw new Error(`Terminal handoff request timed out after ${timeoutMs}ms`);
}

export const terminalTools = [
    {
        name: 'handoff_terminal_action',
        description: 'Execute a terminal command (e.g. npm install, git clone) by handing it off to the local IDE agent. Use this for operations that require filesystem or shell access outside the browser context.',
        inputSchema: {
            type: 'object',
            properties: {
                command: {
                    type: 'string',
                    description: 'The shell command to execute.'
                },
                cwd: {
                    type: 'string',
                    description: 'Optional working directory. If omitted, it will run in the root of the repository.'
                },
                timeout_ms: {
                    type: 'number',
                    description: 'Optional timeout in milliseconds. Default is 60000ms (1 minute).'
                }
            },
            required: ['command']
        }
    }
];

export async function handleTerminalTool(request: { params: { name: string; arguments?: Record<string, unknown> } }): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    if (request.params.name !== 'handoff_terminal_action') {
        throw new Error('Unknown tool');
    }

    const taskId = randomUUID();
    const command = String(request.params.arguments?.command);
    const cwd = request.params.arguments?.cwd ? String(request.params.arguments?.cwd) : undefined;
    const timeoutMs = request.params.arguments?.timeout_ms ? Number(request.params.arguments?.timeout_ms) : 60000;

    try {
        await writeRequest(taskId, command, cwd);
        const response = await pollResponse(taskId, timeoutMs);

        if (response.exitCode !== 0) {
            return {
                content: [{ type: 'text', text: `Command failed with exit code ${response.exitCode}\n\nSTDOUT:\n${response.stdout}\n\nSTDERR:\n${response.stderr}` }],
                isError: true,
            };
        }

        return {
            content: [{ type: 'text', text: `Command succeeded with exit code 0\n\nSTDOUT:\n${response.stdout}\n\nSTDERR:\n${response.stderr}` }]
        };
    } catch (err: unknown) {
        await fs.unlink(join(QUEUE_DIR, `request-${taskId}.json`)).catch(() => {});
        const msg = err instanceof Error ? err.message : String(err);
        return {
            content: [{ type: 'text', text: `Failed to execute terminal action: ${msg}` }],
            isError: true,
        };
    }
}
