// ─── ZERO DAY — Smart Model Router ───────────────────────────────────────────
// Intelligently maps task profiles to the best available LLM.
// Cross-provider support: Checks environment variables to see which API keys
// are present, then routes to the best model for that specific provider.

export type TaskProfile =
    | 'fast_extraction'     // Lightning-fast JSON processing and classification
    | 'creative_synthesis'  // Writing project briefs and composing emails
    | 'legal_reasoning';    // Rigorous analysis, constraint checking, and drafting

export class ModelRouter {
    /**
     * Resolves the best available model string for a given cognitive profile.
     * Orders of preference ensure we use the fastest/best models from whatever
     * providers the user has plugged into the Creative Liberation Engine.
     */
    static resolve(profile: TaskProfile, fallbackEnvVar?: string): string {
        // If the user explicitly sets an override via environment variables, respect it absolutely.
        if (fallbackEnvVar && process.env[fallbackEnvVar]) {
            return process.env[fallbackEnvVar] as string;
        }

        const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
        const hasOpenAI = !!process.env.OPENAI_API_KEY;
        const hasGemini = !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_API_KEY;
        // Assume Ollama is running on localhost if nothing else prevents it
        const hasOllama = !!process.env.OLLAMA_HOST || true; // Genkit index.ts loads this unequivocally

        switch (profile) {
            case 'fast_extraction':
                // Priority: Claude Haiku > Gemini Flash > GPT 4o-mini > Gemma 3 (Local)
                if (hasAnthropic) return 'anthropic/claude-haiku-latest';
                if (hasGemini) return 'googleai/gemini-pro-latest';
                if (hasOpenAI) return 'openai/gpt-4o-mini';
                if (hasOllama) return 'ollama/gemma3:27b';
                return 'googleai/gemini-pro-latest';

            case 'creative_synthesis':
                // Priority: Claude Sonnet > GPT 4o > Gemini Pro > Llama 3.3 70B (Local)
                if (hasAnthropic) return 'anthropic/claude-sonnet-latest';
                if (hasOpenAI) return 'openai/gpt-4o';
                if (hasGemini) return 'googleai/gemini-pro-latest';
                if (hasOllama) return 'ollama/llama3.3:70b-instruct-q4_K_M';
                return 'googleai/gemini-pro-latest';

            case 'legal_reasoning':
                // Priority: o3-mini > Claude Sonnet > Gemini Pro > Llama 3.3 70B (Local)
                if (hasOpenAI) return 'openai/o3-mini';
                if (hasAnthropic) return 'anthropic/claude-sonnet-latest';
                if (hasGemini) return 'googleai/gemini-pro-latest';
                if (hasOllama) return 'ollama/llama3.3:70b-instruct-q4_K_M';
                return 'googleai/gemini-pro-latest';
        }
    }
}

