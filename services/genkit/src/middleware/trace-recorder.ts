/**
 * Creative Liberation Engine — Trace Recorder Middleware
 * Wires the Genkit generate() pipeline into the @cle/observability TraceRecorder.
 */

import type { ModelMiddleware } from 'genkit/model';
import { traceStorage } from '@cle/observability';

export function traceRecorder(): ModelMiddleware {
  return async (req, next) => {
    const recorder = traceStorage.getStore() as any;
    if (!recorder) {
      return next(req);
    }

    const r = req as any;
    const model = r.config?.model || r.model || 'unknown';
    let prompt = '';
    if (r.prompt) {
      prompt = r.prompt;
    } else if (r.messages && r.messages.length > 0) {
      const lastMsg = r.messages[r.messages.length - 1];
      if (lastMsg.content && lastMsg.content.length > 0) {
        prompt = lastMsg.content[0].text || JSON.stringify(lastMsg.content);
      }
    }
    
    const system = r.system || '';
    
    recorder.recordLlmPrompt(
      typeof model === 'string' ? model : 'configured-model',
      prompt,
      system
    );

    try {
      const resp = await next(req);
      const text = resp.candidates?.[0]?.message?.content?.[0]?.text || '';
      recorder.recordLlmResponse(
        typeof model === 'string' ? model : 'configured-model',
        text,
        {
          usage: resp.usage,
          finishReason: resp.candidates?.[0]?.finishReason
        }
      );
      return resp;
    } catch (error: any) {
      recorder.recordEvent('llm_error', {
        model: typeof model === 'string' ? model : 'configured-model',
        error: error.message
      });
      throw error;
    }
  };
}
