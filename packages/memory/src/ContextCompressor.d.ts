import { type Result } from '@cle/core';
/**
 * Context Compressor
 * Compresses the raw HTML/DOM or CLI/Terminal output using the local qwen2.5-coder:32b Ollama instance
 * to reduce token clutter on subsequent agent calls.
 */
export declare class ContextCompressor {
    private readonly ollamaHost;
    constructor();
    /**
     * Compress DOM or Terminal outputs into lean actionable Markdown.
     */
    compressObservation(rawInput: string, strategy: 'dom' | 'terminal'): Promise<Result<string, string>>;
}
