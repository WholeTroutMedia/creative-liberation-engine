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
    mcpClient: any;
    ollamaUrl?: string;
}
export interface TelemetryPayload {
    source: 'ESP32_GARDEN' | 'VENZA_OBD_II' | 'SYSTEM_STATS' | string;
    metrics: Record<string, any>;
    timestamp: string;
}
export declare class GoogleSparkEngine {
    private config;
    private mcpClient;
    constructor(config: SparkConfig);
    /**
     * Helper to execute tool calls on the Google Workspace MCP server
     */
    private executeMcp;
    /**
     * 1. ALWAYS-ON WORKSPACE TRIAGE LOOP
     * Polls unread emails, analyzes context using Gemini 3.5 Flash via Genkit/Ollama,
     * and takes autonomous system-wide actions.
     */
    executeTriageLoop(): Promise<{
        triagedCount: number;
    }>;
    /**
     * 2. DYNAMIC TELEMETRY LOGGING TO GOOGLE SHEETS
     * Codifies system-wide ESP32 moisture metrics, OBD-II car diagnostics,
     * and system health records directly into beautiful Google Sheets dashboards.
     */
    logTelemetryToSheets(payload: TelemetryPayload): Promise<boolean>;
    /**
     * 3. GOOGLE CALENDAR AUTONOMOUS FOCUS SCHEDULER
     * Evaluates outstanding priority tasks and schedules dedicated Focus zones.
     */
    scheduleFocusPlanner(): Promise<boolean>;
    /**
     * 4. GOOGLE DOCS AUTOMATED COMPILER
     * Automatically compiles system status summaries or rich markdown notes into professional Google Docs.
     */
    compileProjectDoc(docTitle: string, markdownContent: string): Promise<string | null>;
    /**
     * 5. GOOGLE TASKS WORKLIST SYNCHRONIZER
     * Syncs active internal CLE Dispatch tasks to Google Tasks.
     */
    syncTasksToGoogleTasks(): Promise<boolean>;
    /**
     * Safe helper to route prompt to the local Ollama classifier or OpenAI/Gemini Cloud
     */
    private queryModel;
    /**
     * Helper to append label to triaged emails
     */
    private applyEmailLabel;
    /**
     * Helper to submit task to local CLE Dispatch
     */
    private dispatchToCLEQueue;
}
//# sourceMappingURL=google-spark-engine.d.ts.map