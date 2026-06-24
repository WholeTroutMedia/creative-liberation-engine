import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { IntakeSessionManager, generateOneShotBrief } from './intake/form-engine.js';
import { BriefPublisher } from './intake/brief-publisher.js';
import { ECHOProfileStore, recordSignal } from './intelligence/echo-profile.js';
import { generateContract, ContractInputSchema } from './contracts/generator.js';
import { generateProposal, ProposalIntakeSchema } from './proposal-generator.js';
import { triggerRetainerOnAcceptance, ProposalAcceptanceSchema } from './contracts/retainer-acceptance.js';
import { DeliveryEngine } from './delivery/delivery-engine.js';
import { ProfitabilityMonitor } from './financials/profitability.js';
import { ZeroDayNotifier } from './notifications/notifier.js';
import { publishStripePaymentReceived } from './events/stripe-publisher.js';
import { uploadBriefToDrive, closeGDriveClient } from './intake/gdrive-client.js';
import { provisionAgentNetwork, ProvisionerInputSchema } from './flows/provisioner.js';
import {
    generateDashboard, computeRevenueKpis,
    FullDashboardSchema, RevenueMetricsSchema,
} from './analytics.js';
import { trackEvent, shutdownPostHog } from './analytics/posthog.js';
import {
    generateRetainerInvoice,
    RetainerInvoiceSchema,
    RetainerPlanSchema,
    UsageRecordSchema,
    analyseUsage
} from './retainer.js';
import worldgenRouter from './routes/worldgen.js';
import labsIntakeRouter from './routes/labs-intake.js';
import cortexIntakeRouter from './routes/cortex-intake.js';
import modelRouteRouter from './routes/model-route.js';
import voiceLogRouter from './routes/voice-log.js';

// â”€â”€â”€ ZERO DAY API Server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// The complete GTM backend â€” intake, contracts, delivery, payments, client intel

const app: Express = express();
app.use(cors({ origin: process.env.PORTAL_ORIGIN || '*' }));
app.use(express.json());
// Use process.cwd()/landing â€” tsx starts with WORKDIR=/app/packages/zero-day, so this resolves correctly.
// import.meta.url is unreliable when tsx transpiles TypeScript source directly.
app.use(express.static(join(process.cwd(), 'landing'))); // Serve the Zero-Day Landing + Intake Form

// Routes
app.use('/api/worldgen', worldgenRouter);
app.use('/api/intake/labs', labsIntakeRouter);
app.use('/api/intake/cortex', cortexIntakeRouter);
app.use('/api/route', modelRouteRouter);
app.use('/api/intake/voice-log', voiceLogRouter);

// Singleton stores and engines
const intake = new IntakeSessionManager();
const echo = new ECHOProfileStore();
const delivery = new DeliveryEngine();
const profitability = new ProfitabilityMonitor();
const notifier = new ZeroDayNotifier();

// â”€â”€â”€ Auto-chain publisher (Article XX: no human wait time) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const briefPublisher = new BriefPublisher(process.env.REDIS_URL ?? '');
briefPublisher.connect();

// â”€â”€â”€ Portal Token Generation (Hoist) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PORTAL_TOKENS = new Map<string, { client_id: string; expires_at: number }>();
const PORTAL_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function generatePortalToken(clientId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    PORTAL_TOKENS.set(token, {
        client_id: clientId,
        expires_at: Date.now() + PORTAL_TOKEN_TTL_MS,
    });
    return token;
}

function validatePortalToken(token: string): string | null {
    const record = PORTAL_TOKENS.get(token);
    if (!record) return null;
    if (Date.now() > record.expires_at) {
        PORTAL_TOKENS.delete(token);
        return null;
    }
    PORTAL_TOKENS.delete(token); // one-time use
    return record.client_id;
}

// â”€â”€â”€ Health â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'healthy', service: 'zero-day', version: '1.0.0-genesis', uptime: process.uptime() });
});

// ─── Loading Page Pulse ────────────────────────────────────────────────────────
// Public endpoint consumed by the CLEENGINE.SYSTEMS loading page.
// Returns lightweight telemetry for live animations. No auth required.

let _taskCount = 4847; // Seed — increments organically per session
app.get('/api/pulse', (_req: Request, res: Response) => {
    _taskCount += Math.floor(Math.random() * 3);
    res.set('Access-Control-Allow-Origin', '*');
    res.json({
        agents_online: 7,
        tasks_queued: Math.floor(8 + Math.random() * 6),
        tasks_completed: _taskCount,
        uptime_seconds: Math.floor(process.uptime()),
        heartbeat: true,
    });
});

// â”€â”€â”€ Intake Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.post('/intake/sessions', async (req: Request, res: Response) => {
    try {
        const { client_email, client_name } = req.body as { client_email: string; client_name: string };
        if (!client_email || !client_name) return res.status(400).json({ error: 'client_email and client_name required' });

        const session = intake.createSession(client_email, client_name);
        const openingQuestion = await intake.startSession(session.session_id);
        await echo.getOrCreate(`client-${Date.now()}`, client_email, client_name);

        // Fire intake notification async â€” non-blocking
        notifier.send({
            type: 'intake_received',
            to_email: client_email,
            client_name,
        }).catch((err: Error) => console.warn('[ZERO DAY] Intake notification failed:', err.message));

        trackEvent(session.client_email, 'intake_session_started', {
            client_name: session.client_name,
            session_id: session.session_id
        });

        return res.json({ session_id: session.session_id, first_question: openingQuestion });
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

app.post('/intake/sessions/:id/respond', async (req: Request, res: Response) => {
    try {
        const { answer } = req.body as { answer: string };
        if (!answer) return res.status(400).json({ error: 'answer required' });

        const result = await intake.processResponse(req.params.id, answer);

        // Auto-chain: when intake completes, publish brief.created â†’ campaign auto-executes
        if (result.is_complete && result.brief) {
            const session = intake.getSession(req.params.id);
            if (session) {
                // 1. Redis Stream â†’ campaign auto-executes (Article XX)
                briefPublisher.publish({
                    session_id: session.session_id,
                    client_email: session.client_email,
                    client_name: session.client_name,
                    brief_text: result.brief,
                    project_type: session.current_intent?.project_type ?? 'campaign',
                    budget_range: session.current_intent?.budget_range ?? 'to_be_discussed',
                    timeline: session.current_intent?.timeline ?? 'flexible',
                }).catch((err: Error) => console.warn('[ZERO-DAY] Non-blocking brief publish error:', err.message));

                // 2. Google Drive MCP â†’ save brief as Markdown (fire-and-forget)
                const filename = `brief-${session.session_id}-${Date.now()}.md`;
                const briefMarkdown = [
                    `# Creative Brief â€” ${session.client_name}`,
                    `**Client:** ${session.client_email}`,
                    `**Session:** ${session.session_id}`,
                    `**Project Type:** ${session.current_intent?.project_type ?? 'unknown'}`,
                    `**Budget:** ${session.current_intent?.budget_range ?? 'TBD'}`,
                    `**Timeline:** ${session.current_intent?.timeline ?? 'flexible'}`,
                    `**Generated:** ${new Date().toISOString()}`,
                    '',
                    '---',
                    '',
                    result.brief,
                ].join('\n');
                uploadBriefToDrive(filename, briefMarkdown)
                    .catch((err: Error) => console.warn('[ZERO-DAY] Drive upload failed (non-fatal):', err.message));
            }
        }

        return res.json(result);
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

app.get('/intake/sessions/:id', (req: Request, res: Response) => {
    const session = intake.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    return res.json(session);
});

// â”€â”€â”€ Unified POST Intake endpoint (Zero-Day Customer Onboarding) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/intake', async (req: Request, res: Response) => {
    try {
        const { client_name, client_email, project_type, budget_range, timeline, project_description, key_goals } = req.body;
        
        if (!client_name || !client_email) {
            return res.status(400).json({ error: 'client_name and client_email are required' });
        }

        const projectData = { project_type: project_type || 'Custom App', budget_range: budget_range || '5k_to_15k', timeline: timeline || 'asap', project_description: project_description || '', key_goals: key_goals || '' };
        
        // 1. Generate Brief
        const brief = await generateOneShotBrief(client_name, projectData);
        
        // 2. Upload to Drive (optional, non-blocking)
        const filename = `${client_name} - ${projectData.project_type} Brief.md`;
        uploadBriefToDrive(filename, brief).catch(err => console.warn('[ZERO-DAY] Drive upload failed:', err.message));
        
        // 3. Generate Stripe Checkout session (Default $5k deposit or specific by budget_range)
        const Stripe = (await import('stripe')).default;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' as any });
        
        const portalBase = process.env.PORTAL_ORIGIN ?? 'https://portal.zerday.io';
        let checkoutUrl = '';
        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                customer_email: client_email,
                line_items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: { name: `Zero Day Retainer Deposit: ${projectData.project_type}` },
                        unit_amount: 500000, // $5,000 equivalent
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: `${portalBase}/success`,
                cancel_url: `${portalBase}/cancel`,
            });
            checkoutUrl = session.url ?? '';
        } catch(err) {
            console.warn('[ZERO-DAY] Stripe checkout generation failed:', (err as Error).message);
        }

        // 4. Client Portal link
        const clientId = `client-${Date.now()}`;
        await echo.getOrCreate(clientId, client_email, client_name);

        const token = generatePortalToken(clientId);
        const magicLink = `${portalBase}/portal/${token}`;

        // 5. Notify Client via Resend
        notifier.send({
            type: 'contract_sent',
            to_email: client_email,
            client_name,
            project_title: `Your Zero Day Proposal: ${projectData.project_type}`,
            cta_url: checkoutUrl || magicLink,
            cta_label: checkoutUrl ? 'Secure Your Project Deposit ($5k)' : 'View Your Portal',
            body: `Your intelligent project brief has been synthesized by the Creative Liberation Engine.\n\nView your Client Portal: ${magicLink}\n\nProject Scope:\n${brief}`,
        }).catch((err: Error) => console.warn('[ZERO-DAY] Intake notification failed:', err.message));
        
        // 6. Publish to event stream for campaign auto-exec
        briefPublisher.publish({
            session_id: `intake-${Date.now()}`,
            client_email,
            client_name,
            brief_text: brief,
            project_type: projectData.project_type,
            budget_range: projectData.budget_range,
            timeline: projectData.timeline,
        }).catch((err: Error) => console.warn('[ZERO-DAY] Redis publish error:', err.message));
        
        trackEvent(client_email, 'one_shot_intake_received', { client_name, project_type: projectData.project_type });

        return res.json({
            success: true,
            brief,
            checkout_url: checkoutUrl,
            portal_link: magicLink
        });
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

// â”€â”€â”€ Proposal Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.post('/proposals/generate', (req: Request, res: Response) => {
    try {
        const input = ProposalIntakeSchema.parse(req.body);
        const proposal = generateProposal(input);
        return res.json(proposal);
    } catch (e: unknown) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: e.errors });
        return res.status(500).json({ error: (e as Error).message });
    }
});

// POST /proposals/accept � trigger retainer contract generation + email on client acceptance
app.post('/proposals/accept', async (req: Request, res: Response) => {
    try {
        const input = ProposalAcceptanceSchema.parse(req.body);
        const result = await triggerRetainerOnAcceptance(input);
        const httpStatus = result.status === 'complete' ? 200 : result.status === 'partial' ? 207 : 500;
        return res.status(httpStatus).json(result);
    } catch (e: unknown) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: e.errors });
        return res.status(500).json({ error: (e as Error).message });
    }
});

// â”€â”€â”€ Contract Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.post('/contracts', async (req: Request, res: Response) => {
    try {
        const input = ContractInputSchema.parse(req.body);
        const contract = await generateContract(input);
        return res.json(contract);
    } catch (e: unknown) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: e.errors });
        return res.status(500).json({ error: (e as Error).message });
    }
});

app.get('/contracts/:id/html', (_req: Request, res: Response) => {
    return res.json({ message: 'Contract stored in memory during POC â€” use POST /contracts to generate' });
});

// â”€â”€â”€ Project / Delivery Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.post('/projects', async (req: Request, res: Response) => {
    try {
        const project = await delivery.createProject(req.body as Parameters<typeof delivery.createProject>[0]);
        return res.json(project);
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

app.get('/projects', (_req: Request, res: Response) => {
    return res.json(delivery.listProjects());
});

app.get('/projects/:id', (req: Request, res: Response) => {
    const project = delivery.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    return res.json(project);
});

app.patch('/projects/:id/deliverables/:delivId', async (req: Request, res: Response) => {
    try {
        const { status, feedback } = req.body as { status: string; feedback?: string };
        const updated = await delivery.updateDeliverableStatus(
            req.params.id, req.params.delivId,
            status as Parameters<typeof delivery.updateDeliverableStatus>[2],
            feedback
        );
        return res.json(updated);
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

app.post('/projects/:id/complete', async (req: Request, res: Response) => {
    try {
        const { client_id, project_value, client_email, client_name, project_name } = req.body as {
            client_id?: string;
            project_value?: number;
            client_email?: string;
            client_name?: string;
            project_name?: string;
        };
        const project = await delivery.completeProject(req.params.id);
        if (client_id && project_value) {
            await echo.recordProjectComplete(client_id, req.params.id, Number(project_value));
        }
        if (client_email) {
            notifier.send({
                type: 'project_complete',
                to_email: client_email,
                client_name: client_name ?? 'Valued Client',
                project_title: project_name ?? project.title,
                cta_url: `${process.env.PORTAL_ORIGIN ?? 'https://portal.zerday.io'}/projects/${req.params.id}`,
                cta_label: 'Download Final Assets',
            }).catch((err: Error) => console.warn('[ZERO DAY] Completion notification failed:', err.message));
            
            trackEvent(client_email, 'project_completed', {
                project_id: req.params.id,
                project_title: project.title,
                project_value: project_value
            });
        }
        return res.json(project);
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

// â”€â”€â”€ Profitability Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/projects/:id/profitability', (req: Request, res: Response) => {
    try {
        return res.json(profitability.getReport(req.params.id));
    } catch (e: unknown) {
        return res.status(404).json({ error: (e as Error).message });
    }
});

app.post('/projects/:id/time', (req: Request, res: Response) => {
    try {
        const entry = profitability.logTime(req.params.id, req.body as Parameters<typeof profitability.logTime>[1]);
        return res.json(entry);
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

app.get('/financials/summary', (_req: Request, res: Response) => {
    return res.json(profitability.getStudioSummary());
});

// â”€â”€â”€ ECHO / Client Intelligence Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/clients/:id/intelligence', async (req: Request, res: Response) => {
    const profile = await echo.get(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Client not found' });
    return res.json(profile);
});

app.get('/clients/:id/insights', (req: Request, res: Response) => {
    const insights = echo.getInsights(req.params.id);
    return res.json({ client_id: req.params.id, insights });
});

app.post('/clients/:id/signal', async (req: Request, res: Response) => {
    try {
        const { signal_type, value, note, project_id } = req.body as {
            signal_type: Parameters<typeof recordSignal>[1];
            value: number;
            note?: string;
            project_id?: string;
        };
        const profile = await echo.get(req.params.id);
        if (!profile) return res.status(404).json({ error: 'Client not found' });
        const updated = recordSignal(profile, signal_type, value, note, project_id);
        await echo.save(updated);
        return res.json(updated);
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

// â”€â”€â”€ Stripe Webhook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    if (!process.env.STRIPE_WEBHOOK_SECRET || !sig) {
        return res.status(400).json({ error: 'Missing webhook secret' });
    }

    try {
        const Stripe = (await import('stripe')).default;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' as any });
        const event = stripe.webhooks.constructEvent(
            req.body as Buffer,
            sig as string,
            process.env.STRIPE_WEBHOOK_SECRET
        );

        if (event.type === 'invoice.paid') {
            const invoice = event.data.object as { customer_email?: string; amount_paid: number; id: string };
            console.log(`[ZERO DAY] Payment received: $${invoice.amount_paid / 100} from ${invoice.customer_email}`);
            if (invoice.customer_email) {
                notifier.send({
                    type: 'payment_received',
                    to_email: invoice.customer_email,
                    client_name: invoice.customer_email,
                    amount: invoice.amount_paid / 100,
                }).catch((err: Error) => console.warn('[ZERO DAY] Payment notification failed:', err.message));

                publishStripePaymentReceived(
                    invoice.customer_email,
                    invoice.amount_paid,
                    invoice.id
                ).catch((err: Error) => console.warn('[ZERO DAY] Redis publish failed:', err.message));
                
                trackEvent(invoice.customer_email, 'invoice_paid', {
                    amount: invoice.amount_paid / 100,
                    invoice_id: invoice.id
                });
            }
        }

        return res.json({ received: true });
    } catch (e: unknown) {
        return res.status(400).json({ error: `Webhook error: ${(e as Error).message}` });
    }
});

// ─── Telnyx Inbound SMS Webhook ───────────────────────────────────────────────

app.post('/webhooks/telnyx', async (req: Request, res: Response) => {
    try {
        const payload = req.body;
        
        // Telnyx embeds the message in data.payload for V2
        let message: any = null;
        if (payload?.data?.event_type === 'message.received') {
            message = payload.data.payload;
        } else if (payload?.record_type === 'message' && payload?.direction === 'inbound') {
            message = payload;
        }

        if (message) {
            const fromNumber = message.from?.phone_number;
            const textContent = message.text;

            console.log(`[ZERO DAY] 💬 Inbound SMS from ${fromNumber}: ${textContent}`);

            // 1. Identify client by phone number or create an anonymous ECHO profile
            // For now, we'll route directly to Genkit using the phone number as the session ID
            
            // 2. Call the Genkit Averi Chat flow synchronously (or async and reply later)
            // Since SMS has no timeout requirements like HTTP, we can await the response.
            try {
                // Genkit runs on port 4100; allow override via GENKIT_URL env var
                const genkitBase = process.env.GENKIT_URL || 'http://localhost:4100';
                const response = await fetch(`${genkitBase}/averiChatFlow`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: textContent,
                        sessionId: `telnyx-${fromNumber}`,
                        userId: fromNumber,
                        skipCritique: true // Speed optimisation for SMS — skip VERA inner-critic loop
                    })
                });

                if (response.ok) {
                    const result = await response.json() as { response?: string };
                    // averiChatFlow output schema uses `response` (not `result.text`)
                    const replyText = result.response || 'I received your message, but had trouble formulating a response.';

                    // 3. Send the AI response back to the user via SMS
                    await notifier.send({
                        type: 'raw_message',
                        to_phone: fromNumber,
                        client_name: fromNumber,
                        body: replyText
                    });

                    console.log(`[ZERO DAY] 📤 SMS reply sent to ${fromNumber}: ${replyText.slice(0, 80)}...`);
                } else {
                    const errText = await response.text().catch(() => response.statusText);
                    console.error(`[ZERO DAY] Genkit error ${response.status}: ${errText}`);
                }
            } catch (err: unknown) {
                console.error('[ZERO DAY] Genkit fetch failed:', (err as Error).message);
            }
        }

        return res.status(200).send('OK');
    } catch (e: unknown) {
        console.error('[ZERO DAY] Telnyx webhook error:', (e as Error).message);
        return res.status(500).json({ error: (e as Error).message });
    }
});

// â”€â”€â”€ Stripe Invoice Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.post('/invoices', async (req: Request, res: Response) => {
    try {
        const { project_id, client_email, client_name, line_items, due_days = 14, currency = 'usd' } = req.body as {
            project_id: string;
            client_email: string;
            client_name?: string;
            line_items: Array<{ description: string; amount: number; quantity?: number }>;
            due_days?: number;
            currency?: string;
        };

        if (!project_id || !client_email || !line_items?.length) {
            return res.status(400).json({ error: 'project_id, client_email, and line_items required' });
        }

        const Stripe = (await import('stripe')).default;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' as any });

        // Find or create Stripe customer
        const customers = await stripe.customers.list({ email: client_email, limit: 1 });
        const customer = customers.data.length > 0
            ? customers.data[0]
            : await stripe.customers.create({ email: client_email, name: client_name, metadata: { project_id } });

        // Create invoice
        const invoice = await stripe.invoices.create({
            customer: customer.id,
            collection_method: 'send_invoice',
            days_until_due: due_days,
            currency,
            metadata: { project_id },
            auto_advance: false,
        });

        // Add line items
        for (const item of line_items) {
            await stripe.invoiceItems.create({
                customer: customer.id,
                invoice: invoice.id,
                description: item.description,
                amount: Math.round(item.amount * 100),
                quantity: item.quantity ?? 1,
                currency,
            });
        }

        // Finalize
        const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

        // Notify client
        notifier.send({
            type: 'invoice_sent',
            to_email: client_email,
            client_name: client_name ?? 'Valued Client',
            project_title: `Invoice ${finalized.number ?? finalized.id}`,
            amount: (finalized.amount_due ?? 0) / 100,
            cta_url: finalized.hosted_invoice_url ?? '',
            cta_label: 'Pay Invoice',
        }).catch((err: Error) => console.warn('[ZERO DAY] Invoice notification failed:', err.message));

        return res.json({
            invoice_id: finalized.id,
            invoice_number: finalized.number,
            amount_due: (finalized.amount_due ?? 0) / 100,
            hosted_url: finalized.hosted_invoice_url,
            pdf_url: finalized.invoice_pdf,
            status: finalized.status,
            customer_id: customer.id,
        });
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

app.get('/invoices/:id', async (req: Request, res: Response) => {
    try {
        const Stripe = (await import('stripe')).default;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' as any });
        const invoice = await stripe.invoices.retrieve(req.params.id);
        return res.json({
            id: invoice.id,
            number: invoice.number,
            status: invoice.status,
            amount_due: (invoice.amount_due ?? 0) / 100,
            amount_paid: (invoice.amount_paid ?? 0) / 100,
            hosted_url: invoice.hosted_invoice_url,
            pdf_url: invoice.invoice_pdf,
            created: new Date((invoice.created ?? 0) * 1000).toISOString(),
            due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
        });
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

app.post('/invoices/:id/send', async (req: Request, res: Response) => {
    try {
        const Stripe = (await import('stripe')).default;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' as any });
        const invoice = await stripe.invoices.sendInvoice(req.params.id);
        return res.json({ status: invoice.status, sent: true, id: invoice.id });
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

// Payment Intent (one-off charges / partial payments)
app.post('/payment-intents', async (req: Request, res: Response) => {
    try {
        const { amount, currency = 'usd', description, client_email, metadata } = req.body as {
            amount: number;
            currency?: string;
            description?: string;
            client_email?: string;
            metadata?: Record<string, string>;
        };

        if (!amount) return res.status(400).json({ error: 'amount (in dollars) required' });

        const Stripe = (await import('stripe')).default;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' as any });

        let customerId: string | undefined;
        if (client_email) {
            const customers = await stripe.customers.list({ email: client_email, limit: 1 });
            customerId = customers.data.length > 0 ? customers.data[0].id : undefined;
        }

        const intent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100),
            currency,
            description,
            customer: customerId,
            metadata: metadata ?? {},
            automatic_payment_methods: { enabled: true },
        });

        return res.json({
            payment_intent_id: intent.id,
            client_secret: intent.client_secret,
            amount,
            currency,
            status: intent.status,
        });
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

// â”€â”€â”€ Retainer & Subscription Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.post('/retainers/invoice', (req: Request, res: Response) => {
    try {
        const input = RetainerInvoiceSchema.parse(req.body);
        const invoice = generateRetainerInvoice(input);
        return res.json(invoice);
    } catch (e: unknown) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: e.errors });
        return res.status(500).json({ error: (e as Error).message });
    }
});

app.post('/retainers/analyze', (req: Request, res: Response) => {
    try {
        const { plan, usage } = req.body as { 
            plan: z.infer<typeof RetainerPlanSchema>; 
            usage: z.infer<typeof UsageRecordSchema>; 
        };
        const summary = analyseUsage(plan, usage);
        return res.json(summary);
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

// â”€â”€â”€ Client Portal Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/clients/:id/portal', async (req: Request, res: Response) => {
    const profile = await echo.get(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Client not found' });

    // Filter projects by client_id (the correct field on Project)
    const projects = delivery.listProjects().filter((p) => p.client_id === req.params.id);
    const insightsList = echo.getInsights(req.params.id);

    return res.json({
        client: {
            id: req.params.id,
            name: profile.client_name,
            email: profile.client_email,
            relationship_health: profile.relationship_health,
            satisfaction_score: profile.satisfaction_score,
            joined: profile.first_project_date ?? profile.last_activity_date,
        },
        projects: projects.map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status,
            health: p.health,
            deliverables: p.deliverables.map((d) => ({
                id: d.id,
                title: d.title,
                status: d.status,
            })),
            created_at: p.created_at,
            updated_at: p.updated_at,
        })),
        insights: insightsList,
        portal_url: `${process.env.PORTAL_ORIGIN ?? 'https://portal.zerday.io'}/clients/${req.params.id}`,
        generated_at: new Date().toISOString(),
    });
});

app.post('/clients/:id/portal/magic-link', async (req: Request, res: Response) => {
    try {
        const profile = await echo.get(req.params.id);
        if (!profile) return res.status(404).json({ error: 'Client not found' });

        const token = generatePortalToken(req.params.id);
        const portalBase = process.env.PORTAL_ORIGIN ?? 'https://portal.zerday.io';
        const magicLink = `${portalBase}/portal/${token}`;

        // Send magic link via notifier â€” uses contract_sent type as a generic "link" email
        notifier.send({
            type: 'contract_sent',
            to_email: profile.client_email,
            client_name: profile.client_name,
            project_title: 'Client Portal Access',
            cta_url: magicLink,
            cta_label: 'Access Your Portal',
            body: 'This link expires in 15 minutes and can only be used once.',
        }).catch((err: Error) => console.warn('[ZERO DAY] Magic link notification failed:', err.message));

        return res.json({
            token,
            magic_link: magicLink,
            expires_at: new Date(Date.now() + PORTAL_TOKEN_TTL_MS).toISOString(),
            sent_to: profile.client_email,
        });
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

app.get('/portal/:token', (req: Request, res: Response) => {
    const clientId = validatePortalToken(req.params.token);
    if (!clientId) {
        return res.status(401).json({ error: 'Invalid or expired portal token. Please request a new magic link.' });
    }
    const portalBase = process.env.PORTAL_ORIGIN ?? 'https://portal.zerday.io';
    return res.redirect(302, `${portalBase}/clients/${clientId}?auth=verified`);
});

// â”€â”€â”€ Delivery Portal (The Velvet Rope) Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DELIVERY_TOKENS = new Map<string, { project_id: string; expires_at: number }>();
const DELIVERY_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateDeliveryToken(projectId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    DELIVERY_TOKENS.set(token, {
        project_id: projectId,
        expires_at: Date.now() + DELIVERY_TOKEN_TTL_MS,
    });
    return token;
}

function validateDeliveryToken(token: string): string | null {
    const record = DELIVERY_TOKENS.get(token);
    if (!record || Date.now() > record.expires_at) return null;
    return record.project_id;
}

app.post('/projects/:id/delivery-link', async (req: Request, res: Response) => {
    try {
        const project = delivery.getProject(req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const profile = await echo.get(project.client_id);
        if (!profile) return res.status(404).json({ error: 'Client not found' });

        const token = generateDeliveryToken(project.id);
        const portalBase = process.env.PORTAL_ORIGIN ?? 'https://portal.zerday.io';
        const magicLink = `${portalBase}?token=${token}`;

        // Send delivery notification to the client
        notifier.send({
            type: 'project_complete',
            to_email: profile.client_email,
            client_name: profile.client_name,
            project_title: project.title,
            cta_url: magicLink,
            cta_label: 'View Final Delivery',
            body: 'Your project is complete and the assets are ready for review.',
        }).catch((err: Error) => console.warn('[ZERO DAY] Delivery link notification failed:', err.message));

        return res.json({
            token,
            magic_link: magicLink,
            expires_at: new Date(Date.now() + DELIVERY_TOKEN_TTL_MS).toISOString(),
            sent_to: profile.client_email,
        });
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

app.get('/delivery/:token', (req: Request, res: Response) => {
    const projectId = validateDeliveryToken(req.params.token);
    if (!projectId) {
        return res.status(401).json({ error: 'Invalid or expired delivery token.' });
    }
    
    const project = delivery.getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Build the "Velvet Rope" payload
    const payload = {
        title: project.title,
        status: project.status, // e.g. 'completed'
        deliveredAt: project.updated_at,
        brief_summary: project.deliverables.find(d => d.title.includes('Brief'))?.client_feedback ?? 'Brief executed autonomously.',
        assets: project.deliverables
            .filter(d => (d.status === 'complete' || d.status === 'approved') && d.file_urls && d.file_urls.length > 0)
            .map(d => ({ name: d.title, url: d.file_urls[0] }))
    };
    
    // Add mock assets if none exist for demo purposes during Wave 28
    if (payload.assets.length === 0) {
        payload.assets = [
            { name: "Final Render - 01", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop" },
            { name: "Final Render - 02", url: "https://images.unsplash.com/photo-1604871000636-074fa5117945?q=80&w=2487&auto=format&fit=crop" },
            { name: "Final Render - 03", url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2670&auto=format&fit=crop" }
        ];
    }

    return res.json(payload);
});

app.post('/delivery/:token/approve', async (req: Request, res: Response) => {
    try {
        const projectId = validateDeliveryToken(req.params.token);
        if (!projectId) return res.status(401).json({ error: 'Invalid or expired delivery token.' });
        
        const project = delivery.getProject(projectId);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        
        // This simulates the client clicking "Approve Delivery"
        project.status = 'complete';
        project.health = 'on_track';
        project.updated_at = new Date().toISOString();
        
        // Let the studio know
        console.log(`[ZERO-DAY] Project ${projectId} (${project.title}) was APPROVED by client via Velvet Rope portal.`);
        
        return res.json({ success: true, status: project.status });
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

// â”€â”€â”€ Agent Network Provisioner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST /provision â€” Zero-Day W6 intake â†’ auto-assemble agent team + blueprint

import { startProvisioningWorker, getProvisioningStatus } from './delivery/provisioning-worker.js';

app.post('/provision', async (req: Request, res: Response) => {
    try {
        const input = ProvisionerInputSchema.parse(req.body);

        // Start the actual background execution worker instead of just mocking it
        const manifest = await startProvisioningWorker(input);

        // Fire intake notification to the new client (async, non-blocking)
        notifier.send({
            type: 'intake_received',
            to_email: input.clientEmail,
            client_name: input.clientName,
        }).catch((err: Error) => console.warn('[ZERO-DAY] Provision notification failed:', err.message));

        return res.json(manifest);
    } catch (e: unknown) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: e.errors });
        return res.status(500).json({ error: (e as Error).message });
    }
});

app.get('/client/:id/provisioning', (req: Request, res: Response) => {
    const manifest = getProvisioningStatus(req.params.id);
    if (!manifest) return res.status(404).json({ error: 'Provisioning manifest not found' });

    // We no longer simulate progression here! The background worker handles real progression concurrently
    return res.json(manifest);
});

// â”€â”€â”€ Analytics Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// All KPI computation is pure-function â€” no DB required, runs against
// data you POST in. POST the period + raw invoices/projects/clients
// and get back computed KPIs + optional HTML dashboard.

// POST /analytics/dashboard
// Full KPI dashboard â€” revenue, projects, clients â†’ JSON + HTML
app.post('/analytics/dashboard', async (req: Request, res: Response) => {
    try {
        const input = FullDashboardSchema.parse(req.body);
        const result = await generateDashboard(input);
        if (input.output_format === 'html' && result.html) {
            res.setHeader('Content-Type', 'text/html');
            return res.send(result.html);
        }
        return res.json(result);
    } catch (e: unknown) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: e.errors });
        return res.status(500).json({ error: (e as Error).message });
    }
});

// POST /analytics/revenue
// Lightweight revenue-only KPI compute
app.post('/analytics/revenue', (req: Request, res: Response) => {
    try {
        const input = RevenueMetricsSchema.parse(req.body);
        return res.json(computeRevenueKpis(input));
    } catch (e: unknown) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: e.errors });
        return res.status(500).json({ error: (e as Error).message });
    }
});

// GET /analytics/studio
// Quick studio-wide financial snapshot from ProfitabilityMonitor in-memory store
app.get('/analytics/studio', (_req: Request, res: Response) => {
    return res.json(profitability.getStudioSummary());
});

// â”€â”€â”€ Creative DNA Vectors (T20260308-696) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Generate + merge 12-axis aesthetic fingerprints for client personalisation

import { generateCreativeDNA, mergeCreativeDNA, vectorSimilarity, GenerateCreativeDNAInputSchema } from './intelligence/creative-dna.js';

const CreativeDNARequestSchema = z.object({
    client_id: z.string(),
    descriptors: z.array(z.string()).min(1),
    intake_answers: z.record(z.string()).optional(),
});

/**
 * POST /intelligence/creative-dna
 * Generate a Creative DNA aesthetic fingerprint from intake signals.
 */
app.post('/intelligence/creative-dna', (req: Request, res: Response) => {
    try {
        const input = CreativeDNARequestSchema.parse(req.body);
        const dna = generateCreativeDNA(input);
        return res.json(dna);
    } catch (e: unknown) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input', details: e.errors });
        return res.status(500).json({ error: (e as Error).message });
    }
});

/**
 * POST /intelligence/creative-dna/merge
 * Blend a previously generated DNA with new intake signals.
 */
app.post('/intelligence/creative-dna/merge', (req: Request, res: Response) => {
    try {
        const { existing, new_input } = req.body as {
            existing: ReturnType<typeof generateCreativeDNA>;
            new_input: z.infer<typeof GenerateCreativeDNAInputSchema>;
        };
        if (!existing || !new_input) return res.status(400).json({ error: 'existing and new_input required' });
        const merged = mergeCreativeDNA(existing, new_input);
        return res.json(merged);
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

/**
 * POST /intelligence/creative-dna/similarity
 * Cosine similarity between two aesthetic vectors (0â€“1).
 */
app.post('/intelligence/creative-dna/similarity', (req: Request, res: Response) => {
    try {
        const { vector_a, vector_b } = req.body as {
            vector_a: Parameters<typeof vectorSimilarity>[0];
            vector_b: Parameters<typeof vectorSimilarity>[1];
        };
        if (!vector_a || !vector_b) return res.status(400).json({ error: 'vector_a and vector_b required' });
        const similarity = vectorSimilarity(vector_a, vector_b);
        return res.json({ similarity });
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

// â”€â”€â”€ A2A Protocol (T20260308-506) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Inter-agent message dispatch endpoint â€” receives and forwards A2A messages.
// Mirrors the spec in packages/zero-day/src/flows/a2a-protocol.ts

import { A2AMessageSchema as A2AMsg, getA2AClient } from './flows/a2a-protocol.js';

/** In-memory A2A inbox (keyed by recipient agent ID) â€” production would use Redis */
const A2A_INBOX = new Map<string, unknown[]>();

function enqueueA2AMessage(to: string, msg: unknown): void {
    if (!A2A_INBOX.has(to)) A2A_INBOX.set(to, []);
    A2A_INBOX.get(to)!.push(msg);
}

/**
 * POST /a2a/send
 * Receive an outbound A2A message from a source agent. Validates schema,
 * persists to inbox queue, and forwards to dispatch server if reachable.
 */
app.post('/a2a/send', async (req: Request, res: Response) => {
    try {
        const msg = A2AMsg.parse(req.body);
        enqueueA2AMessage(msg.to, msg);

        // Fire-and-forward to sovereign dispatch (non-blocking)
        const dispatchUrl = process.env['DISPATCH_URL'] ?? 'http://127.0.0.1:5150';
        fetch(`${dispatchUrl}/api/a2a/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msg),
            signal: AbortSignal.timeout(2000),
        }).catch(() => null); // fire-and-forget

        return res.json({ accepted: true, message_id: msg.id, queued_for: msg.to });
    } catch (e: unknown) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid A2A message', details: e.errors });
        return res.status(500).json({ error: (e as Error).message });
    }
});

/**
 * GET /a2a/inbox/:agent_id
 * Drain the A2A inbox for the given agent â€” returns all pending messages.
 */
app.get('/a2a/inbox/:agent_id', (req: Request, res: Response) => {
    const messages = A2A_INBOX.get(req.params.agent_id) ?? [];
    A2A_INBOX.delete(req.params.agent_id); // drain
    return res.json({ agent_id: req.params.agent_id, messages, count: messages.length });
});

/**
 * POST /a2a/dispatch
 * Internal dispatch endpoint â€” receives forwarded A2A messages from upstream.
 * Agents that have registered handlers via getA2AClient().on() will be invoked.
 */
app.post('/a2a/dispatch', (req: Request, res: Response) => {
    try {
        const msg = A2AMsg.parse(req.body);
        const client = getA2AClient(msg.to);
        client.receive(msg);
        enqueueA2AMessage(msg.to, msg);
        return res.json({ dispatched: true, message_id: msg.id });
    } catch (e: unknown) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid A2A envelope', details: e.errors });
        return res.status(500).json({ error: (e as Error).message });
    }
});

// â”€â”€â”€ Live GTM Analytics Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Real-time funnel tracking: intake â†’ proposal â†’ contract â†’ payment
// GET  /analytics/live     â€” SSE stream of all GTM events as they happen
// POST /analytics/events   â€” Manually record a GTM funnel event
// GET  /analytics/funnel   â€” Current funnel metrics (last 30 days)

import {
    recordGTMEvent,
    getRecentEvents,
    computeFunnelMetrics,
    subscribeToGTMEvents,
    GTMEventSchema,
    type GTMEvent,
} from './analytics/live-gtm.js';

/** SSE endpoint â€” keeps connection open and streams events as they arrive */
app.get('/analytics/live', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Replay last 20 events to new subscriber
    const recent = getRecentEvents(20).slice().reverse();
    for (const event of recent) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    const unsubscribe = subscribeToGTMEvents((event: GTMEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    req.on('close', () => {
        unsubscribe();
    });
});

/** POST /analytics/events â€” Record a GTM funnel event */
app.post('/analytics/events', (req: Request, res: Response) => {
    try {
        const { type, client_email, client_name, session_id, project_id, amount, metadata } = req.body as {
            type: string;
            client_email: string;
            client_name?: string;
            session_id?: string;
            project_id?: string;
            amount?: number;
            metadata?: Record<string, string>;
        };

        // Parse (Zod will validate the type enum)
        const raw = GTMEventSchema.omit({ id: true, timestamp: true }).parse({
            type, client_email, client_name, session_id, project_id, amount, metadata,
        });

        const recorded = recordGTMEvent(raw);
        return res.status(201).json(recorded);
    } catch (e: unknown) {
        if (e instanceof z.ZodError) return res.status(400).json({ error: 'Invalid event', details: e.errors });
        return res.status(500).json({ error: (e as Error).message });
    }
});

/** GET /analytics/funnel?days=30 â€” Funnel conversion metrics */
app.get('/analytics/funnel', (req: Request, res: Response) => {
    const days = Math.min(parseInt(req.query['days'] as string ?? '30', 10) || 30, 365);
    const periodEnd = new Date();
    const periodStart = new Date(Date.now() - days * 86_400_000);
    const events = getRecentEvents(2000);
    const metrics = computeFunnelMetrics(events, periodStart, periodEnd);
    return res.json(metrics);
});

// â”€â”€â”€ CRM Pipeline Routes (Wave 34) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { CRMSyncService } from './intelligence/crm-sync.js';

const crm = new CRMSyncService();

// Seed demo records on first boot if CRM is empty
(function seedCRMDemo() {
    if (crm.getAll().length > 0) return;
    const now = new Date().toISOString();
    const demos: Parameters<typeof crm.upsert>[0][] = [
        { prospect_id: 'demo-001', company: 'NovaLabs', contact_name: 'Sam Patel', email: 'sam@novalabs.io', lead_score: { score: 91, tier: 'hot', signals: [], recommendations: [], evaluated_at: now }, stage: 'onboarding', deal_value: 96000, outreach_strategy: 'Executive briefing â†’ product demo â†’ pilot proposal', next_action: 'Send portal access credentials', entered_at: now, updated_at: now, source: 'inbound' },
        { prospect_id: 'demo-002', company: 'Axiom.io', contact_name: 'Jordan Kim', email: 'jordan@axiom.io', lead_score: { score: 85, tier: 'hot', signals: [], recommendations: [], evaluated_at: now }, stage: 'engaged', deal_value: 48000, outreach_strategy: 'Peer reference call â†’ technical walkthrough', next_action: 'Book exec briefing this week', entered_at: now, updated_at: now, source: 'intake' },
        { prospect_id: 'demo-003', company: 'Meridian Design', contact_name: 'Alex Torres', email: 'alex@meridiandesign.co', lead_score: { score: 62, tier: 'warm', signals: [], recommendations: [], evaluated_at: now }, stage: 'qualified', deal_value: 24000, outreach_strategy: 'Case study share â†’ async video demo', next_action: 'Send case study + follow up in 5 days', entered_at: now, updated_at: now, source: 'referral' },
        { prospect_id: 'demo-004', company: 'Vantage Media', contact_name: 'Riley Chen', email: 'riley@vantagemedia.com', lead_score: { score: 38, tier: 'cool', signals: [], recommendations: [], evaluated_at: now }, stage: 'lead', deal_value: 18000, outreach_strategy: 'Content nurture â†’ capability overview', next_action: 'Add to weekly newsletter sequence', entered_at: now, updated_at: now, source: 'outbound' },
    ];
    for (const d of demos) crm.upsert(d);
    console.log('[ZERO-DAY] CRM seeded with 4 demo prospects');
})();

// GET /api/crm/pipeline â€” all records
app.get('/api/crm/pipeline', (_req: Request, res: Response) => {
    return res.json(crm.getAll());
});

// GET /api/crm/summary â€” aggregate stats
app.get('/api/crm/summary', (_req: Request, res: Response) => {
    return res.json(crm.getSummary());
});

// GET /api/crm/pipeline/:stage â€” filter by stage
app.get('/api/crm/pipeline/:stage', (req: Request, res: Response) => {
    return res.json(crm.getByStage(req.params.stage as Parameters<typeof crm.getByStage>[0]));
});

// POST /api/crm/upsert â€” upsert from pipeline flow output
app.post('/api/crm/upsert', (req: Request, res: Response) => {
    try {
        crm.upsert(req.body as Parameters<typeof crm.upsert>[0]);
        return res.json({ ok: true, total: crm.getAll().length });
    } catch (e: unknown) {
        return res.status(400).json({ error: (e as Error).message });
    }
});

// â”€â”€â”€ GTM Analytics Dashboard â€” T20260309-702 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Route: /dashboard/gtm  â€” Live Revenue Tracking
// Built with atlas-live SSE + funnel engine from analytics/live-gtm.ts

// GET /dashboard/gtm â€” Premium dark HTML dashboard with live SSE injection
app.get('/dashboard/gtm', (_req: Request, res: Response) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const events = getRecentEvents(500);
    const funnel = computeFunnelMetrics(events, monthStart, now);
    const studio = profitability.getStudioSummary();

    // Derived MRR / ARR (from studio financials)
    const mrr = (studio as { monthly_recurring_revenue?: number }).monthly_recurring_revenue ?? 0;
    const arr = mrr * 12;
    const pipelineValue = Object.values(funnel.stages).reduce(
        (s, st) => s + st.entered, 0
    ) * 2500; // $2.5k avg deal estimate

    const funnelBars = (['Intake', 'Proposal', 'Contract', 'Payment', 'Delivery'] as const)
        .map(stage => {
            const s = funnel.stages[stage];
            return `
            <div class="funnel-row">
              <div class="funnel-label">${stage}</div>
              <div class="funnel-bar-wrap">
                <div class="funnel-bar" style="width:${Math.min(100, s.entered * 4 + 2)}%">
                  <span>${s.entered}</span>
                </div>
              </div>
              <div class="funnel-rate">${s.conversion_rate_pct}%</div>
            </div>`;
        }).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Zero Day â€” GTM Analytics</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',sans-serif;background:#0a0a0f;color:#f5f0e8;min-height:100vh;padding:40px}
    h1{font-family:'Playfair Display',serif;font-size:36px;font-weight:700;letter-spacing:-1px;margin-bottom:4px}
    .sub{color:rgba(245,240,232,0.4);font-size:13px;letter-spacing:2px;text-transform:uppercase;margin-bottom:40px}
    .live-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;margin-right:8px;animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px;margin-bottom:40px}
    .card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:24px;transition:border-color .2s}
    .card:hover{border-color:rgba(184,115,51,0.5)}
    .card-label{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(245,240,232,0.4);margin-bottom:12px}
    .card-val{font-size:38px;font-weight:800;line-height:1;color:#f5f0e8}
    .card-sub{font-size:12px;color:#b87333;margin-top:8px;font-weight:600}
    .section-title{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#b87333;font-weight:700;margin-bottom:20px}
    .funnel-row{display:flex;align-items:center;gap:16px;margin-bottom:12px}
    .funnel-label{font-size:12px;width:70px;color:rgba(245,240,232,0.6);font-weight:600}
    .funnel-bar-wrap{flex:1;height:32px;background:rgba(255,255,255,0.05);border-radius:6px;overflow:hidden}
    .funnel-bar{height:100%;background:linear-gradient(90deg,#b87333,#d4a96c);border-radius:6px;display:flex;align-items:center;padding:0 10px;font-size:12px;font-weight:700;min-width:32px;transition:width 1s ease}
    .funnel-rate{font-size:12px;color:#b87333;font-weight:600;width:40px;text-align:right}
    .events-log{background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;max-height:280px;overflow-y:auto;font-family:monospace;font-size:12px}
    .event-row{padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);color:rgba(245,240,232,0.7)}
    .event-type{color:#b87333;font-weight:700}
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:40px}
    @media(max-width:768px){.two-col{grid-template-columns:1fr}}
    .stat-badge{display:inline-block;padding:4px 10px;border-radius:20px;background:rgba(34,197,94,0.15);color:#22c55e;font-size:11px;font-weight:700;border:1px solid rgba(34,197,94,0.3)}
  </style>
</head>
<body>
  <h1>GTM Analytics</h1>
  <div class="sub"><span class="live-dot"></span>Live Revenue Tracking &bull; Whole Trout Media &bull; Zero Day</div>

  <div class="grid" id="kpi-grid">
    <div class="card"><div class="card-label">MRR</div><div class="card-val" id="mrr">$${mrr.toLocaleString()}</div><div class="card-sub">Monthly Recurring</div></div>
    <div class="card"><div class="card-label">ARR</div><div class="card-val" id="arr">$${arr.toLocaleString()}</div><div class="card-sub">Annual Run Rate</div></div>
    <div class="card"><div class="card-label">Pipeline Value</div><div class="card-val" id="pipeline">$${pipelineValue.toLocaleString()}</div><div class="card-sub">${funnel.stages['Intake'].entered} active leads</div></div>
    <div class="card"><div class="card-label">Conversion Rate</div><div class="card-val" id="cvr">${funnel.overall_conversion_rate_pct}%</div><div class="card-sub">Intake â†’ Payment</div></div>
    <div class="card"><div class="card-label">Deal Velocity</div><div class="card-val">${funnel.avg_deal_velocity_days}d</div><div class="card-sub">Avg Intake â†’ Close</div></div>
    <div class="card"><div class="card-label">Hottest Stage</div><div class="card-val" style="font-size:22px">${funnel.hottest_stage}</div><div class="card-sub stat-badge">Active</div></div>
  </div>

  <div class="two-col">
    <div>
      <div class="section-title">Funnel Performance</div>
      <div id="funnel">${funnelBars}</div>
    </div>
    <div>
      <div class="section-title">Live Event Stream</div>
      <div class="events-log" id="event-log">
        ${events.slice(0, 20).map(e => `<div class="event-row"><span class="event-type">${e.type}</span> &nbsp;${e.client_name ?? e.client_email} &nbsp;<span style="color:rgba(245,240,232,0.3)">${new Date(e.timestamp).toLocaleTimeString()}</span></div>`).join('') || '<div class="event-row" style="color:rgba(245,240,232,0.3)">Waiting for GTM events...</div>'}
      </div>
    </div>
  </div>

  <script>
    // SSE live feed
    const evtSrc = new EventSource('/events/gtm');
    const log = document.getElementById('event-log');
    evtSrc.addEventListener('gtm_event', (e) => {
      const ev = JSON.parse(e.data);
      const row = document.createElement('div');
      row.className = 'event-row';
      row.innerHTML = '<span class="event-type">' + ev.type + '</span> &nbsp;' + (ev.client_name || ev.client_email) + ' &nbsp;<span style="color:rgba(245,240,232,0.3)">' + new Date(ev.timestamp).toLocaleTimeString() + '</span>';
      log.prepend(row);
      if (log.children.length > 50) log.lastElementChild?.remove();
    });
    // Poll KPIs every 30s
    setInterval(async () => {
      try {
        const r = await fetch('/api/gtm/snapshot'); const d = await r.json();
        document.getElementById('cvr').textContent = d.funnel?.overall_conversion_rate_pct + '%';
        document.getElementById('pipeline').textContent = '$' + d.pipeline_value?.toLocaleString();
      } catch {}
    }, 30_000);
  </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
});

// GET /events/gtm â€” SSE stream for live GTM events (Article XX: real-time, no polling)
app.get('/events/gtm', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Send a heartbeat every 25s to keep connection alive
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25_000);

    const unsubscribe = subscribeToGTMEvents((event: GTMEvent) => {
        res.write(`event: gtm_event\ndata: ${JSON.stringify(event)}\n\n`);
    });

    req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
    });
});

// GET /api/gtm/snapshot â€” JSON snapshot of current funnel state
app.get('/api/gtm/snapshot', (_req: Request, res: Response) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const events = getRecentEvents(500);
    const funnel = computeFunnelMetrics(events, monthStart, now);
    const studio = profitability.getStudioSummary();
    const mrr = (studio as { monthly_recurring_revenue?: number }).monthly_recurring_revenue ?? 0;

    res.json({
        generated_at: now.toISOString(),
        mrr,
        arr: mrr * 12,
        pipeline_value: funnel.stages['Intake'].entered * 2500,
        funnel,
        recent_events_count: events.length,
    });
});

// POST /api/gtm/events â€” Record a GTM event (for testing / external triggers)
app.post('/api/gtm/events', (req: Request, res: Response) => {
    try {
        const { type, client_email, client_name, amount, metadata } = req.body as {
            type: string;
            client_email: string;
            client_name?: string;
            amount?: number;
            metadata?: Record<string, string>;
        };
        if (!type || !client_email) {
            return res.status(400).json({ error: 'type and client_email required' });
        }
        const event = recordGTMEvent({
            type: type as GTMEvent['type'],
            client_email,
            client_name,
            amount,
            metadata,
        });
        return res.status(201).json(event);
    } catch (e: unknown) {
        return res.status(500).json({ error: (e as Error).message });
    }
});

// GET /api/gtm/events â€” Paginated event log
app.get('/api/gtm/events', (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query['limit'] ?? 100), 500);
    res.json({ events: getRecentEvents(limit), total: getRecentEvents(limit).length });
});

// â”€â”€â”€ Start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


const PORT = process.env.ZERO_DAY_PORT || 9000;
const server = app.listen(PORT, () => {
    console.log(`\nðŸ ZERO DAY API Server live on port ${PORT}`);
    console.log(`   /intake  /contracts  /projects  /clients  /financials`);
    console.log(`   /invoices  /payment-intents  /portal/:token`);
    console.log(`   /analytics  /provision`);
    console.log(`   Stripe webhook: /webhooks/stripe`);
    console.log(`   Auto-chain: ${process.env.REDIS_URL ? 'âœ… Redis â†’ campaign' : 'âš ï¸  Redis not configured (set REDIS_URL)'}\n`);
});

const shutdown = async () => {
    console.log('[ZERO-DAY] Shutting down gracefully...');
    await Promise.allSettled([
        briefPublisher.disconnect(),
        closeGDriveClient(),
        shutdownPostHog(),
    ]);
    server.close(() => process.exit(0));
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);

export default app;
