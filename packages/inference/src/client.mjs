/**
 * Inference Client — unified interface to Genkit inference service.
 *
 * All inference flows through this client. No service calls Genkit directly.
 */

import { getConfig } from '@cle/config';

/**
 * Create an inference client configured for the current environment.
 * @param {object} [opts]
 * @param {string} [opts.genkitUrl] - Override Genkit URL
 * @param {string} [opts.apiKey] - Override API key
 * @returns {object} Inference client instance
 */
export function createInferenceClient(opts = {}) {
  const genkitUrl = opts.genkitUrl || getConfig('GENKIT_URL', 'http://localhost:4000');
  const apiKey = opts.apiKey || getConfig('GENKIT_API_KEY', '');

  return {
    url: genkitUrl,
    apiKey,

    /**
     * Generate text/structured output from a prompt.
     * @param {object} request
     * @param {string} request.prompt - The prompt text
     * @param {string} [request.model] - Model override
     * @param {string} [request.systemPrompt] - System instruction
     * @param {number} [request.maxTokens] - Max output tokens
     * @param {number} [request.temperature] - Sampling temperature
     * @returns {Promise<object>}
     */
    async generate(request) {
      const res = await fetch(`${genkitUrl}/api/inference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        },
        body: JSON.stringify(request),
      });
      if (!res.ok) throw new Error(`Inference failed: ${res.status} ${await res.text()}`);
      return res.json();
    },

    /**
     * Generate embeddings for text.
     * @param {string|string[]} input - Text(s) to embed
     * @param {string} [model] - Embedding model override
     * @returns {Promise<number[][]>}
     */
    async embed(input, model) {
      const texts = Array.isArray(input) ? input : [input];
      const res = await fetch(`${genkitUrl}/api/inference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        },
        body: JSON.stringify({ action: 'embed', texts, model }),
      });
      if (!res.ok) throw new Error(`Embedding failed: ${res.status} ${await res.text()}`);
      return res.json();
    },
  };
}

/** Convenience: generate with default client */
export async function generate(request) {
  const client = createInferenceClient();
  return client.generate(request);
}

/** Convenience: embed with default client */
export async function embed(input, model) {
  const client = createInferenceClient();
  return client.embed(input, model);
}
