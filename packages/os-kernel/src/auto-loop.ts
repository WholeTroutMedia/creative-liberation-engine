import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Bilevel Autoresearch loop controller.
 * Runs tests, catches failures, and supports running as a persistent background daemon.
 */

export interface AutoLoopConfig {
  testCommand: string;
  workspaceRoot: string;
  intervalMinutes?: number;
  daemonMode?: boolean;
}

interface LoopCheckpoint {
  iteration: number;
  phase: 'test' | 'heal';
  lastResultHash: string;
  timestamp: string;
}

export class BilevelLoopController {
  private config: AutoLoopConfig;
  private isRunning = false;
  private checkpointPath: string;
  private iteration = 0;

  constructor(config: AutoLoopConfig) {
    this.config = { intervalMinutes: 5, daemonMode: false, ...config };
    this.checkpointPath = path.join(this.config.workspaceRoot, '.agents', 'loop-checkpoint.json');
    this.loadCheckpoint();
  }

  /**
   * Run a single pass of the wellness checks.
   */
  public async runSinglePass(): Promise<boolean> {
    this.iteration++;
    try {
      console.log(`[AutoLoop] Running test command (iteration ${this.iteration}): ${this.config.testCommand}`);
      const output = execSync(this.config.testCommand, { cwd: this.config.workspaceRoot, stdio: 'pipe' });
      const resultHash = require('crypto').createHash('sha256').update(output).digest('hex');
      console.log(`[AutoLoop] ✅ System wellness check passed.`);
      this.clearFailureLog();
      this.saveCheckpoint('test', resultHash);
      return true;
    } catch (error: any) {
      console.error(`[AutoLoop] ❌ Wellness check failed.`);
      const errorLog = error.stderr ? error.stderr.toString() : error.message;
      this.writeFailureLog(errorLog);
      await this.healCode(errorLog);
      return false;
    }
  }

  /**
   * Starts the persistent background daemon loop.
   */
  public async startDaemon(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[AutoLoop] Starting persistent wellness daemon. Interval: ${this.config.intervalMinutes}m`);

    while (this.isRunning) {
      await this.runSinglePass();
      console.log(`[AutoLoop] Sleeping for ${this.config.intervalMinutes} minutes...`);
      await new Promise((resolve) => setTimeout(resolve, this.config.intervalMinutes! * 60 * 1000));
    }
  }

  public stopDaemon(): void {
    this.isRunning = false;
    console.log(`[AutoLoop] Stopping wellness daemon...`);
  }

  private writeFailureLog(errorLog: string): void {
    try {
      const logDir = path.join(this.config.workspaceRoot, '.agents');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logFile = path.join(logDir, 'wellness-failures.log');
      const data = `[${new Date().toISOString()}] FAIL:\n${errorLog}\n\n`;
      fs.writeFileSync(logFile, data, 'utf8');
      console.log(`[AutoLoop] Logged diagnostics to ${logFile}`);
    } catch (err) {
      console.error(`[AutoLoop] Failed to write diagnostics log: ${(err as Error).message}`);
    }
  }

  private loadCheckpoint(): void {
    try {
      if (fs.existsSync(this.checkpointPath)) {
        const data = fs.readFileSync(this.checkpointPath, 'utf8');
        const checkpoint = JSON.parse(data) as LoopCheckpoint;
        this.iteration = checkpoint.iteration;
        console.log(`[AutoLoop] Resuming from checkpoint: iteration ${this.iteration}`);
      }
    } catch (err) {
      console.error(`[AutoLoop] Failed to load checkpoint: ${(err as Error).message}`);
    }
  }

  private saveCheckpoint(phase: 'test' | 'heal', resultHash: string): void {
    try {
      const checkpoint: LoopCheckpoint = {
        iteration: this.iteration,
        phase,
        lastResultHash: resultHash,
        timestamp: new Date().toISOString()
      };
      const logDir = path.dirname(this.checkpointPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.writeFileSync(this.checkpointPath, JSON.stringify(checkpoint), 'utf8');
    } catch (err) {
      console.error(`[AutoLoop] Failed to save checkpoint: ${(err as Error).message}`);
    }
  }

  private clearFailureLog(): void {
    try {
      const logFile = path.join(this.config.workspaceRoot, '.agents', 'wellness-failures.log');
      if (fs.existsSync(logFile)) {
        fs.unlinkSync(logFile);
      }
    } catch (err) {
      // Ignore
    }
  }

  private async healCode(errorLog: string): Promise<void> {
    console.log(`[AutoLoop] Analyzing error log for self-healing hooks...`);
    // Placeholder for dynamic local LLM code healing integration
    const resultHash = require('crypto').createHash('sha256').update(errorLog).digest('hex');
    this.saveCheckpoint('heal', resultHash);
    console.log(`[AutoLoop] Diagnostics dispatched.`);
  }
}

// ─── ES Module Direct Execution Check ────────────────────────────────────────
const nodePath = process.argv[1];
const currentFilePath = fileURLToPath(import.meta.url);

if (nodePath && (nodePath === currentFilePath || path.resolve(nodePath) === path.resolve(currentFilePath))) {
  const isDaemon = process.argv.includes('--daemon');
  const controller = new BilevelLoopController({
    testCommand: 'npm run test',
    workspaceRoot: path.resolve(path.dirname(currentFilePath), '..'),
    intervalMinutes: 5,
    daemonMode: isDaemon,
  });

  if (isDaemon) {
    controller.startDaemon().catch(console.error);
  } else {
    controller.runSinglePass().catch(console.error);
  }
}

