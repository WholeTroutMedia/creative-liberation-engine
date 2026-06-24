import { z } from 'zod';
import { ai } from '@cle/genkit';

export const VisionScoreSchema = z.object({
  aesthetic_score: z.number().min(0).max(100).describe('Technical quality, lighting, and composition (0-100)'),
  emotion_score: z.number().min(0).max(100).describe('Emotional resonance and storytelling impact (0-100)'),
  brand_alignment: z.number().min(0).max(100).describe('How well the image fits the Creative DNA of the brand (0-100)'),
  tags: z.array(z.string()).describe('Semantic tags describing the subject matter and mood'),
  curation_decision: z.enum(['hero', 'gallery', 'b-roll', 'reject']).describe('Final categorization of the output'),
  reasoning: z.string().describe('Short explanation of the scores and decision')
});

export type VisionScore = z.infer<typeof VisionScoreSchema>;

export const CurationInputSchema = z.object({
  images: z.array(z.object({
    id: z.string(),
    url: z.string(),
    mimeType: z.string()
  })).min(1),
  project_dna: z.record(z.any()).optional(),
  target_audience: z.string().optional()
});

export const CurationOutputSchema = z.object({
  results: z.record(z.string(), VisionScoreSchema),
  hero_ids: z.array(z.string()),
  gallery_ids: z.array(z.string()),
  rejected_ids: z.array(z.string())
});

export const visionCuratorFlow = ai.defineFlow({
  name: 'visionCurator',
  inputSchema: CurationInputSchema,
  outputSchema: CurationOutputSchema,
}, async (input) => {
  const results: Record<string, VisionScore> = {};
  const hero_ids: string[] = [];
  const gallery_ids: string[] = [];
  const rejected_ids: string[] = [];

  const systemPrompt = `You are an elite photography curator evaluating images against a creative brief.
Context: ${JSON.stringify({ dna: input.project_dna, audience: input.target_audience })}`;
  
  // Process in parallel batches of 5
  for (let i = 0; i < input.images.length; i += 5) {
    const batch = input.images.slice(i, i + 5);
    
    const promises = batch.map(async (img) => {
      try {
        const response = await ai.generate({
          model: process.env.GENKIT_VISION_MODEL || 'googleai/gemini-2.5-flash',
          messages: [
            { role: 'system', content: [{ text: systemPrompt }] },
            { role: 'user', content: [{ media: { url: img.url, contentType: img.mimeType } }, { text: 'Evaluate this image strictly according to the schema.' }] }
          ],
          output: { schema: VisionScoreSchema }
        });
        
        if (!response.output) throw new Error('Failed to generate score');
        return { id: img.id, score: response.output };
      } catch (error) {
        console.error(`Failed to score image ${img.id}`, error);
        return {
          id: img.id,
          score: {
            aesthetic_score: 50, emotion_score: 50, brand_alignment: 50,
            tags: ['error', 'unprocessed'], curation_decision: 'b-roll' as const,
            reasoning: 'Fallback due to vision processing error'
          }
        };
      }
    });
    
    const batchResults = await Promise.all(promises);
    
    for (const res of batchResults) {
      results[res.id] = res.score;
      switch (res.score.curation_decision) {
        case 'hero': hero_ids.push(res.id); break;
        case 'gallery': gallery_ids.push(res.id); break;
        case 'reject': rejected_ids.push(res.id); break;
      }
    }
  }

  return { results, hero_ids, gallery_ids, rejected_ids };
});
