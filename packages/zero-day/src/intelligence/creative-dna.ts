/**
 * @module zero-day/intelligence/creative-dna
 * @description Creative DNA Vectors — AI-powered fingerprinting of client aesthetic identity.
 *
 * Analyses intake answers, portfolio references, and brand descriptors to generate
 * a persistent "Creative DNA" embedding that drives:
 *  - Proposal personalisation (ZERO DAY)
 *  - Image generation seed conditioning (VOC-MCP)
 *  - Style-lock contract deliverable framing
 *
 * Task: T20260308-696 (HELIX A)
 * Agent: KEEPER / ORACLE hive
 */
import { z } from 'zod';

// ─── Canon aesthetic dimensions ───────────────────────────────────────────────

/** 12-axis aesthetic fingerprint, each axis 0.0–1.0 */
export interface AestheticVector {
  /** Hyper-minimal ↔ maximalist density */
  density: number;
  /** Cool-desaturated ↔ warm-saturated palette */
  warmth: number;
  /** Clean white-space ↔ textural complexity */
  texture: number;
  /** Documentary candid ↔ high-fashion editorial */
  editorial: number;
  /** Natural light ↔ dramatic controlled lighting */
  drama: number;
  /** Modern geometric ↔ organic natural shapes */
  organic: number;
  /** Quiet intimate ↔ grand cinematic scale */
  scale: number;
  /** Timeless classical ↔ forward-looking contemporary */
  contemporary: number;
  /** De-saturated film ↔ vivid digital */
  vibrancy: number;
  /** Soft diffused ↔ sharp crisp detail */
  crispness: number;
  /** Mono / micro-palette ↔ rich multi-colour */
  chromaticRange: number;
  /** Concealed technical ↔ visible craft/texture */
  craftVisible: number;
}

export const AestheticVectorSchema = z.object({
  density: z.number().min(0).max(1),
  warmth: z.number().min(0).max(1),
  texture: z.number().min(0).max(1),
  editorial: z.number().min(0).max(1),
  drama: z.number().min(0).max(1),
  organic: z.number().min(0).max(1),
  scale: z.number().min(0).max(1),
  contemporary: z.number().min(0).max(1),
  vibrancy: z.number().min(0).max(1),
  crispness: z.number().min(0).max(1),
  chromaticRange: z.number().min(0).max(1),
  craftVisible: z.number().min(0).max(1),
});

// ─── Creative DNA document ─────────────────────────────────────────────────────

export const CreativeDNASchema = z.object({
  client_id: z.string(),
  generated_at: z.string(),
  version: z.number().int().default(1),
  /** Primary aesthetic label computed from the vector */
  aesthetic_label: z.string(),
  /** 12-axis normalised aesthetic fingerprint */
  vector: AestheticVectorSchema,
  /** Top-3 reference style keywords for prompting VOC */
  style_keywords: z.array(z.string()).max(8),
  /** Forbidden visual patterns for this client */
  anti_patterns: z.array(z.string()).max(6),
  /** Photographer / designer archetypes that match this DNA */
  reference_archetypes: z.array(z.string()).max(5),
  /** VOC-MCP ComfyUI prompt seed fragment derived from this DNA */
  comfyui_prompt_seed: z.string(),
  /** Confidence 0–1 based on quality of intake signals */
  confidence: z.number().min(0).max(1),
});

export type CreativeDNA = z.infer<typeof CreativeDNASchema>;

// ─── Keyword → vector mapping ──────────────────────────────────────────────────

const KEYWORD_AXES: Record<string, Partial<AestheticVector>> = {
  // Density
  minimal: { density: 0.1, texture: 0.2 },
  clean: { density: 0.2, texture: 0.15 },
  'white space': { density: 0.1 },
  maximalist: { density: 0.9, texture: 0.8 },
  layered: { density: 0.75, texture: 0.7 },
  // Warmth
  warm: { warmth: 0.8 },
  'golden hour': { warmth: 0.85, drama: 0.6 },
  cool: { warmth: 0.2 },
  neutral: { warmth: 0.5 },
  moody: { warmth: 0.3, drama: 0.75 },
  // Editorial
  editorial: { editorial: 0.8 },
  documentary: { editorial: 0.15, organic: 0.7 },
  candid: { editorial: 0.1 },
  'high fashion': { editorial: 0.95, drama: 0.8 },
  // Drama
  dramatic: { drama: 0.85 },
  cinematic: { drama: 0.7, scale: 0.75 },
  intimate: { drama: 0.2, scale: 0.2 },
  epic: { scale: 0.9, drama: 0.8 },
  // Organic
  natural: { organic: 0.8, texture: 0.6 },
  geometric: { organic: 0.1, crispness: 0.8 },
  botanical: { organic: 0.85, warmth: 0.6 },
  // Vibrancy
  vivid: { vibrancy: 0.9, chromaticRange: 0.8 },
  muted: { vibrancy: 0.2, chromaticRange: 0.3 },
  monochrome: { vibrancy: 0.1, chromaticRange: 0.05 },
  'film grain': { texture: 0.7, vibrancy: 0.3, crispness: 0.25 },
  // Contemporary
  modern: { contemporary: 0.75 },
  classic: { contemporary: 0.25 },
  timeless: { contemporary: 0.3 },
  'cutting edge': { contemporary: 0.95 },
  // Craft
  artisan: { craftVisible: 0.8, organic: 0.7 },
  'fine art': { craftVisible: 0.7, editorial: 0.7 },
};

// ─── Vector computation ────────────────────────────────────────────────────────

function defaultVector(): AestheticVector {
  return {
    density: 0.5,
    warmth: 0.55,
    texture: 0.4,
    editorial: 0.5,
    drama: 0.45,
    organic: 0.5,
    scale: 0.5,
    contemporary: 0.55,
    vibrancy: 0.55,
    crispness: 0.6,
    chromaticRange: 0.5,
    craftVisible: 0.45,
  };
}

function blendVectors(base: AestheticVector, patch: Partial<AestheticVector>, weight: number): AestheticVector {
  const result = { ...base };
  for (const [key, val] of Object.entries(patch) as [keyof AestheticVector, number][]) {
    result[key] = Math.min(1, Math.max(0, base[key] * (1 - weight) + val * weight));
  }
  return result;
}

function computeVectorFromKeywords(keywords: string[]): { vector: AestheticVector; matchedCount: number } {
  let vector = defaultVector();
  let matchedCount = 0;

  for (const keyword of keywords) {
    const kw = keyword.toLowerCase().trim();
    for (const [pattern, patch] of Object.entries(KEYWORD_AXES)) {
      if (kw.includes(pattern)) {
        vector = blendVectors(vector, patch, 0.35);
        matchedCount++;
        break;
      }
    }
  }

  return { vector, matchedCount };
}

// ─── Label derivation ─────────────────────────────────────────────────────────

function deriveAestheticLabel(v: AestheticVector): string {
  if (v.density < 0.3 && v.warmth < 0.4 && v.editorial > 0.6) return 'Nordic Editorial';
  if (v.warmth > 0.75 && v.organic > 0.65 && v.drama < 0.5) return 'Warm Botanical';
  if (v.drama > 0.75 && v.editorial > 0.65) return 'Dark Fashion Editorial';
  if (v.density < 0.3 && v.vibrancy < 0.35) return 'Quiet Luxury';
  if (v.vibrancy > 0.75 && v.chromaticRange > 0.65) return 'Bold Chromatic';
  if (v.organic > 0.75 && v.craftVisible > 0.65) return 'Artisan Natural';
  if (v.contemporary > 0.8 && v.crispness > 0.75) return 'High-Voltage Modern';
  if (v.scale > 0.75 && v.drama > 0.65) return 'Cinematic Epic';
  if (v.texture > 0.7 && v.warmth > 0.55) return 'Textured Warmth';
  if (v.editorial > 0.7 && v.density < 0.45) return 'Clean Editorial';
  if (v.editorial < 0.25 && v.organic > 0.6) return 'Documentary Natural';
  return 'Signature Contemporary';
}

// ─── Anti-pattern inference ────────────────────────────────────────────────────

function inferAntiPatterns(v: AestheticVector): string[] {
  const anti: string[] = [];
  if (v.density < 0.35) anti.push('cluttered compositions', 'busy backgrounds');
  if (v.density > 0.65) anti.push('empty minimalism');
  if (v.warmth < 0.35) anti.push('warm orange-tinted edits');
  if (v.warmth > 0.65) anti.push('cold blue-tinted edits');
  if (v.editorial < 0.3) anti.push('overly posed studio shots');
  if (v.vibrancy < 0.3) anti.push('oversaturated HDR');
  if (v.drama < 0.3) anti.push('harsh dramatic lighting');
  return anti.slice(0, 6);
}

// ─── ComfyUI prompt seed ──────────────────────────────────────────────────────

function buildComfyUISeedFragment(label: string, keywords: string[], v: AestheticVector): string {
  const mood = v.drama > 0.65 ? 'dramatic moody lighting' : v.warmth > 0.7 ? 'warm natural light' : 'soft diffused light';
  const palette = v.vibrancy > 0.7 ? 'vivid saturated palette' : v.vibrancy < 0.35 ? 'muted desaturated tones' : 'balanced neutral palette';
  const detail = v.crispness > 0.7 ? 'ultra sharp detail' : v.texture > 0.65 ? 'rich textural depth' : 'clean smooth render';
  const selected = keywords.slice(0, 3).join(', ');
  return `${label.toLowerCase()}, ${selected}, ${mood}, ${palette}, ${detail}, professional photography, award-winning composition`;
}

// ─── Reference archetypes ─────────────────────────────────────────────────────

function inferArchetypes(v: AestheticVector): string[] {
  const archetypes: string[] = [];
  if (v.editorial > 0.7 && v.drama > 0.6) archetypes.push('Peter Lindbergh');
  if (v.warmth > 0.7 && v.organic > 0.6) archetypes.push('Jonas Peterson');
  if (v.density < 0.35 && v.contemporary > 0.7) archetypes.push('Erik Madigan Heck');
  if (v.editorial < 0.3 && v.organic > 0.6) archetypes.push('Mary Ellen Mark');
  if (v.scale > 0.75 && v.drama > 0.65) archetypes.push('Annie Leibovitz');
  if (v.vibrancy > 0.75 && v.contemporary > 0.7) archetypes.push('Miles Aldridge');
  if (v.craftVisible > 0.7) archetypes.push('Gregory Crewdson');
  return archetypes.slice(0, 5);
}

// ─── Main generator ───────────────────────────────────────────────────────────

export interface GenerateCreativeDNAInput {
  client_id: string;
  /** Free-text descriptors, visual references, mood words from intake */
  descriptors: string[];
  /** Any raw intake answers to mine for aesthetic signals */
  intake_answers?: Record<string, string>;
}

/**
 * Generate a Creative DNA document from intake signals.
 */
export function generateCreativeDNA(input: GenerateCreativeDNAInput): CreativeDNA {
  const allKeywords = [
    ...input.descriptors,
    ...Object.values(input.intake_answers ?? {}).join(' ').split(/\s+/).filter(w => w.length > 3),
  ];

  const { vector, matchedCount } = computeVectorFromKeywords(allKeywords);
  const confidence = Math.min(0.95, 0.3 + matchedCount * 0.08);

  const label = deriveAestheticLabel(vector);
  const styleKeywords = input.descriptors.slice(0, 8);
  const antiPatterns = inferAntiPatterns(vector);
  const archetypes = inferArchetypes(vector as any);
  const comfySeed = buildComfyUISeedFragment(label, styleKeywords, vector);

  return CreativeDNASchema.parse({
    client_id: input.client_id,
    generated_at: new Date().toISOString(),
    version: 1,
    aesthetic_label: label,
    vector,
    style_keywords: styleKeywords,
    anti_patterns: antiPatterns,
    reference_archetypes: archetypes,
    comfyui_prompt_seed: comfySeed,
    confidence,
  });
}

/**
 * Merge two Creative DNA vectors (e.g., previous + new intake signals).
 * Returns an updated DNA with incremented version.
 */
export function mergeCreativeDNA(existing: CreativeDNA, newInput: GenerateCreativeDNAInput): CreativeDNA {
  const fresh = generateCreativeDNA(newInput);

  // Blend 60% existing / 40% fresh
  const merged = { ...existing.vector };
  for (const key of Object.keys(merged) as (keyof AestheticVector)[]) {
    merged[key] = existing.vector[key] * 0.6 + fresh.vector[key] * 0.4;
  }

  return {
    ...fresh,
    vector: merged,
    version: existing.version + 1,
    confidence: Math.max(existing.confidence, fresh.confidence),
    anti_patterns: [...new Set([...existing.anti_patterns, ...fresh.anti_patterns])].slice(0, 6),
    style_keywords: [...new Set([...existing.style_keywords, ...fresh.style_keywords])].slice(0, 8),
    reference_archetypes: [...new Set([...existing.reference_archetypes, ...fresh.reference_archetypes])].slice(0, 5),
  };
}

/**
 * Cosine similarity between two aesthetic vectors (0–1).
 * Use to match new clients to existing portfolio profiles.
 */
export function vectorSimilarity(a: AestheticVector, b: AestheticVector): number {
  const keys = Object.keys(a) as (keyof AestheticVector)[];
  const dot = keys.reduce((s, k) => s + a[k] * b[k], 0);
  const magA = Math.sqrt(keys.reduce((s, k) => s + a[k] ** 2, 0));
  const magB = Math.sqrt(keys.reduce((s, k) => s + b[k] ** 2, 0));
  return magA * magB > 0 ? Math.round((dot / (magA * magB)) * 1000) / 1000 : 0;
}

// ─── MCP Tool descriptors ─────────────────────────────────────────────────────

export const GenerateCreativeDNAInputSchema = z.object({
  client_id: z.string().describe('Client UUID from the ZERO DAY intake session'),
  descriptors: z.array(z.string()).min(1).describe('Aesthetic keywords, mood descriptors, or visual reference descriptions'),
  intake_answers: z.record(z.string()).optional().describe('Raw intake Q&A to mine for additional aesthetic signals'),
});

export const CREATIVE_DNA_TOOLS = [
  {
    name: 'zeroday_generate_creative_dna',
    description: 'Generate a 12-axis Creative DNA aesthetic fingerprint from client intake signals. Returns vector, label, style keywords, anti-patterns, ComfyUI prompt seed, and confidence.',
    inputSchema: GenerateCreativeDNAInputSchema,
    handler: generateCreativeDNA,
    agentPermissions: ['KEEPER', 'ORACLE', 'AURORA', 'ZERO_DAY'],
    estimatedCost: 'Free',
  },
  {
    name: 'zeroday_vector_similarity',
    description: 'Compute cosine similarity (0–1) between two client aesthetic vectors. Use to match portfolio profiles or detect aesthetic drift.',
    inputSchema: z.object({
      vectorA: AestheticVectorSchema,
      vectorB: AestheticVectorSchema,
    }),
    handler: ({ vectorA, vectorB }: { vectorA: AestheticVector; vectorB: AestheticVector }) =>
      ({ similarity: vectorSimilarity(vectorA, vectorB) }),
    agentPermissions: ['KEEPER', 'ORACLE', 'ZERO_DAY'],
    estimatedCost: 'Free',
  },
];
