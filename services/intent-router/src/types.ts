import { z } from 'zod';

export const ResolveIntentRequestSchema = z.object({
  text: z.string(),
  context: z.object({
    domain: z.string().optional(),
    userTier: z.string().optional()
  }).optional()
});

export type ResolveIntentRequest = z.infer<typeof ResolveIntentRequestSchema>;

export interface ResolveIntentResponse {
  skills: string[];
  template?: string;
  workflow?: string;
  leadAgents: string[];
  confidence: number;
  category: string;
  fallbackLevel: number;
}
