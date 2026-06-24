/**
 * Ollama Client — sovereign local inference via Ollama.
 *
 * Direct interface to the workstation's Ollama instance.
 * Used by model arbitrage for sovereign-mode routing.
 *
 * @capabilityId cap_ollama_mcp
 */

import { getConfig } from '@cle/config';

export class OllamaClient {
  constructor(opts = {}) {
    this.host = opts.host || getConfig('OLLAMA_HOST', 'http://localhost:11434');
  }

  /** List locally available models. */
  async listModels() {
    const res = await fetch(`${this.host}/api/tags`);
    if (!res.ok) throw new Error(`Ollama list failed: ${res.status}`);
    const data = await res.json();
    return data.models || [];
  }

  /** Pull a model to local storage. */
  async pullModel(name) {
    const res = await fetch(`${this.host}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Ollama pull failed: ${res.status}`);
    return res.json();
  }

  /** Generate a completion. */
  async generate({ model, prompt, system, options = {} }) {
    const res = await fetch(`${this.host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, system, stream: false, options }),
    });
    if (!res.ok) throw new Error(`Ollama generate failed: ${res.status}`);
    return res.json();
  }

  /** Generate embeddings. */
  async embed({ model, input }) {
    const texts = Array.isArray(input) ? input : [input];
    const res = await fetch(`${this.host}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: texts }),
    });
    if (!res.ok) throw new Error(`Ollama embed failed: ${res.status}`);
    return res.json();
  }
}

/** Convenience: list local models */
export async function listLocalModels() {
  const client = new OllamaClient();
  return client.listModels();
}

/** Convenience: pull a model */
export async function pullModel(name) {
  const client = new OllamaClient();
  return client.pullModel(name);
}
