import { Router, Request, Response } from 'express';
import { z } from 'zod';

const router: Router = Router();

const GENKIT_URL = process.env.GENKIT_URL || 'http://127.0.0.1:4100';

const WorldGenRequestSchema = z.object({
  prompt: z.string().min(3, 'Prompt must be at least 3 characters long'),
  clientId: z.string().optional(),
  stripeLink: z.string().url().optional(),
});

// In-memory queue â€” polled by nexus-bridge every 3s
const WORLDGEN_QUEUE: any[] = [];

/**
 * @route GET /api/worldgen/queue
 * @desc Polled by nexus-bridge to pick up the next world generation task.
 */
router.get('/queue', (_req: Request, res: Response) => {
  if (WORLDGEN_QUEUE.length > 0) {
    const nextWorld = WORLDGEN_QUEUE.shift();
    return res.json({ has_task: true, payload: nextWorld });
  }
  return res.json({ has_task: false });
});

/**
 * @route GET /api/worldgen/queue/status
 * @desc Returns the current queue length without consuming.
 */
router.get('/queue/status', (_req: Request, res: Response) => {
  return res.json({ queued: WORLDGEN_QUEUE.length });
});

/**
 * @route POST /api/worldgen
 * @desc Takes a natural language prompt, calls Gemini via Genkit to generate a
 *       structured WorldGenPayload (voxels + Lua commerce script), queues it for
 *       nexus-bridge to physicalize in Rooms.xyz.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = WorldGenRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request payload',
        details: parsed.error.issues,
      });
    }

    const { prompt, stripeLink } = parsed.data;
    if (!stripeLink) {
      console.warn('[WorldGen] No stripeLink provided — commerce hooks will be non-functional');
    }
    const checkoutUrl = stripeLink || '';

    console.log(`[WorldGen] ðŸ—ï¸  Parsing prompt via Gemini: "${prompt}"`);

    // â”€â”€ Gemini-powered WorldGen Parser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const systemPrompt = `You are the Creative Liberation Engine WorldGen parser. Your job is to convert a natural language prompt describing a Rooms.xyz virtual world into a JSON payload.

Rules:
- Output ONLY valid JSON, no markdown, no explanation.
- The JSON object must have:
  - "voxels": array of { x, y, z, hex } objects â€” describe a simple 10x10 structure at most
  - "lua": array of { "objectId": string, "code": string } â€” Lua scripts for interactive objects

Lua commerce hook template (use this for any buyable object):
function onInteract()
    rooms.playSound("powerup")
    rooms.openUrl("${checkoutUrl}")
    print("Opening checkout...")
end

Keep voxel count under 30. Use creative hex colors matching the theme.`;

    let generatedPayload: any;

    try {
      const genkitRes = await fetch(`${GENKIT_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'googleai/gemini-pro-latest',
          system: systemPrompt,
          prompt: `Generate a WorldGen JSON payload for: "${prompt}"`,
        }),
      });

      if (!genkitRes.ok) throw new Error(`Genkit ${genkitRes.status}`);

      const genkitJson = await genkitRes.json() as any;
      const raw = (genkitJson.text || '').replace(/```json|```/g, '').trim();
      generatedPayload = JSON.parse(raw);
      console.log(`[WorldGen] âœ… Gemini generated ${generatedPayload.voxels?.length ?? 0} voxels and ${generatedPayload.lua?.length ?? 0} Lua hooks`);
    } catch (aiErr: any) {
      // Fallback to seeded geometry if Gemini unavailable
      console.warn(`[WorldGen] âš ï¸  Gemini unavailable (${aiErr.message}), using fallback geometry`);
      generatedPayload = {
        voxels: [
          { x: 0, y: 0, z: 0, hex: '#6366f1' }, { x: 1, y: 0, z: 0, hex: '#6366f1' }, { x: 2, y: 0, z: 0, hex: '#6366f1' },
          { x: 0, y: 1, z: 0, hex: '#818cf8' }, { x: 1, y: 1, z: 0, hex: '#a5b4fc' }, { x: 2, y: 1, z: 0, hex: '#818cf8' },
          { x: 0, y: 2, z: 0, hex: '#c7d2fe' }, { x: 1, y: 2, z: 0, hex: '#e0e7ff' }, { x: 2, y: 2, z: 0, hex: '#c7d2fe' },
        ],
        lua: [
          {
            objectId: 'commerce_hook_1',
            code: `-- Creative Liberation Engine: Zero-Day Commerce Hook\nfunction onInteract()\n    rooms.playSound("powerup")\n    rooms.openUrl("${checkoutUrl}")\n    print("Zero-Day checkout initiated...")\nend`,
          },
        ],
      };
    }

    const worldPayload = {
      id: `worldgen_${Date.now()}`,
      prompt,
      stripeLink: checkoutUrl,
      voxels: generatedPayload.voxels || [],
      lua: generatedPayload.lua || [],
      createdAt: new Date().toISOString(),
    };

    WORLDGEN_QUEUE.push(worldPayload);
    console.log(`[WorldGen] Queued task ${worldPayload.id} (queue depth: ${WORLDGEN_QUEUE.length})`);

    return res.status(200).json({ success: true, id: worldPayload.id, payload: worldPayload });

  } catch (error) {
    console.error('[WorldGen] Fatal error:', error);
    return res.status(500).json({ error: 'Failed to generate world spec from prompt' });
  }
});

export default router;

