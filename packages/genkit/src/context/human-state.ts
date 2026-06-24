import { z } from 'zod';

export const HumanStateContextSchema = z.object({
  timestamp: z.number().describe('Unix timestamp of the reading'),
  mood: z.enum(['calm', 'energized', 'focused', 'stressed', 'neutral'])
    .describe('Heuristic mood inferred from physiological signals. Do not explicitly tell the user their mood unless it is critical context for the workflow.'),
  bpm: z.number().optional().describe('Heart rate in beats per minute.'),
  hrv: z.number().optional().describe('Heart rate variability (SDNN) indicating physiological stress or recovery.'),
  motionIntensity: z.number().optional().describe('General movement scale from 0.0 (still) to 1.0 (highly active)'),
  headOrientation: z.object({
    pitch: z.number(),
    yaw: z.number(),
    roll: z.number()
  }).optional().describe('Euler angles mapping exactly where the operator is looking.'),
  sources: z.array(z.string()).describe('Hardware origins for these readings (apple-watch, airpods, motion)'),
  consentMode: z.enum(['silent', 'advisory', 'full']).describe('The mode governing this data stream.'),
});

export type HumanStateContext = z.infer<typeof HumanStateContextSchema>;

/**
 * Fetch the latest human state biometric context from the running `sensor-mesh` service.
 * Respects the `BIOMETRIC_CONSENT_MODE` environment variable.
 */
export async function fetchHumanStateContext(): Promise<HumanStateContext | null> {
  const consentMode = (process.env.BIOMETRIC_CONSENT_MODE || 'advisory') as 'silent' | 'advisory' | 'full';

  // In silent mode, no physiological state is injected.
  if (consentMode === 'silent') {
    return null;
  }

  // The sensor-mesh exposes its REST interface on the host network, defaulting to port 5011
  const port = process.env.SENSOR_REST_PORT || '5011';
  // Use Docker DNS `sensor-mesh` if running in container, else localhost
  // Note: Since sensor-mesh natively binds to 0.0.0.0 over host network via MCP bridge, 
  // we try localhost (as dispatch runs alongside) or fallback to host.docker.internal when containerized
  const host = process.env.SENSOR_MESH_HOST || 'host.docker.internal'; 
  const url = `http://${host}:${port}/api/biometrics/latest`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(2000), // very short timeout; NEVER block generation on slow sensors
    });

    if (!res.ok) {
      console.warn(`[Genkit/HumanState] Failed to fetch biometrics: ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    return HumanStateContextSchema.parse({
      ...data,
      consentMode,
    });
  } catch (error: any) {
    // Expected on init or if sensor mesh is offline. Fail gracefully.
    // console.warn(`[Genkit/HumanState] Biometric pipeline offline: ${error.message}`);
    return null;
  }
}

/**
 * Utility to inject human state context into any system prompt.
 * @param currentSystemPrompt The existing system prompt.
 * @param state The fetched context (returns original prompt if null)
 */
export function injectHumanState(currentSystemPrompt: string, state: HumanStateContext | null): string {
  if (!state) return currentSystemPrompt;

  const dataBlock = JSON.stringify({
    mood: state.mood,
    vitals: { bpm: state.bpm, hrv: state.hrv },
    engagement: { motion: state.motionIntensity }
  }, null, 2);

  const contextDirective = `
<HUMAN_STATE_CONTEXT>
The following is real-time biometric and physiological data streaming from the operator's sensor mesh.
This data provides passive condition context.

${dataBlock}

INSTRUCTIONS:
1. Adapt your tone and reasoning to align with the operator's current mood or physiological state (e.g. be concise and fast if they are stressed or moving fast).
2. DO NOT explicitly mention their vitals (e.g., "I see your heart rate is 100") unless specifically relevant or requested.
3. Treat this data as passive intuition.
</HUMAN_STATE_CONTEXT>
`;

  return `${currentSystemPrompt}\n${contextDirective}`;
}
