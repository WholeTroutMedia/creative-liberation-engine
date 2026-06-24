/**
 * @cle/somatic — OmnimediaDirector
 *
 * Tier 1 of the Consciousness Architecture — the Genesis Compiler.
 *
 * Accepts EITHER:
 *   - PerformanceBrief  → explicit text + voice → TTS → Audio2Face → SomaticBridge
 *   - BiometricBrief    → body state → auto-generated prompt → same pipeline
 *
 * Pipeline:
 *   PerformanceBrief | BiometricBrief
 *     → (BiometricBrief → auto-prompt synthesis)
 *     → TTS (ElevenLabs/Kokoro)
 *     → Audio2Face REST
 *     → SomaticBridge POST
 *
 * The body is the script writer.
 * The MetaHuman performs what the sensors feel.
 */

import { z } from 'zod';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

const PerformanceBriefSchema = z.object({
  /** Text content to be spoken */
  text: z.string().min(1, 'text required'),
  /** Voice ID for TTS (ElevenLabs voice ID or 'kokoro:af_sky' etc.) */
  voiceId: z.string().optional().default('default'),
  /** Target language code */
  language: z.string().optional().default('en'),
  /** BPM hint for future emotion pacing */
  bpm: z.number().optional(),
  /** Optional metadata for episodic memory */
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type PerformanceBrief = z.infer<typeof PerformanceBriefSchema>;

// ─── BiometricBrief (imported from sensor-mesh, re-exported for convenience) ──
// We define a minimal inline type here to avoid circular dependency.
// The full Zod schema lives in @cle/sensor-mesh.
export interface BiometricBrief {
  bpm?: number;
  hrv?: number;
  motionIntensity?: number;
  headOrientation?: { pitch: number; yaw: number; roll: number };
  gaze?: { x: number; y: number };
  mood?: 'calm' | 'tense' | 'energized' | 'focused' | 'fatigued' | 'flow';
  source?: string;
  timestamp?: number;
}

const Audio2FaceBlendshapeResponseSchema = z.object({
  blendShapes: z.array(
    z.object({
      bs: z.array(z.number()), // 52 float values per frame
      timeCode: z.number().optional(),
    })
  ),
  sampleRate: z.number().optional(),
  numFrames: z.number().optional(),
});

export type Audio2FaceBlendshapeResponse = z.infer<typeof Audio2FaceBlendshapeResponseSchema>;

export interface DirectorOptions {
  /** Audio2Face streaming API base URL (local Omniverse) */
  audio2faceUrl?: string;
  /** SomaticBridge ingestion endpoint */
  somaticBridgeUrl?: string;
  /** ElevenLabs API key (optional — falls back to Kokoro if absent) */
  elevenLabsKey?: string;
  /** Milliseconds to wait between frame submissions to SomaticBridge */
  frameIntervalMs?: number;
}

const DIRECTOR_DEFAULTS: Required<DirectorOptions> = {
  audio2faceUrl: 'http://localhost:8011',
  somaticBridgeUrl: 'http://localhost:6060',
  elevenLabsKey: '',
  frameIntervalMs: 16, // ~60fps
};

// ─── OmnimediaDirector ───────────────────────────────────────────────────────

/**
 * OmnimediaDirector — executes a PerformanceBrief through the full pipeline.
 *
 * Usage:
 *   const director = new OmnimediaDirector({ elevenLabsKey: process.env.ELEVEN_KEY });
 *   await director.perform({ text: "Hello world", voiceId: "rachel" });
 */
export class OmnimediaDirector {
  private readonly opts: Required<DirectorOptions>;

  constructor(options: DirectorOptions = {}) {
    this.opts = { ...DIRECTOR_DEFAULTS, ...options };
  }

  /**
   * Execute a full performance from a PerformanceBrief OR a BiometricBrief.
   *
   * When given a BiometricBrief, synthesizes a prompt from body state heuristics
   * and routes through the same TTS → Audio2Face → SomaticBridge pipeline.
   *
   * Returns the number of frames transmitted.
   */
  public async perform(
    brief: PerformanceBrief | BiometricBrief
  ): Promise<{ framesTransmitted: number; durationMs: number; synthesizedPrompt?: string }> {
    const start = Date.now();

    // Distinguish input type: BiometricBrief has no 'text' field
    const isBiometric = !('text' in brief);
    let performanceBrief: PerformanceBrief;
    let synthesizedPrompt: string | undefined;

    if (isBiometric) {
      synthesizedPrompt = this.synthesizeFromBiometric(brief as BiometricBrief);
      performanceBrief = { text: synthesizedPrompt, voiceId: 'default', language: 'en' };
      console.log(`[director] 🫀 BiometricBrief → "${synthesizedPrompt.slice(0, 80)}"`);
    } else {
      const parsed = PerformanceBriefSchema.safeParse(brief);
      if (!parsed.success) {
        throw new Error(`[director] Invalid PerformanceBrief: ${parsed.error.message}`);
      }
      performanceBrief = parsed.data;
    }

    console.log(`[director] 🎬 Starting performance — "${performanceBrief.text.slice(0, 60)}..."`);

    // Step 1: Generate audio
    const audioBuffer = await this.generateAudio(performanceBrief);
    console.log(`[director] 🎵 Audio generated — ${audioBuffer.length} bytes`);

    // Step 2: Send to Audio2Face and receive blendshapes
    const blendshapeResponse = await this.runAudio2Face(audioBuffer);
    console.log(`[director] 🧬 Blendshapes received — ${blendshapeResponse.blendShapes.length} frames`);

    // Step 3: Stream frames to SomaticBridge
    const framesTransmitted = await this.streamToSomatic(blendshapeResponse);
    const durationMs = Date.now() - start;

    console.log(`[director] ✅ Performance complete — ${framesTransmitted} frames in ${durationMs}ms`);
    return { framesTransmitted, durationMs, synthesizedPrompt };
  }

  // ─── Biometric → Prompt Synthesis ────────────────────────────────────────

  /**
   * Synthesizes a performance prompt from a BiometricBrief.
   *
   * This is the somatic bridge between body state and language.
   * The MetaHuman speaks what the body knows.
   */
  private synthesizeFromBiometric(brief: BiometricBrief): string {
    const { bpm = 72, hrv = 50, motionIntensity = 0, mood = 'calm', headOrientation } = brief;

    // Build quality descriptors
    const heartState =
      bpm < 60 ? 'slow and meditative' :
      bpm < 80 ? 'steady and grounded' :
      bpm < 100 ? 'elevated and present' :
      'racing, alive, electric';

    const hrvState =
      hrv > 70 ? 'resilient and open' :
      hrv > 40 ? 'balanced and available' :
      'compressed, focused inward';

    const motionState =
      motionIntensity < 0.1 ? 'still' :
      motionIntensity < 0.4 ? 'gently moving' :
      motionIntensity < 0.7 ? 'in motion' :
      'kinetic, fully alive';

    const moodPhrases: Record<string, string> = {
      calm:      'There is a quietness here. A held breath. A still lake.',
      tense:     'Something coils beneath the surface. Watch it build.',
      energized: 'The current runs through every gesture. Unstoppable.',
      focused:   'Precision. Clarity. Everything else falls away.',
      fatigued:  'Even exhaustion has its texture. Heavy and true.',
      flow:      'Nothing is forced. Everything arrives exactly when it should.',
    };

    const moodPhrase = moodPhrases[mood] ?? moodPhrases['calm'];

    // Optional: incorporate head orientation as spatial presence
    const orientationNote = headOrientation
      ? ` The gaze tilts ${headOrientation.pitch > 0.2 ? 'downward, inward' : headOrientation.pitch < -0.2 ? 'upward, expansive' : 'forward, present'}.`
      : '';

    return [
      moodPhrase,
      `Heart ${heartState}. Nervous system ${hrvState}. Body ${motionState}.`,
      orientationNote,
    ].filter(Boolean).join(' ');
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  /**
   * Generate audio from text via ElevenLabs or a Kokoro subprocess.
   * Returns raw audio bytes (WAV/PCM).
   */
  private async generateAudio(brief: PerformanceBrief): Promise<Buffer> {
    if (this.opts.elevenLabsKey) {
      return this.generateElevenLabsAudio(brief);
    }
    return this.generateKokoroAudio(brief);
  }

  /** ElevenLabs TTS — text-to-speech via voice API */
  private async generateElevenLabsAudio(brief: PerformanceBrief): Promise<Buffer> {
    const voiceId = brief.voiceId === 'default' ? '21m00Tcm4TlvDq8ikWAM' : brief.voiceId;
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.opts.elevenLabsKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: brief.text,
        model_id: 'eleven_turbo_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!response.ok) {
      throw new Error(`[director] ElevenLabs error ${response.status}: ${await response.text()}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /** Kokoro TTS — local sovereign audio generation via Python subprocess */
  private async generateKokoroAudio(brief: PerformanceBrief): Promise<Buffer> {
    // Write text to temp file for subprocess handoff
    const tmpFile = path.join(os.tmpdir(), `somatic-tts-${Date.now()}.wav`);
    const voice = brief.voiceId === 'default' ? 'af_sky' : brief.voiceId;

    // Kokoro command — requires `pip install kokoro` in Python env
    const { execSync } = await import('child_process');
    execSync(
      `python -c "from kokoro import KPipeline; import soundfile as sf; pipe = KPipeline(lang_code='${brief.language}'); samples, _ = next(pipe('${brief.text.replace(/'/g, "\\'")}', voice='${voice}')); sf.write('${tmpFile.replace(/\\/g, '/')}', samples, 24000)"`,
      { stdio: 'pipe', timeout: 30000 }
    );

    const buffer = fs.readFileSync(tmpFile);
    fs.unlinkSync(tmpFile);
    return buffer;
  }

  /**
   * POST audio to Nvidia Audio2Face Streaming API.
   * The A2F Omniverse service must be running locally with the
   * "Mark Audio2Face Microservice" endpoint exposed at :8011.
   */
  private async runAudio2Face(audioBuffer: Buffer): Promise<Audio2FaceBlendshapeResponse> {
    // A2F Streaming API: POST /A2F/Player/SetRootPath + upload + solve blendshapes
    // Using the simpler direct inference endpoint (A2F 2023.2+)
    const url = `${this.opts.audio2faceUrl}/A2F/Exporter/ExportBlendshapes`;

    // Write to a temp WAV file for A2F to read
    const tmpAudio = path.join(os.tmpdir(), `a2f-input-${Date.now()}.wav`);
    fs.writeFileSync(tmpAudio, audioBuffer);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: tmpAudio.replace(/\\/g, '/'),
        format: 'json',
        batchSize: 16,
      }),
    });

    if (!response.ok) {
      fs.unlinkSync(tmpAudio);
      throw new Error(`[director] Audio2Face error ${response.status}: ${await response.text()}`);
    }

    const raw = await response.json();
    fs.unlinkSync(tmpAudio);

    const parsed = Audio2FaceBlendshapeResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`[director] Invalid A2F response: ${parsed.error.message}`);
    }

    return parsed.data;
  }

  /**
   * Stream all blendshape frames to SomaticBridge at 60fps.
   * Maps each A2F frame (array of 52 floats) to the ARKit named map.
   */
  private async streamToSomatic(response: Audio2FaceBlendshapeResponse): Promise<number> {
    const ARKIT_ORDER = [
      'EyeBlinkLeft', 'EyeLookDownLeft', 'EyeLookInLeft', 'EyeLookOutLeft', 'EyeLookUpLeft',
      'EyeSquintLeft', 'EyeWideLeft', 'EyeBlinkRight', 'EyeLookDownRight', 'EyeLookInRight',
      'EyeLookOutRight', 'EyeLookUpRight', 'EyeSquintRight', 'EyeWideRight',
      'JawForward', 'JawRight', 'JawLeft', 'JawOpen', 'MouthClose', 'MouthFunnel',
      'MouthPucker', 'MouthRight', 'MouthLeft', 'MouthSmileLeft', 'MouthSmileRight',
      'MouthFrownLeft', 'MouthFrownRight', 'MouthDimpleLeft', 'MouthDimpleRight',
      'MouthStretchLeft', 'MouthStretchRight', 'MouthRollLower', 'MouthRollUpper',
      'MouthShrugLower', 'MouthShrugUpper', 'MouthPressLeft', 'MouthPressRight',
      'MouthLowerDownLeft', 'MouthLowerDownRight', 'MouthUpperUpLeft', 'MouthUpperUpRight',
      'BrowDownLeft', 'BrowDownRight', 'BrowInnerUp', 'BrowOuterUpLeft', 'BrowOuterUpRight',
      'CheekPuff', 'CheekSquintLeft', 'CheekSquintRight', 'NoseSneerLeft', 'NoseSneerRight', 'TongueOut',
    ] as const;

    let transmitted = 0;
    const ingestUrl = `${this.opts.somaticBridgeUrl}/ingest`;

    for (const frame of response.blendShapes) {
      // Build named blendshape map
      const blendshapes: Record<string, number> = {};
      for (let i = 0; i < ARKIT_ORDER.length; i++) {
        blendshapes[ARKIT_ORDER[i]] = frame.bs[i] ?? 0.0;
      }

      try {
        await fetch(ingestUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ time: frame.timeCode, blendshapes }),
        });
        transmitted++;
      } catch (err) {
        console.warn(`[director] Frame ${transmitted} failed:`, err);
      }

      // Rate-limit to target fps
      if (this.opts.frameIntervalMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.opts.frameIntervalMs));
      }
    }

    return transmitted;
  }
}
