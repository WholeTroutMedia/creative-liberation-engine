import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

describe('WS-02 — Long-Horizon Checkpoint & Heartbeat Integration', () => {
  const checkpointsDir = path.join(projectRoot, 'runtime/checkpoints');
  const telemetryDir = path.join(projectRoot, 'runtime/telemetry');
  const heartbeatLogPath = path.join(telemetryDir, 'heartbeats.log');

  it('saves and resumes task checkpoints successfully', async () => {
    const { saveCheckpoint, resumeFromLastCheckpoint } = await import('../../services/dispatch/src/checkpoint');
    
    const taskId = 'test-long-horizon-task-999';
    const checkpointData = {
      taskId,
      agentId: 'agent-test-44',
      checkpointId: '803a6bc0-1c09-40ea-9bf2-602052a6ac3c',
      timestamp: new Date().toISOString(),
      stepIndex: 1,
      totalSteps: 10,
      state: { currentFile: 'scripts/blueprint_parser.py', processedElements: 15 },
      resourcesConsumed: {
        gpuMinutes: 2.5,
        apiCalls: 12,
        tokensProcessed: 14500
      }
    };

    // Save checkpoint
    saveCheckpoint(checkpointData);

    const expectedFile = path.join(checkpointsDir, `${taskId}-1.json`);
    expect(fs.existsSync(expectedFile)).toBe(true);

    // Read and verify file contents
    const rawContent = fs.readFileSync(expectedFile, 'utf8');
    const parsed = JSON.parse(rawContent);
    expect(parsed.taskId).toBe(taskId);
    expect(parsed.state.processedElements).toBe(15);
    expect(parsed.resourcesConsumed.gpuMinutes).toBe(2.5);

    // Resume from checkpoint
    const resumed = resumeFromLastCheckpoint(taskId);
    expect(resumed).not.toBeNull();
    expect(resumed?.checkpointId).toBe(checkpointData.checkpointId);
    expect(resumed?.stepIndex).toBe(1);

    // Clean up test checkpoints
    const files = fs.readdirSync(checkpointsDir).filter(f => f.startsWith(taskId));
    for (const f of files) {
      fs.unlinkSync(path.join(checkpointsDir, f));
    }
  });

  it('emits agent heartbeats successfully to heartbeats.log', async () => {
    const { emitHeartbeat } = await import('../../services/dispatch/src/heartbeat');

    const agentId = 'agent-telemetry-tester';
    const taskId = 'task-heartbeat-999';
    const resources = {
      gpuUtilization: 0.45,
      memoryMB: 4096,
      cpuPercent: 12.5
    };

    // Emit heartbeat
    emitHeartbeat(agentId, taskId, 'healthy', resources);

    expect(fs.existsSync(heartbeatLogPath)).toBe(true);

    // Read and parse heartbeats log
    const lines = fs.readFileSync(heartbeatLogPath, 'utf8').trim().split('\n');
    const lastLine = JSON.parse(lines[lines.length - 1]);

    expect(lastLine.agentId).toBe(agentId);
    expect(lastLine.taskId).toBe(taskId);
    expect(lastLine.status).toBe('healthy');
    expect(lastLine.resourceUsage.gpuUtilization).toBe(0.45);
  });

  it('serves heartbeats correctly via the telemetry API structure', async () => {
    const logPath = heartbeatLogPath;
    expect(fs.existsSync(logPath)).toBe(true);
    const raw = fs.readFileSync(logPath, 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean);
    const heartbeats = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
    expect(heartbeats.length).toBeGreaterThanOrEqual(1);
    expect(heartbeats[heartbeats.length - 1].agentId).toBe('agent-telemetry-tester');
  });
});
