import express from 'express';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.SANDBOX_MANAGER_PORT || 5058; // Gateway is 5057, Sandbox Manager is 5058
const HOST_WORKSPACE_ROOT = process.env.HOST_WORKSPACE_ROOT || '/app/creative-liberation-engine';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health Check
app.get('/health', (_req, res) => {
  res.json({
    status: 'operational',
    service: 'sovereign-sandbox-manager',
    version: '1.0.0',
    host_workspace: HOST_WORKSPACE_ROOT,
    uptime: process.uptime(),
  });
});

const executeSchema = z.object({
  command: z.string(),
  image: z.string().default('node:20-alpine'),
  env: z.record(z.string()).optional(),
  timeout_ms: z.number().default(30000),
  memory_limit: z.string().default('256m'),
  cpu_limit: z.number().default(0),
  files: z.array(z.object({
    path: z.string(),
    content: z.string()
  })).optional()
});

app.post('/sandbox/execute', async (req, res) => {
  const parseResult = executeSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.format() });
  }

  const { command, image, env, timeout_ms, memory_limit, cpu_limit, files } = parseResult.data;
  const executionId = uuidv4();
  
  // Local path within sandbox-manager to write temporary files
  const localSandboxDir = path.join(process.cwd(), 'runtime', 'sandboxes', executionId);
  // Host path that the sibling container will bind mount
  const hostSandboxDir = `${HOST_WORKSPACE_ROOT}/runtime/sandboxes/${executionId}`;

  try {
    // 1. Create sandbox directory
    fs.mkdirSync(localSandboxDir, { recursive: true });

    // 2. Write files
    if (files && files.length > 0) {
      for (const file of files) {
        const filePath = path.join(localSandboxDir, file.path);
        // Ensure parent directories for the file exist
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, file.content, 'utf-8');
      }
    }

    // 3. Construct docker run command
    // Use --rm to auto-cleanup, limit resources, set workdir to /workspace
    const dockerArgs = [
      'run',
      '--rm',
      '--network', 'none', // Strict network isolation by default
      '-v', `${hostSandboxDir}:/workspace`,
      '-w', '/workspace',
      '-m', memory_limit
    ];

    if (cpu_limit > 0) {
      dockerArgs.push(`--cpus=${cpu_limit}`);
    }

    // Pass environment variables
    if (env) {
      for (const [key, value] of Object.entries(env)) {
        dockerArgs.push('-e', `${key}=${value}`);
      }
    }

    // Append image and command
    dockerArgs.push(image, 'sh', '-c', command);

    console.log(`[Sandbox Manager] Spawning sibling container: docker ${dockerArgs.join(' ')}`);

    // 4. Run container
    const child = spawn('docker', dockerArgs);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle timeout
    const timeout = setTimeout(() => {
      child.kill();
      // Force remove container just in case it got stuck
      exec(`docker ps -a --filter "ancestor=${image}" --format "{{.ID}}" | xargs -r docker rm -f`, () => {});
    }, timeout_ms);

    child.on('close', (code) => {
      clearTimeout(timeout);

      // 5. Clean up local files asynchronously
      fs.rm(localSandboxDir, { recursive: true, force: true }, (err) => {
        if (err) console.error(`[Sandbox Manager] Failed to clean up ${localSandboxDir}:`, err);
      });

      res.json({
        execution_id: executionId,
        exit_code: code,
        stdout,
        stderr,
        timed_out: code === null
      });
    });

  } catch (err: any) {
    console.error(`[Sandbox Manager] Execution failed:`, err);
    res.status(500).json({ error: 'Sandbox execution error', message: err.message });
    // Cleanup if directory was created
    if (fs.existsSync(localSandboxDir)) {
      fs.rmSync(localSandboxDir, { recursive: true, force: true });
    }
  }
});

app.listen(PORT, () => {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║        🔒  SOVEREIGN SANDBOX MANAGER v1.0.0              ║');
  console.log('║        Isolated Ephemeral Container Execution             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`  REST API:    http://localhost:${PORT}/health             `);
  console.log(`  Mount Path:  ${HOST_WORKSPACE_ROOT}                        `);
  console.log('=============================================================');
});
