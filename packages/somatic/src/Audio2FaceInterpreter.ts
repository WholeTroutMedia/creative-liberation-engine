import { z } from 'zod';
import { ARKitFrame, ARKitBlendshapeName, ARKIT_BLENDSHAPES } from './types/ARKit.js';

export const RawAudio2FacePayloadSchema = z.object({
  time: z.number().optional(),
  blendshapes: z.record(z.string(), z.number()),
});

export type RawAudio2FacePayload = z.infer<typeof RawAudio2FacePayloadSchema>;

export class Audio2FaceInterpreter {
  /**
   * Translates an Audio2Face generic object payload into a strict
   * ARKitFrame array mapping. Will drop non-ARKit blendshapes and pad
   * missing ARKit blendshapes with 0.0.
   * 
   * A2F often exports blendshapes directly using ARKit naming if configured
   * in the Omniverse exporter. This acts as a safety and normalization bridge.
   */
  public static parse(payload: unknown): ARKitFrame {
    const parsed = RawAudio2FacePayloadSchema.safeParse(payload);
    
    if (!parsed.success) {
      throw new Error(`[somatic] Invalid Audio2Face Payload: ${parsed.error.message}`);
    }

    const frame: Partial<ARKitFrame> = {};

    for (const shape of ARKIT_BLENDSHAPES) {
      // Audio2Face typically guarantees case-sensitive match if exported via the ARKit linker
      // but we use fallback cases if A2F changes conventions.
      const val = parsed.data.blendshapes[shape];
      frame[shape as ARKitBlendshapeName] = typeof val === 'number' ? val : 0.0;
    }

    return frame as ARKitFrame;
  }
}
