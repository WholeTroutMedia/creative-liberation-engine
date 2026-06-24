/**
 * Google Spark Run Controller — Creative Liberation Engine
 *
 * Boots the unified Google Spark Engine, establishes connection to the Google Workspace
 * MCP bridge, and executes a full system-wide operational sweep.
 *
 * Run manually: tsx services/workspace-autonomy/src/run-spark.ts
 */

import { GoogleSparkEngine, TelemetryPayload } from './modules/google-spark-engine.js';
import { WorkspaceMcpClient } from './modules/mcp-client.js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from workspace root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// CLE mTLS / Mesh Bridge configuration
const BRIDGE_URL = process.env.GOOGLE_WORKSPACE_BRIDGE_URL || 'http://127.0.0.1:3090';

async function run() {
  console.log('─────────────────────────────────────────────────────────────────────────────');
  console.log('🚀 CLE ENGINE V6: GOOGLE SPARK ENGINE BOOTSTRAPPER');
  console.log('─────────────────────────────────────────────────────────────────────────────');

  const mcpClient = new WorkspaceMcpClient(BRIDGE_URL);

  const engine = new GoogleSparkEngine({
    workspaceDir: process.cwd(),
    senderEmail: process.env.GMAIL_SENDER_EMAIL || 'inquiries@creativeliberationengine.org',
    recipientEmail: process.env.GMAIL_RECIPIENT_EMAIL || 'inquiries@creativeliberationengine.org',
    telemetrySheetId: process.env.TELEMETRY_SHEET_ID || '1_AIzaSyDJIwtD-WLPp-rexDkdA_uQPnOi2BGNSfw',
    mcpClient: mcpClient,
    ollamaUrl: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'
  });

  // Sweep 1: Execute Autonomous Triage Loop
  console.log('\n[Sweep 1/4] Running Triage Loop...');
  const triageResult = await engine.executeTriageLoop();
  console.log(`[Sweep 1/4] Triaged ${triageResult.triagedCount} incoming unread items.`);

  // Sweep 2: Sync tasks from internal queue to Google Tasks
  console.log('\n[Sweep 2/4] Syncing internal work queue to Google Tasks...');
  const syncTasksResult = await engine.syncTasksToGoogleTasks();
  console.log(`[Sweep 2/4] Google Tasks Sync completed: ${syncTasksResult}`);

  // Sweep 3: Schedule Calendar Focus blocks based on queue posture
  console.log('\n[Sweep 3/4] Evaluating and scheduling Calendar Focus Blocks...');
  const focusResult = await engine.scheduleFocusPlanner();
  console.log(`[Sweep 3/4] Focus Planner Sweep completed: ${focusResult}`);

  // Sweep 4: Harvest vehicle/garden telemetry and update Sheets dashboards
  console.log('\n[Sweep 4/4] Dynamic Telemetry sheets harvest simulation...');
  const demoTelemetry: TelemetryPayload = {
    source: 'ESP32_GARDEN',
    metrics: {
      soilMoisture: 42.5,
      airTemp: 24.8,
      humidity: 58.2,
      batteryPct: 88.0
    },
    timestamp: new Date().toISOString()
  };
  const telemetryResult = await engine.logTelemetryToSheets(demoTelemetry);
  console.log(`[Sweep 4/4] sheets telemetry logger complete: ${telemetryResult}`);

  console.log('\n─────────────────────────────────────────────────────────────────────────────');
  console.log('✓ GOOGLE SPARK OPERATIONAL SWEEP COMPLETED SUCCESSFULLY');
  console.log('─────────────────────────────────────────────────────────────────────────────');
}

run().catch((e) => {
  console.error('[Spark Boot] Fatal Error during operational sweep:', e);
});
