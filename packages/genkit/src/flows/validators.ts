/**
 * Validator Hive — SENTINEL, ARCHON, PROOF, HARBOR, RAM_CREW
 * Role: Quality Gates (Constitutional Article VI)
 * Access: Studio | Mode: VALIDATE
 *
 * SENTINEL: Security scanning — no secrets, no vulnerabilities, no exposed endpoints
 * ARCHON:   Architecture compliance — separation of concerns, dependency direction
 * PROOF:    Behavioral correctness — does the code actually do what it says?
 * HARBOR:   Test coverage — ensures Article XIV (Testing Mandate) is met
 * RAM_CREW: QA/Integration — end-to-end quality check before ship
 */

import { z } from 'genkit';
import { Resend } from 'resend';
import { ai } from '../index.js';
import { memoryBus, type MemoryEntry } from '@cle/memory';
import { LEXFlow } from './lex-compass.js';

async function sendValidationLinkEmail(p: {
    client_email: string;
    client_name: string;
    project_name: string;
    validation_url: string;
}): Promise<void> {
    const fromEmail = `"${process.env.FROM_NAME || 'Creative Liberation Engine'}" <${process.env.FROM_EMAIL || 'inquiries@creativeliberationengine.org'}>`;
    const subject = `ACTION REQUIRED: Validate deployment for ${p.project_name}`;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:system-ui,sans-serif;line-height:1.5;padding:24px;">
<h2>Ship complete. Validation required.</h2>
<p>Hi ${p.client_name},</p>
<p>Our autonomous SHIP agents have completed code execution for <strong>${p.project_name}</strong>.</p>
<p>Please use the link below to validate the deployment before it goes live to production.</p>
<p><a href="${p.validation_url}">Validate deployment</a></p>
</body></html>`;

    // Priority 1: Cloudflare Worker API (agent-mail)
    if (process.env.AGENT_MAIL_API_KEY) {
        try {
            const url = process.env.AGENT_MAIL_URL || 'https://agent-mail.wholetrou.workers.dev/api/send';
            const bodyText = `Hi ${p.client_name},\n\nOur autonomous SHIP agents have completed code execution for ${p.project_name}.\n\nPlease use the link below to validate the deployment before it goes live to production:\n${p.validation_url}`;
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': process.env.AGENT_MAIL_API_KEY,
                },
                body: JSON.stringify({
                    to: p.client_email,
                    subject,
                    body_text: bodyText,
                    body_html: html,
                })
            });
            if (resp.ok) {
                console.log(`[RAM_CREW] ✅ Validation email sent via Cloudflare to ${p.client_email}`);
                return;
            }
            console.error(`[RAM_CREW] Cloudflare Worker returned status ${resp.status}`);
        } catch (e: any) {
            console.error(`[RAM_CREW] Cloudflare send failed: ${e.message}`);
        }
    }

    const key = process.env.RESEND_API_KEY;
    if (!key) {
        console.log(`[RAM_CREW] 📧 (skip) No RESEND_API_KEY — validation email for ${p.client_email}`);
        return;
    }
    const resend = new Resend(key);
    await resend.emails.send({
        from: fromEmail,
        to: p.client_email,
        bcc: process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : undefined,
        subject,
        html,
    });
}

// ─── SHARED VALIDATE INFRASTRUCTURE ─────────────────────────────────────────

const ValidatorInputSchema = z.object({
    code: z.string().describe('Code artifact to validate'),
    filePath: z.string().optional(),
    context: z.string().optional().describe('Architecture context, spec, or requirements'),
    sessionId: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// SENTINEL — Security Scanner
// ─────────────────────────────────────────────────────────────────────────────

const SentinelOutputSchema = z.object({
    verdict: z.enum(['PASS', 'FAIL', 'WARNING']),
    vulnerabilities: z.array(z.object({
        severity: z.enum(['critical', 'high', 'medium', 'low']),
        category: z.string(),
        line: z.number().optional(),
        detail: z.string(),
        fix: z.string(),
    })).default([]),
    secretsFound: z.boolean().default(false),
    sentinelSignature: z.literal('SENTINEL').default('SENTINEL'),
});

export const SENTINELFlow = ai.defineFlow(
    { name: 'SENTINEL', inputSchema: ValidatorInputSchema, outputSchema: SentinelOutputSchema },
    async (input): Promise<z.infer<typeof SentinelOutputSchema>> => {
        console.log(`[SENTINEL] 🛡️  Security scan${input.filePath ? `: ${input.filePath}` : ''}`);

        return memoryBus.withMemory('SENTINEL', `security: ${input.filePath || 'code'}`, ['validator-hive', 'security'], async (_ctx: MemoryEntry[]) => {
            const { output } = await ai.generate({
                model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
                system: `You are SENTINEL — the Security Scanner. You enforce Constitutional Article XVI.
Scan for: hardcoded secrets, API keys, passwords, exposed endpoints, SQL injection, XSS, CSRF, 
insecure dependencies, eval() usage, prototype pollution, unvalidated input.
Be thorough. A missed vulnerability is a constitutional violation.`,
                prompt: `Scan this code for security vulnerabilities:\n\n${input.code.slice(0, 8000)}`,
                output: { schema: SentinelOutputSchema },
                config: { temperature: 0.05 },
            });

            const result = { ...(output ?? { verdict: 'WARNING' as const, vulnerabilities: [], secretsFound: false }), sentinelSignature: 'SENTINEL' as const };
            if (result.verdict === 'FAIL') {
                console.error(`[SENTINEL] ❌ FAIL — ${result.vulnerabilities.filter(v => v.severity === 'critical').length} critical vulnerabilities`);
            } else {
                console.log(`[SENTINEL] ${result.verdict === 'PASS' ? '✅' : '⚠️'} ${result.verdict}`);
            }
            return result;
        });
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// ARCHON — Architecture Compliance
// ─────────────────────────────────────────────────────────────────────────────

const ArchonOutputSchema = z.object({
    verdict: z.enum(['PASS', 'FAIL', 'WARNING']),
    violations: z.array(z.object({
        pattern: z.string(),
        severity: z.enum(['critical', 'warning']),
        detail: z.string(),
    })).default([]),
    coupling: z.enum(['low', 'medium', 'high']).describe('Estimated coupling level'),
    archonSignature: z.literal('ARCHON').default('ARCHON'),
});

export const ARCHONFlow = ai.defineFlow(
    { name: 'ARCHON', inputSchema: ValidatorInputSchema, outputSchema: ArchonOutputSchema },
    async (input): Promise<z.infer<typeof ArchonOutputSchema>> => {
        console.log(`[ARCHON] 🏛️  Architecture compliance scan`);

        const { output } = await ai.generate({
            model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
            system: `You are ARCHON — the Architecture Compliance scanner.
Check for: circular dependencies, God Objects (>500 lines doing everything), 
violated DIP (high-level depending on low-level), missing abstraction layers,
violation of single responsibility, and tight coupling.
Constitutional: Article I (Separation of Powers applies to code too).`,
            prompt: `Architecture scan:\n\n${input.code.slice(0, 8000)}${input.context ? `\n\nSpec:\n${input.context}` : ''}`,
            output: { schema: ArchonOutputSchema },
        });

        return { ...(output ?? { verdict: 'WARNING' as const, violations: [], coupling: 'medium' as const }), archonSignature: 'ARCHON' };
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// PROOF — Behavioral Correctness
// ─────────────────────────────────────────────────────────────────────────────

const ProofOutputSchema = z.object({
    verdict: z.enum(['PASS', 'FAIL', 'UNCERTAIN']),
    behaviors: z.array(z.object({
        behavior: z.string(),
        verified: z.boolean(),
        evidence: z.string(),
    })).default([]),
    missingCases: z.array(z.string()).default([]).describe('Edge cases not handled'),
    proofSignature: z.literal('PROOF').default('PROOF'),
});

export const PROOFFlow = ai.defineFlow(
    { name: 'PROOF', inputSchema: ValidatorInputSchema, outputSchema: ProofOutputSchema },
    async (input): Promise<z.infer<typeof ProofOutputSchema>> => {
        console.log(`[PROOF] 🔬 Behavioral correctness analysis`);

        const { output } = await ai.generate({
            model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
            system: `You are PROOF — the Behavioral Correctness analyzer.
Verify: does the code actually do what its comments/docs claim?
Check for: off-by-one errors, missing null checks, unhandled promise rejections,
incorrect async handling, state mutation bugs, incorrect type coercions.
List verified behaviors and flag missing edge cases.`,
            prompt: `Behavioral analysis:\n\n${input.code.slice(0, 8000)}`,
            output: { schema: ProofOutputSchema },
        });

        return { ...(output ?? { verdict: 'UNCERTAIN' as const, behaviors: [], missingCases: [] }), proofSignature: 'PROOF' };
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// HARBOR — Test Coverage Guardian
// ─────────────────────────────────────────────────────────────────────────────

const HarborOutputSchema = z.object({
    verdict: z.enum(['PASS', 'FAIL']),
    estimatedCoverage: z.number().min(0).max(100).describe('Estimated test coverage %'),
    missingTests: z.array(z.string()).default([]).describe('Functions/paths lacking tests'),
    testSuggestions: z.array(z.string()).default([]).describe('Suggested test cases to write'),
    harborSignature: z.literal('HARBOR').default('HARBOR'),
});

export const HARBORFlow = ai.defineFlow(
    { name: 'HARBOR', inputSchema: ValidatorInputSchema, outputSchema: HarborOutputSchema },
    async (input): Promise<z.infer<typeof HarborOutputSchema>> => {
        console.log(`[HARBOR] ⚓ Test coverage check`);

        const { output } = await ai.generate({
            model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
            system: `You are HARBOR — the Test Coverage Guardian. You enforce Constitutional Article XIV (Testing Mandate).
Untested code is unshipped code. Estimate coverage, identify untested paths, suggest specific test cases.
Minimum acceptable: 80% estimated coverage for PASS.`,
            prompt: `Test coverage analysis:\n\n${input.code.slice(0, 6000)}`,
            output: { schema: HarborOutputSchema },
        });

        return { ...(output ?? { verdict: 'FAIL' as const, estimatedCoverage: 0, missingTests: ['all'], testSuggestions: [] }), harborSignature: 'HARBOR' };
    }
);

// ─────────────────────────────────────────────────────────────────────────────
// RAM_CREW — Complete VALIDATE Mode Orchestrator
// Runs all validators in parallel and produces a final ship decision
// ─────────────────────────────────────────────────────────────────────────────

const RamCrewOutputSchema = z.object({
    shipDecision: z.enum(['SHIP', 'HOLD', 'REJECT']),
    overallScore: z.number().min(0).max(100),
    gatesResults: z.object({
        sentinel: z.string(),
        archon: z.string(),
        proof: z.string(),
        harbor: z.string(),
        lex: z.string(),
    }),
    blockers: z.array(z.string()).default([]),
    ramSignature: z.literal('RAM_CREW').default('RAM_CREW'),
});

export const RAMCREWFlow = ai.defineFlow(
    { name: 'RAM_CREW', inputSchema: ValidatorInputSchema, outputSchema: RamCrewOutputSchema },
    async (input): Promise<z.infer<typeof RamCrewOutputSchema>> => {
        console.log(`[RAM_CREW] 🚀 Full VALIDATE mode — running all 5 gates in parallel`);

        // Run all validators in parallel — Constitutional Article VI
        const [sentinel, archon, proof, harbor, lex] = await Promise.allSettled([
            SENTINELFlow(input),
            ARCHONFlow(input),
            PROOFFlow(input),
            HARBORFlow(input),
            LEXFlow({ scanType: 'postflight', content: input.code, sessionId: input.sessionId }),
        ]);

        const s = sentinel.status === 'fulfilled' ? sentinel.value : null;
        const a = archon.status === 'fulfilled' ? archon.value : null;
        const p = proof.status === 'fulfilled' ? proof.value : null;
        const h = harbor.status === 'fulfilled' ? harbor.value : null;
        const l = lex.status === 'fulfilled' ? lex.value : null;

        const gatesResults = {
            sentinel: s?.verdict ?? 'ERROR',
            archon: a?.verdict ?? 'ERROR',
            proof: p?.verdict ?? 'ERROR',
            harbor: h?.verdict ?? 'ERROR',
            lex: l?.verdict ?? 'ERROR',
        };

        const blockers: string[] = [];
        if (s?.verdict === 'FAIL') blockers.push(`SENTINEL: ${s.vulnerabilities.filter(v => v.severity === 'critical').length} critical security issues`);
        if (a?.verdict === 'FAIL') blockers.push(`ARCHON: Architecture violations`);
        if (p?.verdict === 'FAIL') blockers.push(`PROOF: Behavioral correctness failed`);
        if (h?.verdict === 'FAIL') blockers.push(`HARBOR: Test coverage below 80%`);
        if (l?.verdict === 'HALT') blockers.push(`LEX: Constitutional HALT`);

        const passCount = Object.values(gatesResults).filter(v => v === 'PASS').length;
        const overallScore = Math.round((passCount / 5) * 100);
        const shipDecision = blockers.length === 0 ? 'SHIP' : blockers.length <= 2 ? 'HOLD' : 'REJECT';

        console.log(`[RAM_CREW] ${shipDecision} | Score: ${overallScore}% | Blockers: ${blockers.length}`);

        // Automatically fire validation notification to client / admin if configured.
        if (shipDecision !== 'REJECT') {
            const adminEmail = process.env.ADMIN_EMAIL || 'inquiries@creativeliberationengine.org';
            try {
                await sendValidationLinkEmail({
                    client_email: adminEmail,
                    client_name: 'Operator',
                    project_name: input.filePath ? `Validation for ${input.filePath.split('/').pop()}` : 'System Validation',
                    validation_url: process.env.VALIDATION_PORTAL_URL || 'https://admin.cleengine.co/validate',
                });
            } catch (err) {
                 console.warn(`[RAM_CREW] ⚠️ Failed to send validation notification: ${err}`);
            }
        }

        return { shipDecision, overallScore, gatesResults, blockers, ramSignature: 'RAM_CREW' };
    }
);

