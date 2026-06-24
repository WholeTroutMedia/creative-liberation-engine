import { z } from 'zod';
import { uploadBriefToDrive } from './gdrive-client.js';

import { ModelRouter } from '../utils/model-router.js';

// ─── Genkit HTTP Client — calls the running genkit service via REST ───────────
// Architectural note: zero-day does NOT embed genkit directly.
// It calls the Genkit runtime server (cle-genkit) at its HTTP API,
// which handles model routing, fallback chains, and constitutional middleware.

const GENKIT_URL = process.env.GENKIT_URL || 'http://localhost:4100';

async function genkitGenerate(prompt: string, config?: { temperature?: number, model?: string }): Promise<string> {
    const resolvedModel = config?.model || ModelRouter.resolve('creative_synthesis', 'ZERO_DAY_MODEL');
    const { model, ...cleanConfig } = config || {};
    const res = await fetch(`${GENKIT_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: resolvedModel, config: Object.keys(cleanConfig).length ? cleanConfig : undefined }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Genkit generate failed (${res.status}): ${err}`);
    }
    const data = await res.json() as { text: string };
    return data.text;
}

// ─── ZERO DAY — Smart Intake Form Engine ─────────────────────────────────────

export const ProjectTypeSchema = z.enum([
    'brand_identity', 'website', 'mobile_app', 'campaign',
    'broadcast_production', 'photography_video', 'social_media',
    'print_collateral', 'product_design', 'retainer', 'other',
]);

export const BudgetRangeSchema = z.enum([
    'under_5k', '5k_to_15k', '15k_to_50k', '50k_to_100k', 'over_100k', 'to_be_discussed',
]);

export const TimelineSchema = z.enum([
    'asap', 'within_2_weeks', 'within_1_month', 'within_3_months', 'within_6_months', 'flexible',
]);

export const ClientIntentSchema = z.object({
    project_type: ProjectTypeSchema,
    project_description: z.string(),
    target_audience: z.string(),
    key_goals: z.array(z.string()),
    success_metrics: z.array(z.string()),
    budget_range: BudgetRangeSchema,
    timeline: TimelineSchema,
    has_existing_brand: z.boolean(),
    competitors: z.array(z.string()).optional(),
    confidence_score: z.number().min(0).max(1),
    missing_information: z.array(z.string()),
});

export type ClientIntent = z.infer<typeof ClientIntentSchema>;

export interface IntakeQuestion {
    question: string;
    type: 'open_ended' | 'single_select' | 'multi_select' | 'budget' | 'timeline';
    options?: string[];
}

export interface IntakeSession {
    session_id: string;
    client_email: string;
    client_name: string;
    started_at: string;
    responses: Array<{ question: string; answer: string }>;
    current_intent: ClientIntent | null;
    is_complete: boolean;
    generated_brief: string | null;
}

// ─── Intent Extractor ─────────────────────────────────────────────────────────

export async function extractIntent(
    history: Array<{ question: string; answer: string }>
): Promise<ClientIntent> {
    const historyText = history.map((h) => `Q: ${h.question}\nA: ${h.answer}`).join('\n\n');

    const prompt = `You are STUDIO, the Creative Liberation Engine client intake specialist.
Analyze this intake conversation and extract the client's intent.
Return ONLY valid JSON. Confidence 0-1 based on completeness.

CONVERSATION:
${historyText}

Schema: { project_type, project_description, target_audience, key_goals[], success_metrics[], budget_range, timeline, has_existing_brand, competitors[], confidence_score, missing_information[] }
project_type options: brand_identity|website|mobile_app|campaign|broadcast_production|photography_video|social_media|print_collateral|product_design|retainer|other
budget_range options: under_5k|5k_to_15k|15k_to_50k|50k_to_100k|over_100k|to_be_discussed
timeline options: asap|within_2_weeks|within_1_month|within_3_months|within_6_months|flexible`;

    const text = await genkitGenerate(prompt + '\n\nReturn ONLY valid JSON matching the schema described above.', { temperature: 0.3, model: ModelRouter.resolve('fast_extraction') });
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Genkit returned no JSON for intent extraction');
    return ClientIntentSchema.parse(JSON.parse(jsonMatch[0]));
}

// ─── Next Question Generator ──────────────────────────────────────────────────

export async function generateNextQuestion(
    history: Array<{ question: string; answer: string }>,
    intent: ClientIntent | null
): Promise<IntakeQuestion | null> {
    if (intent && intent.confidence_score >= 0.85 && intent.missing_information.length === 0) {
        return null; // Complete
    }

    const missingInfo = intent?.missing_information ?? ['project type', 'goals', 'timeline', 'budget'];
    const historyText = history.map((h, i) => `${i + 1}. Q: ${h.question}\n   A: ${h.answer}`).join('\n');

    const prompt = `You are STUDIO, the Creative Liberation Engine intake specialist.
Generate the SINGLE most important next intake question.

${history.length === 0 ? 'Opening question — warm, open-ended, inviting.' : `History:\n${historyText}\n\nStill need: ${missingInfo.join(', ')}`}

Return ONLY valid JSON: { "question": "...", "type": "open_ended"|"single_select"|"budget"|"timeline", "options": [] }`;

    const responseText = await genkitGenerate(prompt, { temperature: 0.7, model: ModelRouter.resolve('creative_synthesis') });
    try {
        const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned) as IntakeQuestion;
    } catch {
        return { question: "What's the most important thing you want to achieve?", type: 'open_ended' };
    }
}

// ─── Brief Generator ──────────────────────────────────────────────────────────

export async function generateCreativeBrief(
    clientName: string,
    intent: ClientIntent,
    history: Array<{ question: string; answer: string }>
): Promise<string> {
    const historyText = history.map((h) => `- Q: ${h.question}\n  A: ${h.answer}`).join('\n');
    const prompt = `You are SCRIBE and ATHENA of the Creative Liberation Engine. Generate a professional creative brief.

CLIENT: ${clientName} | PROJECT: ${intent.project_type} | BUDGET: ${intent.budget_range} | TIMELINE: ${intent.timeline}

INTAKE:
${historyText}

Generate a brief with: Overview, Objectives, Target Audience, Success Metrics, Scope, Timeline, Budget, Creative Direction, Next Steps.
Be specific, not generic.`;

    return await genkitGenerate(prompt, { temperature: 0.4, model: ModelRouter.resolve('creative_synthesis') });
}

// ─── Session Manager ─────────────────────────────────────────────────────────

export class IntakeSessionManager {
    private sessions = new Map<string, IntakeSession>();

    createSession(clientEmail: string, clientName: string): IntakeSession {
        const session: IntakeSession = {
            session_id: `intake-${Date.now()}-${clientEmail.split('@')[0]}`,
            client_email: clientEmail,
            client_name: clientName,
            started_at: new Date().toISOString(),
            responses: [],
            current_intent: null,
            is_complete: false,
            generated_brief: null,
        };
        this.sessions.set(session.session_id, session);
        return session;
    }

    async startSession(sessionId: string): Promise<IntakeQuestion> {
        const q = await generateNextQuestion([], null);
        const session = this.sessions.get(sessionId)!;
        session.responses.push({ question: q!.question, answer: '' });
        return q!;
    }

    async processResponse(sessionId: string, answer: string): Promise<{
        next_question: IntakeQuestion | null;
        is_complete: boolean;
        brief?: string;
    }> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error(`Session ${sessionId} not found`);

        // Record answer to last question
        if (session.responses.length > 0) {
            session.responses[session.responses.length - 1].answer = answer;
        }

        // Extract intent from completed Q&A
        const completed = session.responses.filter((r) => r.answer);
        if (completed.length >= 2) {
            session.current_intent = await extractIntent(completed);
        }

        // Generate next or complete
        const next = await generateNextQuestion(completed, session.current_intent);

        if (!next || session.responses.length >= 12) {
            session.is_complete = true;
            if (session.current_intent) {
                session.generated_brief = await generateCreativeBrief(session.client_name, session.current_intent, completed);

                // Upload to Google Drive asynchronously
                const filename = `${session.client_name} - ${session.current_intent.project_type} Brief.md`;
                uploadBriefToDrive(filename, session.generated_brief).catch(err =>
                    console.warn('[ZERO-DAY] Background GDrive upload failed:', err.message)
                );
            }
            return { next_question: null, is_complete: true, brief: session.generated_brief ?? undefined };
        }

        session.responses.push({ question: next.question, answer: '' });
        return { next_question: next, is_complete: false };
    }

    getSession(sessionId: string): IntakeSession | undefined {
        return this.sessions.get(sessionId);
    }
}

// ─── One-Shot Intake Generator (For Rich Forms) ───────────────────────────────

export async function generateOneShotBrief(
    clientName: string,
    formData: {
        project_type: string;
        budget_range: string;
        timeline: string;
        project_description: string;
        key_goals: string;
    }
): Promise<string> {
    const prompt = `You are SCRIBE and ATHENA of the Creative Liberation Engine. Generate a professional creative brief from a one-shot intake form.

CLIENT: ${clientName}
PROJECT TYPE: ${formData.project_type}
BUDGET: ${formData.budget_range}
TIMELINE: ${formData.timeline}
GOALS: ${formData.key_goals}

DESCRIPTION:
${formData.project_description}

Generate a comprehensive brief with: Overview, Objectives, Target Audience, Success Metrics, Scope, Timeline, Budget, Creative Direction, and Next Steps. 
Format beautifully in Markdown. Be specific, visionary, and professional.`;

    return await genkitGenerate(prompt, { temperature: 0.4, model: ModelRouter.resolve('creative_synthesis') });
}
