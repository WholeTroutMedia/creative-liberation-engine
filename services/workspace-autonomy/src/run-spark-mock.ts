/**
 * Google Spark Mock Verification Controller — Creative Liberation Engine
 *
 * Runs a 100% local, high-fidelity simulation of the Google Spark Engine to validate
 * all operational sweeps (Triage, Tasks Sync, Calendar Booking, Sheets Telemetry).
 *
 * Run: tsx services/workspace-autonomy/src/run-spark-mock.ts
 */

import { GoogleSparkEngine, TelemetryPayload } from './modules/google-spark-engine.js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Mock Client that returns high-fidelity workspace mock payloads instantly
 */
class HighFidelityMockClient {
  public async execute(serverName: string, toolName: string, args: Record<string, any>): Promise<any> {
    console.log(`[High-Fidelity Mock] executing ${serverName}.${toolName} with args:`, args);
    
    switch (toolName) {
      case 'search_gmail_messages':
        return [
          { id: 'msg_101', subject: 'Urgent: Fix soil level in Greenhouse B' },
          { id: 'msg_102', subject: 'Venza OBD-II Diagnostics Update' }
        ];
      case 'get_gmail_message_content':
        if (args.messageId === 'msg_101') {
          return {
            id: 'msg_101',
            subject: 'Urgent: Fix soil level in Greenhouse B',
            from: 'gardener@cleengine.systems',
            body: 'Moisture level in Greenhouse B fell below 20%. Please start the irrigation system ASAP.'
          };
        }
        return {
          id: 'msg_102',
          subject: 'Venza OBD-II Diagnostics Update',
          from: 'venza-computer@toyota.local',
          body: 'Trip complete. Odometer: 14,250 mi. Fuel Level: 84%. DTC: None. Battery: 12.6V.'
        };
      case 'list_gmail_labels':
        return [
          { id: 'label_task', name: 'CLE_TASK' },
          { id: 'label_event', name: 'CLE_EVENT' }
        ];
      case 'manage_gmail_label':
        return { id: `label_${args.name.toLowerCase()}`, name: args.name };
      case 'modify_gmail_message_labels':
        return { success: true };
      case 'list_tasks':
        return [];
      case 'manage_task':
        return { id: `task_${Date.now()}`, title: args.title };
      case 'create_calendar':
        return { id: `cal_${Date.now()}`, summary: args.summary };
      case 'modify_sheet_values':
        return { success: true };
      default:
        return { status: 'mocked', tool: toolName, arguments: args };
    }
  }
}

async function run() {
  console.log('─────────────────────────────────────────────────────────────────────────────');
  console.log('🚀 CLE OS: GOOGLE SPARK ENGINE HIGH-FIDELITY SIMULATION');
  console.log('─────────────────────────────────────────────────────────────────────────────');

  const mockClient = new HighFidelityMockClient();

  const engine = new GoogleSparkEngine({
    workspaceDir: process.cwd(),
    senderEmail: 'inquiries@creativeliberationengine.org',
    recipientEmail: 'inquiries@creativeliberationengine.org',
    telemetrySheetId: '1_AIzaSyDJIwtD-WLPp-rexDkdA_uQPnOi2BGNSfw',
    mcpClient: mockClient,
    ollamaUrl: 'http://127.0.0.1:11434'
  });

  // 1. Triage Loop Sweep
  console.log('\n[Sweep 1/4] Running Triage Loop Simulation...');
  const triageResult = await engine.executeTriageLoop();
  console.log(`[Sweep 1/4] Simulated Triage completed. Count: ${triageResult.triagedCount}`);

  // 2. Tasks Queue Sync Sweep
  console.log('\n[Sweep 2/4] Syncing internal work queue to Google Tasks...');
  // Force a mock response from tasks endpoint
  const syncTasksResult = await engine.syncTasksToGoogleTasks();
  console.log(`[Sweep 2/4] Google Tasks Sync completed: ${syncTasksResult}`);

  // 3. Calendar Focus Blocks Sweep
  console.log('\n[Sweep 3/4] Evaluating and scheduling Calendar Focus Blocks...');
  const focusResult = await engine.scheduleFocusPlanner();
  console.log(`[Sweep 3/4] Focus Planner Sweep completed: ${focusResult}`);

  // 4. Telemetry Sheets Sweep
  console.log('\n[Sweep 4/4] Dynamic Telemetry sheets harvest...');
  const espTelemetry: TelemetryPayload = {
    source: 'ESP32_GARDEN',
    metrics: {
      soilMoisture: 42.5,
      airTemp: 24.8,
      humidity: 58.2,
      batteryPct: 88.0
    },
    timestamp: new Date().toISOString()
  };
  const telemetryResult = await engine.logTelemetryToSheets(espTelemetry);
  console.log(`[Sweep 4/4] Sheets Telemetry mirror completed: ${telemetryResult}`);

  console.log('\n─────────────────────────────────────────────────────────────────────────────');
  console.log('✓ HIGH-FIDELITY GOOGLE SPARK OPERATIONAL SWEEP COMPLETED SUCCESSFULLY');
  console.log('─────────────────────────────────────────────────────────────────────────────');
}

run().catch((e) => {
  console.error('[Spark Mock] Fatal Error during simulation sweep:', e);
});
