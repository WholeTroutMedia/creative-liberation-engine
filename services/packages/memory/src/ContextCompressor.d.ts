import type { Result } from '../../cle-core/src/utils/result.ts';
export type CompressionStrategy = 'dom' | 'terminal';
export interface CompressOptions {
    maxTokens?: number;
    model?: string;
}
export declare class ContextCompressor {
    private readonly ollamaEndpoint;
    /**
     * Compresses raw observational dumps (e.g., full DOM or terminal outputs)
     * into lean, actionable markdown summaries using a local LLM.
     */
    compressObservation(rawInput: string, strategy: CompressionStrategy, options?: CompressOptions): Promise<Result<string, string>>;
    private buildPrompt;
}
