/**
 * @cle/observability — Trace Recorder
 *
 * Captures granular intermediate execution traces of agent runs, including
 * tool invocations, inputs, outputs, prompts, and model responses.
 *
 * Implements Socratic-SWE full-depth intermediate logging.
 *
 * Constitutional Article IV (Quality), Article IX (Completeness)
 */

import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';

export const traceStorage = new AsyncLocalStorage();

const TRACES_DIR = '/app/creative-liberation-engine/runtime/traces';
const LOCAL_TRACES_DIR = 'Y:\\creative-liberation-engine\\runtime\\traces';

export class TraceRecorder {
  /**
   * Create a new TraceRecorder session.
   * @param {string} jobId - The identifier of the ideation or task job (e.g. IE-IDX-0377).
   */
  constructor(jobId) {
    if (!jobId) {
      throw new Error('TraceRecorder requires a valid jobId');
    }
    this.jobId = jobId;
    this.startTime = Date.now();
    this.events = [];
    
    // Resolve output path (fallback to local path if running on workstation, otherwise NAS path)
    const rootPath = fs.existsSync('Y:\\') ? LOCAL_TRACES_DIR : TRACES_DIR;
    this.outputPath = path.join(rootPath, `${jobId}_trace.json`);
  }

  /**
   * Record a custom event in the trace.
   * @param {string} type - Event type (e.g., 'tool_start', 'tool_end', 'llm_prompt', 'llm_response')
   * @param {object} payload - Event data
   */
  recordEvent(type, payload) {
    const event = {
      timestamp: new Date().toISOString(),
      type,
      ...payload
    };
    this.events.push(event);
    this.save();
  }

  /**
   * Record when a tool begins execution.
   * @param {string} toolName - Name of the tool being executed
   * @param {object} args - Arguments passed to the tool
   */
  recordToolStart(toolName, args) {
    this.recordEvent('tool_start', { toolName, arguments: args });
  }

  /**
   * Record when a tool finishes execution.
   * @param {string} toolName - Name of the tool
   * @param {boolean} success - Whether the tool ran successfully
   * @param {object} result - Output returned by the tool (truncated if too large)
   * @param {string} [error] - Error message if failed
   */
  recordToolEnd(toolName, success, result, error = null) {
    // Truncate result if too large to avoid bloating memory/disk
    let sanitizedResult = result;
    if (result && typeof result === 'object') {
      const str = JSON.stringify(result);
      if (str.length > 5000) {
        sanitizedResult = { _truncated: true, preview: str.slice(0, 1000) + '...' };
      }
    } else if (result && typeof result === 'string' && result.length > 5000) {
      sanitizedResult = result.slice(0, 1000) + '... [TRUNCATED]';
    }

    this.recordEvent('tool_end', {
      toolName,
      success,
      result: sanitizedResult,
      error
    });
  }

  /**
   * Record a prompt sent to an LLM.
   * @param {string} model - Model identifier (e.g., ollama/gemma4:12b)
   * @param {string} prompt - Prompt content
   * @param {string} [system] - System instruction
   */
  recordLlmPrompt(model, prompt, system = null) {
    this.recordEvent('llm_prompt', { model, prompt, system });
  }

  /**
   * Record a response received from an LLM.
   * @param {string} model - Model identifier
   * @param {string} text - Generated response text
   * @param {object} [metadata] - Model metadata (tokens, latency, etc.)
   */
  recordLlmResponse(model, text, metadata = null) {
    this.recordEvent('llm_response', { model, text, metadata });
  }

  /**
   * Persist the active trace to disk.
   */
  save() {
    try {
      const data = {
        jobId: this.jobId,
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date().toISOString(),
        totalEvents: this.events.length,
        events: this.events
      };
      
      const dir = path.dirname(this.outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.outputPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error(`[TRACE-RECORDER] Failed to save trace for ${this.jobId}:`, err);
    }
  }
}
