import { okResult as Ok, errResult as Err, type Result } from '@cle/core';

export type CompressionStrategy = 'dom' | 'terminal';

export interface CompressOptions {
    maxTokens?: number;
    model?: string;
}

export class ContextCompressor {
    private readonly ollamaEndpoint = process.env.OLLAMA_HOST
        ? `${process.env.OLLAMA_HOST}/api/generate`
        : 'http://192.168.2.20:11434/api/generate';

    /**
     * Compresses raw observational dumps (e.g., full DOM or terminal outputs)
     * into lean, actionable markdown summaries using a local LLM.
     */
    public async compressObservation(
        rawInput: string,
        strategy: CompressionStrategy,
        options?: CompressOptions
    ): Promise<Result<string, string>> {
        const model = options?.model || 'qwen3-coder:latest';
        
        const prompt = this.buildPrompt(rawInput, strategy);

        try {
            const response = await fetch(this.ollamaEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt,
                    stream: false,
                    options: {
                        num_predict: options?.maxTokens || 1024,
                        temperature: 0.1 // Low temp for deterministic extraction
                    }
                })
            });

            if (!response.ok) {
                return Err(`Ollama API error: ${response.statusText}`);
            }

            const data = await response.json() as { response: string };
            return Ok(data.response.trim());
        } catch (err) {
            return Err(err instanceof Error ? err.message : String(err));
        }
    }

    private buildPrompt(rawInput: string, strategy: CompressionStrategy): string {
        if (strategy === 'dom') {
            return `You are a visual context compressor for an autonomous agent.
Analyze the following raw DOM/HTML dump.
Extract ONLY the actionable interactive elements (buttons, links, inputs with their IDs/names) and the primary structural content.
Format as a clean, highly compressed Markdown list. Ignore styling, scripts, and visual noise.

RAW DOM:
${rawInput}

COMPRESSED OBSERVATION:`;
        }

        if (strategy === 'terminal') {
            return `You are a context compressor for an autonomous agent.
Analyze the following raw terminal output.
Extract ONLY the final success/error states, crucial output values, and required next steps.
Format as a clean, highly compressed Markdown summary. Ignore progress bars, repetitive logs, and visual noise.

RAW TERMINAL OUTPUT:
${rawInput}

COMPRESSED OBSERVATION:`;
        }

        return rawInput;
    }
}
