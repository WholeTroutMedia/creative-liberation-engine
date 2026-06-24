/**
 * VisionModel — Screenshot → Gemini Flash vision analysis pipeline.
 * Primary: POST to Genkit server at :4100/vision
 * Fallback: direct sovereign inference via local NAS Ollama.
 */

const GENKIT_URL = process.env.GENKIT_URL ?? "http://localhost:4100";
const GENKIT_VISION_URL = `${GENKIT_URL}/vision`;

export interface VisionResult {
    description: string;
    model: string;
    tokens?: number;
}

export class VisionModel {
    async analyze(base64Image: string, prompt: string): Promise<string> {
        // 1. Try Genkit orchestrator first
        const genkitResult = await this.tryGenkitVision(GENKIT_VISION_URL, base64Image, prompt);
        if (genkitResult) return genkitResult.description;

        // 2. Fallback: Direct sovereign inference via local NAS Ollama (Gemma 4 E2B)
        const ollamaHost = process.env.OLLAMA_HOST ?? "http://localhost:11434";
        const localResult = await this.tryLocalOllamaVision(ollamaHost, base64Image, prompt);
        if (localResult) return localResult;

        return "[Vision unavailable: Genkit offline and local Ollama unreachable. Check NAS connection.]";
    }

    private async tryGenkitVision(url: string, base64Image: string, prompt: string): Promise<VisionResult | null> {
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: base64Image, prompt, mimeType: "image/png" }),
                signal: AbortSignal.timeout(15000),
            });
            if (!res.ok) return null;
            const data = await res.json() as { description?: string; text?: string; model?: string };
            return {
                description: data.description ?? data.text ?? "",
                model: data.model ?? "gemma-4-e2b",
            };
        } catch {
            return null;
        }
    }

    private async tryLocalOllamaVision(host: string, base64Image: string, prompt: string): Promise<string | null> {
        try {
            const res = await fetch(`${host}/api/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "gemma-4-e2b:latest",
                    prompt: prompt,
                    images: [base64Image.replace(/^data:image\/[a-z]+;base64,/, "")],
                    stream: false
                }),
                signal: AbortSignal.timeout(20000),
            });
            if (!res.ok) return null;
            const data = await res.json() as { response?: string };
            return data.response ?? null;
        } catch {
            return null;
        }
    }
}
