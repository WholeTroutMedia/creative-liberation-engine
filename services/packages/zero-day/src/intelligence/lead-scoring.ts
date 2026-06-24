import { z } from 'zod';
import { GTMEvent, GTMEventType } from '../analytics/live-gtm.js';

// ─── Zero-Day Lead Scoring Engine ─────────────────────────────────────────────
// Analyzes prospect signals and GTM events to assign a conversion probability score.

export const LeadScoreSchema = z.object({
    email: z.string().email(),
    score: z.number().min(0).max(100),
    factors: z.array(z.string()),
    last_updated: z.string().datetime(),
    recommendation: z.enum(['disqualify', 'nurture', 'engage_now']),
});

export type LeadScore = z.infer<typeof LeadScoreSchema>;

const EVENT_WEIGHTS: Partial<Record<GTMEventType, number>> = {
    intake_started: 10,
    intake_completed: 30,
    proposal_viewed: 15,
    proposal_accepted: 40,
    contract_signed: 50,
};

export class LeadScoringEngine {
    private scores = new Map<string, LeadScore>();

    public processEvent(event: GTMEvent): LeadScore | null {
        if (!event.client_email) return null;

        const current = this.scores.get(event.client_email) || {
            email: event.client_email,
            score: 0,
            factors: [],
            last_updated: new Date().toISOString(),
            recommendation: 'nurture',
        };

        const weight = EVENT_WEIGHTS[event.type] || 0;
        if (weight > 0) {
            current.score = Math.min(100, current.score + weight);
            current.factors.push(`+${weight} from ${event.type}`);
        }

        current.last_updated = new Date().toISOString();
        
        if (current.score >= 80) current.recommendation = 'engage_now';
        else if (current.score >= 30) current.recommendation = 'nurture';
        else current.recommendation = 'disqualify';

        this.scores.set(event.client_email, current);
        return current;
    }

    public getScore(email: string): LeadScore | undefined {
        return this.scores.get(email);
    }
}

export const leadScorer = new LeadScoringEngine();
