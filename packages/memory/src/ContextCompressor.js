import { okResult, errResult } from '@cle/core';
/**
 * Context Compressor
 * Compresses the raw HTML/DOM or CLI/Terminal output using the local qwen2.5-coder:32b Ollama instance
 * to reduce token clutter on subsequent agent calls.
 */
export class ContextCompressor {
    ollamaHost;
    constructor() {
        const host = process.env.OLLAMA_HOST || '192.168.2.20:11434';
        this.ollamaHost = host.startsWith('http') ? host : `http://${host}`;
    }
    /**
     * Compress DOM or Terminal outputs into lean actionable Markdown.
     */
    async compressObservation(rawInput, strategy) {
        try {
            if (!rawInput || rawInput.length < 2000) {
                return okResult(rawInput || '');
            }
            const prompt = `You are a context compression engine for the Creative Liberation Engine. 
Translate the following raw ${strategy} output into compact, highly readable Markdown.
Extract ONLY the most critical structures, errors, configurations, state, and actionable details.
Remove excessive noise, repetition, styling boilerplates, or empty DOM node hierarchies.

Raw ${strategy} input:
${rawInput}`;
            const response = await fetch(`${this.ollamaHost}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'qwen2.5-coder:32b',
                    messages: [
                        { role: 'system', content: 'You are a highly efficient text-compression bot.' },
                        { role: 'user', content: prompt }
                    ],
                    stream: false,
                    options: { temperature: 0.1 }
                })
            });
            if (!response.ok) {
                return errResult(`Ollama server returned status: ${response.status}`);
            }
            const data = await response.json();
            const content = data.message?.content?.trim();
            if (!content) {
                return errResult('Ollama compression returned empty content');
            }
            return okResult(content);
        }
        catch (error) {
            return errResult(error instanceof Error ? error.message : String(error));
        }
    }
}
