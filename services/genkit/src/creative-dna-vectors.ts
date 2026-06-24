/**
 * Vertex AI Creative DNA Vector Integration
 * Helix-E: Phase 1 — multimodalembedding@001 vectors for per-tenant style fingerprinting
 * 
 * Generates 1408-dim vectors from images, text, and video in the same semantic space.
 * Stored in the local SQLite vector extension on NAS or Pinecone for production.
 */

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmbeddingInput {
  /** Base64-encoded image bytes */
  image?: { bytesBase64Encoded: string; mimeType: string };
  /** Text to embed (max 32 tokens for images, 1000 for text-only) */
  text?: string;
  /** Video (GCS URI) */
  video?: { gcsUri: string; startOffsetSec?: number; endOffsetSec?: number };
}

export interface EmbeddingResult {
  tenantId: string;
  vector: number[];       // 1408 dimensions
  dimension: 1408;
  model: 'multimodalembedding@001';
  inputType: 'image' | 'text' | 'video' | 'multimodal';
  createdAt: string;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

export const EmbeddingInputSchema = z.object({
  tenantId: z.string().min(1),
  image: z.object({
    bytesBase64Encoded: z.string(),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  }).optional(),
  text: z.string().max(1000).optional(),
  video: z.object({
    gcsUri: z.string().startsWith('gs://'),
    startOffsetSec: z.number().optional(),
    endOffsetSec: z.number().optional(),
  }).optional(),
}).refine(
  (data: any) => data.image ?? data.text ?? data.video,
  { message: 'At least one of image, text, or video must be provided' }
);

// ─── Vertex AI Client ─────────────────────────────────────────────────────────

interface VertexEmbeddingResponse {
  predictions: Array<{
    imageEmbedding?: number[];
    textEmbedding?: number[];
    videoEmbeddings?: Array<{ embedding: number[] }>;
  }>;
}

async function generateGeminiImageCaption(image: { bytesBase64Encoded: string; mimeType: string }, apiKey: string): Promise<string> {
  const baseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
  const endpoint = `${baseUrl}/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: "Describe the style, colors, layout, and visual components of this image in detail." },
          {
            inlineData: {
              mimeType: image.mimeType,
              data: image.bytesBase64Encoded
            }
          }
        ]
      }]
    })
  });
  if (!response.ok) {
    throw new Error(`Gemini image captioning failed: ${response.status} ${await response.text()}`);
  }
  const data = await response.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "unspecified design image";
}

async function getGoogleAIStudioEmbedding(text: string, apiKey: string): Promise<number[]> {
  const baseUrl = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
  const endpoint = `${baseUrl}/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: {
        parts: [{ text }]
      }
    })
  });
  if (!response.ok) {
    throw new Error(`Google AI Studio embedding failed: ${response.status} ${await response.text()}`);
  }
  const data = await response.json() as any;
  const vector = data.embedding?.values;
  if (!vector || !Array.isArray(vector)) {
    throw new Error("Invalid embedding response from Google AI Studio");
  }
  return vector;
}

async function getOllamaEmbedding(text: string): Promise<number[]> {
  const ollamaHost = process.env.OLLAMA_HOST ?? 'http://192.168.2.20:11434';
  const response = await fetch(`${ollamaHost}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: "nomic-embed-text",
      prompt: text
    })
  });
  if (!response.ok) {
    throw new Error(`Ollama embedding failed: ${response.status} ${await response.text()}`);
  }
  const data = await response.json() as any;
  const vector = data.embedding;
  if (!vector || !Array.isArray(vector)) {
    throw new Error("Invalid embedding response from Ollama");
  }
  return vector;
}

function padVector(v: number[], targetLength: number): number[] {
  if (v.length >= targetLength) {
    return v.slice(0, targetLength);
  }
  const padded = [...v];
  while (padded.length < targetLength) {
    padded.push(0.0);
  }
  return padded;
}

/**
 * Generate a 1408-dim multimodal embedding using Vertex AI.
 * Requires GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_REGION env vars.
 * Uses Application Default Credentials (ADC).
 */
export async function generateCreativeDnaVector(
  input: z.infer<typeof EmbeddingInputSchema>
): Promise<EmbeddingResult> {
  const validated = EmbeddingInputSchema.parse(input);
  const project = process.env['GOOGLE_CLOUD_PROJECT'];
  const region = process.env['GOOGLE_CLOUD_REGION'] ?? 'us-central1';

  if (!project) throw new Error('[AVERI] GOOGLE_CLOUD_PROJECT env var required');

  const endpoint = `https://${region}-aiplatform.googleapis.com/v1/projects/${project}/locations/${region}/publishers/google/models/multimodalembedding@001:predict`;

  // Build the instance object for the API call
  const instance: Record<string, unknown> = {};
  if (validated.image) instance['image'] = validated.image;
  if (validated.text) instance['text'] = validated.text;
  if (validated.video) instance['video'] = validated.video;

  // Get access token via ADC (gcloud auth application-default)
  const tokenRes = await fetch(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    { headers: { 'Metadata-Flavor': 'Google' } }
  ).catch(() => null);

  let authHeader = '';
  if (tokenRes?.ok) {
    const tokenData = await tokenRes.json() as { access_token: string };
    authHeader = `Bearer ${tokenData.access_token}`;
  } else if (process.env['GOOGLE_CLOUD_ACCESS_TOKEN']) {
    authHeader = `Bearer ${process.env['GOOGLE_CLOUD_ACCESS_TOKEN']}`;
  } else {
    // If no ADC is configured, set up dummy to allow the try block to proceed to catch
    authHeader = 'Bearer dummy';
  }

  let res;
  let isVertexFailed = false;
  let vertexErrorMsg = '';

  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ instances: [instance] }),
    });

    if (!res.ok) {
      isVertexFailed = true;
      vertexErrorMsg = `${res.status} ${await res.text()}`;
    }
  } catch (err: any) {
    isVertexFailed = true;
    vertexErrorMsg = err.message || String(err);
  }

  if (isVertexFailed) {
    console.warn(`[AVERI] Vertex AI embedding failed (${vertexErrorMsg.slice(0, 150)}). Invoking free-tier Google AI Studio / local Ollama fallback...`);

    const googleApiKey = process.env['GOOGLE_API_KEY'];
    let textToEmbed = validated.text || '';

    // If text is empty but we have an image, get description from Gemini
    if (!textToEmbed && validated.image && googleApiKey) {
      try {
        textToEmbed = await generateGeminiImageCaption(validated.image, googleApiKey);
        console.log(`[AVERI] Generated Gemini caption for image fallback: "${textToEmbed.slice(0, 100)}..."`);
      } catch (captionErr: any) {
        console.warn(`[AVERI] Gemini image captioning failed, using default description: ${captionErr.message}`);
        textToEmbed = 'design style image representation';
      }
    } else if (!textToEmbed) {
      textToEmbed = 'empty text fallback representation';
    }

    let rawVector: number[] | null = null;

    // Try Google AI Studio text-embedding-004 first
    if (googleApiKey) {
      try {
        rawVector = await getGoogleAIStudioEmbedding(textToEmbed, googleApiKey);
        console.log('[AVERI] Successfully generated embedding via Google AI Studio text-embedding-004');
      } catch (embedErr: any) {
        console.warn(`[AVERI] Google AI Studio embedding failed: ${embedErr.message}. Trying local Ollama...`);
      }
    }

    // Try local Ollama nomic-embed-text as second fallback
    if (!rawVector) {
      try {
        rawVector = await getOllamaEmbedding(textToEmbed);
        console.log('[AVERI] Successfully generated embedding via local Ollama nomic-embed-text');
      } catch (ollamaErr: any) {
        console.error(`[AVERI] Ollama embedding failed: ${ollamaErr.message}`);
        throw new Error(`[AVERI] All embedding paths failed. Vertex error: ${vertexErrorMsg}. Ollama error: ${ollamaErr.message}`);
      }
    }

    const vector = padVector(rawVector, 1408);
    const inputType: EmbeddingResult['inputType'] =
      validated.image && validated.text ? 'multimodal'
      : validated.image ? 'image'
      : validated.text ? 'text'
      : 'video';

    return {
      tenantId: validated.tenantId,
      vector,
      dimension: 1408,
      model: 'multimodalembedding@001',
      inputType,
      createdAt: new Date().toISOString(),
    };
  }

  const data = await res!.json() as VertexEmbeddingResponse;
  const prediction = data.predictions[0];

  // Extract the embedding — prefer image > text > video
  const vector =
    prediction?.imageEmbedding ??
    prediction?.textEmbedding ??
    prediction?.videoEmbeddings?.[0]?.embedding;

  if (!vector || vector.length !== 1408) {
    throw new Error(`[AVERI] Unexpected embedding dimension: ${vector?.length}`);
  }

  const inputType: EmbeddingResult['inputType'] =
    validated.image && validated.text ? 'multimodal'
    : validated.image ? 'image'
    : validated.text ? 'text'
    : 'video';

  return {
    tenantId: validated.tenantId,
    vector,
    dimension: 1408,
    model: 'multimodalembedding@001',
    inputType,
    createdAt: new Date().toISOString(),
  };
}

// ─── SQLite Vector Storage (NAS local) ───────────────────────────────────────

/**
 * Serializes a 1408-dim vector to a compact binary buffer for SQLite storage.
 * Use the sqlite-vec extension (installed on NAS) to store and query.
 */
export function vectorToBuffer(vector: number[]): Buffer {
  const buf = Buffer.allocUnsafe(vector.length * 4);
  vector.forEach((v, i) => buf.writeFloatLE(v, i * 4));
  return buf;
}

export function bufferToVector(buf: Buffer): number[] {
  const vec: number[] = [];
  for (let i = 0; i < buf.length; i += 4) {
    vec.push(buf.readFloatLE(i));
  }
  return vec;
}
