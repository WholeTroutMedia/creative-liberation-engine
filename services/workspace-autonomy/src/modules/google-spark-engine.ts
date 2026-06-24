/**
 * Google Spark System-Wide Engine — Creative Liberation Engine
 *
 * Exposes a unified personal "always-on" agent service running on Gemini 3.5 Flash.
 * Binds directly to the Google Workspace MCP suite to automate, sync, and dashboard
 * all professional workflows system-wide.
 *
 * Constitutional Compliance: Article I (Sovereignty), Article XX (Zero human wait time)
 */

export interface SparkConfig {
  workspaceDir: string;
  senderEmail: string;
  recipientEmail: string;
  telemetrySheetId?: string;
  mcpClient: any; // Dynamic Google Workspace MCP client
  ollamaUrl?: string;
}

export interface TelemetryPayload {
  source: 'ESP32_GARDEN' | 'VENZA_OBD_II' | 'SYSTEM_STATS' | string;
  metrics: Record<string, any>;
  timestamp: string;
}

export class GoogleSparkEngine {
  private config: SparkConfig;
  private mcpClient: any;

  constructor(config: SparkConfig) {
    this.config = config;
    this.mcpClient = config.mcpClient;
  }

  /**
   * Helper to execute tool calls on the Google Workspace MCP server
   */
  private async executeMcp(toolName: string, args: Record<string, any>): Promise<any> {
    if (!this.mcpClient) {
      throw new Error(`[Spark Engine] Google Workspace MCP client is not initialized.`);
    }
    console.log(`[Spark Engine] Executing Workspace MCP tool: ${toolName}...`);
    return await this.mcpClient.execute('google_workspace', toolName, args);
  }

  /**
   * 1. ALWAYS-ON WORKSPACE TRIAGE LOOP
   * Polls unread emails, analyzes context using Gemini 3.5 Flash via Genkit/Ollama,
   * and takes autonomous system-wide actions.
   */
  public async executeTriageLoop(): Promise<{ triagedCount: number }> {
    console.log('[Spark Engine] Starting Always-On Google Spark Triage Loop...');
    let triagedCount = 0;

    try {
      // Fetch unread emails
      const messages = await this.executeMcp('search_gmail_messages', { query: 'is:unread' });
      if (!messages || messages.length === 0) {
        console.log('[Spark Engine] No new unread emails to triage.');
        return { triagedCount: 0 };
      }

      console.log(`[Spark Engine] Found ${messages.length} unread emails. Triaging...`);

      for (const msg of messages) {
        // Fetch detailed email content
        const content = await this.executeMcp('get_gmail_message_content', { messageId: msg.id });
        const bodyText = content.body || content.snippet || '';
        const subject = content.subject || '';
        const sender = content.from || '';

        console.log(`[Spark Engine] Analyzing: "${subject}" from ${sender}`);

        // Construct cognitive instruction
        const prompt = `Analyze this message. If it is an actionable task, classify its priority and compile a structured task payload. If it is an event/scheduling request, schedule it in the calendar. If it requires a file write or telemetry log, structure it.
        Subject: ${subject}
        From: ${sender}
        Body: ${bodyText}
        
        Respond STRICTLY with a valid JSON:
        {
          "classification": "TASK" | "EVENT" | "INFORMATIONAL" | "TELEMETRY",
          "priority": "critical" | "high" | "normal" | "low",
          "summary": "Short 1-sentence summary",
          "actionNeeded": "Detailed description of system action",
          "autoReplyDraft": "Professional draft reply if helpful, otherwise null"
        }`;

        // Call Gemini (via local endpoint or process env key)
        const decision = await this.queryModel(prompt);

        console.log(`[Spark Engine] Decision:`, decision);

        // Act on classification
        if (decision.classification === 'TASK') {
          // Push to central CLE Dispatch task queue
          await this.dispatchToCLEQueue({
            title: `[Spark Triage] ${subject}`,
            description: `From: ${sender}\n\nObjective: ${decision.summary}\nAction: ${decision.actionNeeded}\n\nOriginal Text:\n${bodyText}`,
            priority: decision.priority,
            metadata: { sender, messageId: msg.id }
          });

          // Sync to Google Tasks
          await this.executeMcp('manage_task', {
            action: 'create',
            title: `[CLE] ${subject}`,
            notes: `Auto-triaged by Google Spark.\nPriority: ${decision.priority}\nFrom: ${sender}\n\n${decision.summary}`
          });

          // Label email as CLE_TASK
          await this.applyEmailLabel(msg.id, 'CLE_TASK');

        } else if (decision.classification === 'EVENT') {
          // Autonomous Calendar Event scheduling
          await this.executeMcp('create_calendar', {
            summary: `[Spark Scheduled] ${subject}`,
            description: `Auto-scheduled by Google Spark. Original request from: ${sender}\n\n${decision.actionNeeded}`,
            start_time: new Date(Date.now() + 3600 * 1000 * 2).toISOString(), // 2 hours from now default
            end_time: new Date(Date.now() + 3600 * 1000 * 3).toISOString()
          });

          await this.applyEmailLabel(msg.id, 'CLE_EVENT');
        }

        // Auto-reply if a high-quality draft was compiled
        if (decision.autoReplyDraft) {
          await this.executeMcp('send_gmail_message', {
            user_google_email: this.config.senderEmail,
            to: sender,
            subject: `Re: ${subject}`,
            body: decision.autoReplyDraft
          });
          console.log(`[Spark Engine] Sent autonomous reply to: ${sender}`);
        }

        // Mark email as read / Archive
        await this.executeMcp('modify_gmail_message_labels', {
          messageId: msg.id,
          removeLabelIds: ['UNREAD']
        });

        triagedCount++;
      }
    } catch (e) {
      console.error('[Spark Engine] Error during triage loop:', e);
    }

    return { triagedCount };
  }

  /**
   * 2. DYNAMIC TELEMETRY LOGGING TO GOOGLE SHEETS
   * Codifies system-wide ESP32 moisture metrics, OBD-II car diagnostics,
   * and system health records directly into beautiful Google Sheets dashboards.
   */
  public async logTelemetryToSheets(payload: TelemetryPayload): Promise<boolean> {
    const sheetId = this.config.telemetrySheetId;
    if (!sheetId) {
      console.warn('[Spark Engine] Telemetry Sheet ID not configured. Skipping sheets write.');
      return false;
    }

    console.log(`[Spark Engine] Processing telemetry log for: ${payload.source}...`);

    try {
      const timestamp = payload.timestamp || new Date().toISOString();
      const rows = [];

      if (payload.source === 'VENZA_OBD_II') {
        const m = payload.metrics;
        rows.push([
          timestamp,
          'Toyota Venza OBD-II',
          `Fuel: ${m.fuelLevel || 'N/A'}%`,
          `Odometer: ${m.odometer || 'N/A'} mi`,
          `Battery Voltage: ${m.batteryVoltage || 'N/A'}V`,
          m.troubleCodes ? `DTCs: ${m.troubleCodes.join(', ')}` : 'No Faults'
        ]);
      } else if (payload.source === 'ESP32_GARDEN') {
        const m = payload.metrics;
        rows.push([
          timestamp,
          'Garden Node ESP32',
          `Moisture: ${m.soilMoisture || 'N/A'}%`,
          `Temperature: ${m.airTemp || 'N/A'}C`,
          `Humidity: ${m.humidity || 'N/A'}%`,
          `Battery Status: ${m.batteryPct || 'N/A'}%`
        ]);
      } else {
        rows.push([
          timestamp,
          payload.source,
          JSON.stringify(payload.metrics)
        ]);
      }

      // Append row to sheet via MCP
      await this.executeMcp('modify_sheet_values', {
        spreadsheetId: sheetId,
        range_name: 'Sheet1!A:F',
        user_google_email: 'inquiries@creativeliberationengine.org',
        value_input_option: 'USER_ENTERED',
        values: rows
      });

      console.log(`[Spark Engine] Telemetry log appended successfully to Google Sheets.`);
      return true;
    } catch (e) {
      console.error('[Spark Engine] Failed to log telemetry to Google Sheets:', e);
      return false;
    }
  }

  /**
   * 3. GOOGLE CALENDAR AUTONOMOUS FOCUS SCHEDULER
   * Evaluates outstanding priority tasks and schedules dedicated Focus zones.
   */
  public async scheduleFocusPlanner(): Promise<boolean> {
    console.log('[Spark Engine] Checking task posture to schedule Focus blocks...');

    try {
      // 1. Fetch outstanding tasks from local CLE Dispatch
      const dispatchUrl = 'http://127.0.0.1:5160/api/tasks?status=queued';
      const response = await fetch(dispatchUrl);
      if (!response.ok) {
        throw new Error(`Dispatch responded with status: ${response.status}`);
      }
      const data = await response.json() as any;
      const tasks = data.tasks || [];

      const criticalTasks = tasks.filter((t: any) => t.priority === 'critical' || t.priority === 'high');
      if (criticalTasks.length === 0) {
        console.log('[Spark Engine] No heavy/critical workloads. No focus blocks needed.');
        return true;
      }

      console.log(`[Spark Engine] Found ${criticalTasks.length} critical tasks. Scheduling focus times...`);

      for (const task of criticalTasks.slice(0, 2)) {
        const blockSummary = `🧠 Focus Zone: ${task.title}`;
        const startTime = new Date(Date.now() + 3600 * 1000 * 24); // Focus block scheduled for tomorrow
        const endTime = new Date(startTime.getTime() + 3600 * 1000 * 2); // 2-hour deep focus block

        // Block Calendar
        await this.executeMcp('create_calendar', {
          summary: blockSummary,
          description: `Auto-scheduled by Google Spark focus manager.\nTask Link: ${task.id}\n\nTask Description:\n${task.description}`,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString()
        });

        // Set Out of Office for heavy sprint targets
        if (task.priority === 'critical') {
          await this.executeMcp('manage_out_of_office', {
            action: 'create',
            summary: '⛔ Out of Office (Autonomous Deep Sprint)',
            description: 'Locked in a high-priority system architecture sprint. Autonomous email processing enabled.',
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString()
          });
        }
      }

      return true;
    } catch (e) {
      console.error('[Spark Engine] Error scheduling focus blocks:', e);
      return false;
    }
  }

  /**
   * 4. GOOGLE DOCS AUTOMATED COMPILER
   * Automatically compiles system status summaries or rich markdown notes into professional Google Docs.
   */
  public async compileProjectDoc(docTitle: string, markdownContent: string): Promise<string | null> {
    console.log(`[Spark Engine] Compiling Google Doc: "${docTitle}"...`);

    try {
      // Create a fresh doc
      const doc = await this.executeMcp('create_doc', { title: docTitle });
      const docId = doc.documentId || doc.id;

      if (!docId) {
        throw new Error('Failed to create new document ID.');
      }

      // Parse markdown to list of structural edits
      const textEdits = [
        {
          insertText: markdownContent,
          index: 1
        }
      ];

      // Update text in document
      await this.executeMcp('modify_doc_text', {
        documentId: docId,
        edits: textEdits
      });

      // Export to PDF and save to shared drive if needed
      await this.executeMcp('export_doc_to_pdf', { documentId: docId });

      console.log(`[Spark Engine] Compiled and exported document successfully. ID: ${docId}`);
      return docId;
    } catch (e) {
      console.error('[Spark Engine] Failed to compile Google Doc:', e);
      return null;
    }
  }

  /**
   * 5. GOOGLE TASKS WORKLIST SYNCHRONIZER
   * Syncs active internal CLE Dispatch tasks to Google Tasks.
   */
  public async syncTasksToGoogleTasks(): Promise<boolean> {
    console.log('[Spark Engine] Synchronizing CLE Dispatch to Google Tasks...');

    try {
      const dispatchUrl = 'http://127.0.0.1:5160/api/tasks';
      const response = await fetch(dispatchUrl);
      if (!response.ok) {
        throw new Error(`Dispatch returned status: ${response.status}`);
      }
      const data = await response.json() as any;
      const tasks = data.tasks || [];

      // Query existing Google Tasks to avoid duplicates
      const gTasks = await this.executeMcp('list_tasks', { listId: '@default' }) || [];
      const gTaskTitles = new Set(gTasks.map((t: any) => t.title));

      for (const t of tasks.filter((t: any) => t.status === 'queued')) {
        const title = `[V6 Dispatch] ${t.title}`;
        if (!gTaskTitles.has(title)) {
          console.log(`[Spark Engine] Syncing task to Google Tasks: ${t.title}`);
          await this.executeMcp('manage_task', {
            action: 'create',
            title: title,
            notes: `Status: ${t.status}\nPriority: ${t.priority}\nCreated: ${t.created || t.created_at || ''}\n\n${t.description}`
          });
        }
      }

      return true;
    } catch (e) {
      console.error('[Spark Engine] Failed to sync tasks to Google Tasks:', e);
      return false;
    }
  }

  /**
   * Safe helper to route prompt to the premium Gemini Cloud API or local Ollama fallback
   */
  private async queryModel(prompt: string): Promise<any> {
    const defaultDecision = {
      classification: 'INFORMATIONAL',
      priority: 'normal',
      summary: 'Processed by fallback rules engine.',
      actionNeeded: 'None',
      autoReplyDraft: null
    };

    // 1. Google One Ultra / Premium Cloud Arbitrage (Priority Route)
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      try {
        console.log('[Spark Engine] Premium Google Cloud API Route Selected (Google One Ultra Optimized)');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1
            }
          })
        });

        if (response.ok) {
          const resData = await response.json() as any;
          const txt = resData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (txt) {
            console.log('[Spark Engine] Successfully completed Cloud inference sweep.');
            return JSON.parse(txt);
          }
        } else {
          console.warn(`[Spark Engine] Gemini Cloud API returned status: ${response.status}. Dropping to local fallback...`);
        }
      } catch (cloudErr: any) {
        console.warn('[Spark Engine] Google Cloud API unreachable. Dropping to local fallback:', cloudErr.message);
      }
    }

    // 2. Local Ollama Sovereignty Fallback
    try {
      console.log('[Spark Engine] Sovereign Local Inference Route Selected (Local Fallback)');
      const ollamaUrl = this.config.ollamaUrl || 'http://127.0.0.1:11434';
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek-r1:8b', 
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          options: { temperature: 0.1 }
        })
      });

      if (response.ok) {
        const data = await response.json() as any;
        let content = data.message?.content || '';
        
        // Strip thinking blocks
        content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        const jsonMatch = content.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (e: any) {
      console.warn('[Spark Engine] Local inference engine offline. Using fast rules heuristic:', e.message);
    }

    return defaultDecision;
  }

  /**
   * Helper to append label to triaged emails
   */
  private async applyEmailLabel(messageId: string, labelName: string) {
    try {
      // 1. List labels to find or create the target ID
      const labels = await this.executeMcp('list_gmail_labels', {}) || [];
      let label = labels.find((l: any) => l.name === labelName);

      if (!label) {
        // Create label
        label = await this.executeMcp('manage_gmail_label', {
          action: 'create',
          name: labelName
        });
      }

      const labelId = label.id || labelName;

      // 2. Add label to message
      await this.executeMcp('modify_gmail_message_labels', {
        messageId,
        addLabelIds: [labelId]
      });
      console.log(`[Spark Engine] Label [${labelName}] applied to email: ${messageId}`);
    } catch (e) {
      console.warn(`[Spark Engine] Could not apply label ${labelName} to email ${messageId}:`, e);
    }
  }

  /**
   * Helper to submit task to local CLE Dispatch
   */
  private async dispatchToCLEQueue(payload: Record<string, any>): Promise<boolean> {
    const dispatchUrl = 'http://127.0.0.1:5160/api/tasks';
    try {
      const response = await fetch(dispatchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return response.ok;
    } catch (e) {
      console.error('[Spark Engine] Error connecting to CLE Dispatch queue:', e);
      return false;
    }
  }
}
