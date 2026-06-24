import { z } from 'genkit';
import { ai } from '../index.js';
import { memoryBus } from '@cle/memory';
import { resolveModel } from '../config/model-registry.js';
import { applyOmnipresenceCache } from '../core/context-cache.js';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getVaultDir(subfolder: string): string {
    const nasPath = process.env.OBSIDIAN_VAULT_PATH || '/app/creative-liberation-engine/runtime/nexus-vault';
    const parentPath = path.dirname(nasPath);
    if (fs.existsSync(parentPath)) {
        const p = path.join(nasPath, subfolder);
        fs.mkdirSync(p, { recursive: true });
        return p;
    }
    const localPath = path.resolve(process.cwd(), 'runtime/nexus-vault');
    const p = path.join(localPath, subfolder);
    fs.mkdirSync(p, { recursive: true });
    return p;
}

function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '')
        .slice(0, 50);
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const TripleseatExtractionSchema = z.object({
    eventId: z.string(),
    eventName: z.string(),
    locationName: z.string(),
    roomName: z.string(),
    guestCount: z.number().default(0),
    startDate: z.string(),
    endDate: z.string(),
    contactName: z.string(),
    avRequirements: z.string().describe('Technical AV, audio, video, lighting or screen requirements mentioned'),
    beoNotes: z.string().describe('General notes, setups, or description from the BEO'),
});

const PrismExtractionSchema = z.object({
    showId: z.string(),
    artistName: z.string(),
    venueName: z.string(),
    showDate: z.string(),
    ticketScaling: z.string().describe('Ticket scaling, capacities, and tiers'),
    dealStructure: z.string().describe('Splits, guarantees, backend percentages, and splits'),
    payoutEstimate: z.number().describe('Estimated payout or gross potential for the show'),
    promoterExpenses: z.string().describe('Promoter expenses and caps'),
    crewSchedule: z.string().describe('Run of show timeline, load-in, doors, soundcheck, performance times'),
});

const LexAuditSchema = z.object({
    status: z.enum(['approved', 'warning', 'action_required']),
    riskScore: z.number().describe('Contract risk score from 0 (low) to 100 (critical)'),
    flags: z.array(z.string()).describe('List of deal risks, over-cap expenses, or contract anomalies'),
    recommendations: z.array(z.string()).describe('Strategic advice for the operator or booking agent'),
});

// ── Flows ────────────────────────────────────────────────────────────────────

export const tripleseatIngestFlow = ai.defineFlow(
    {
        name: 'tripleseatIngest',
        inputSchema: z.object({
            payload: z.any().describe('Raw webhook payload from Tripleseat'),
        }),
        outputSchema: z.any(),
    },
    async (input) => {
        console.log(`[TRIPLESEAT] 📥 Ingesting event webhook payload...`);

        // Use LLM to extract structured fields from raw webhook payload
        const promptText = `Extract structured event information from the following Tripleseat webhook payload:\n\n${JSON.stringify(input.payload, null, 2)}`;
        
        const response = await ai.generate(applyOmnipresenceCache({
            model: resolveModel('cloud:fast'),
            system: 'You are an expert event data extraction assistant. Parse all fields carefully, matching names and numbers exactly.',
            prompt: promptText,
            output: { schema: TripleseatExtractionSchema },
            config: { temperature: 0.1 }
        }));

        const data = response.output;
        if (!data) throw new Error('[TRIPLESEAT] Failed to extract event data from payload');

        console.log(`[TRIPLESEAT] Extracted Event: "${data.eventName}" (${data.eventId})`);

        // 1. Generate Obsidian markdown file
        const vaultDir = getVaultDir('Tripleseat');
        const filename = `IE-EVT-${data.eventId.slice(0, 4)}_${slugify(data.eventName)}.md`;
        const filepath = path.join(vaultDir, filename);

        const mdContent = `---
type: event
platform: tripleseat
eventId: "${data.eventId}"
eventName: "${data.eventName}"
location: "${data.locationName}"
room: "${data.roomName}"
guestCount: ${data.guestCount}
startDate: "${data.startDate}"
endDate: "${data.endDate}"
contact: "${data.contactName}"
ingestedAt: "${new Date().toISOString()}"
---

# Event: ${data.eventName}

## Event Details
- **Space/Room**: ${data.roomName} at ${data.locationName}
- **Date/Time**: ${data.startDate} to ${data.endDate}
- **Guest Count**: ${data.guestCount}
- **Contact**: ${data.contactName}

## Technical & AV Requirements
${data.avRequirements || 'No specific technical or AV requirements noted.'}

## BEO Setup & General Notes
${data.beoNotes || 'No setup notes or descriptions provided.'}

## Raw Source Reference
Ingested from Tripleseat webhook event ID: \`${data.eventId}\`
`;

        fs.writeFileSync(filepath, mdContent, 'utf8');
        console.log(`[TRIPLESEAT] 💾 Obsidian report written → ${filepath}`);

        // 2. Write to SCRIBE memory
        await memoryBus.commit({
            agentName: 'KEEPER',
            task: `Ingest Tripleseat Event BEO: ${data.eventName}`,
            outcome: `Parsed and logged event "${data.eventName}" in room "${data.roomName}" for ${data.startDate}. Saved BEO to Obsidian: ${filename}.`,
            tags: ['tripleseat', 'event-beo', 'ingestion', data.locationName.toLowerCase()],
            sessionId: `evt_${data.eventId}`
        });

        return { success: true, eventId: data.eventId, filename, path: filepath, data };
    }
);

export const prismIngestFlow = ai.defineFlow(
    {
        name: 'prismIngest',
        inputSchema: z.object({
            payload: z.any().describe('Raw webhook payload from Prism.fm'),
        }),
        outputSchema: z.any(),
    },
    async (input) => {
        console.log(`[PRISM] 📥 Ingesting live show webhook payload...`);

        // 1. Extract show details
        const promptText = `Extract structured show details from the following Prism.fm webhook payload:\n\n${JSON.stringify(input.payload, null, 2)}`;
        
        const extractResponse = await ai.generate(applyOmnipresenceCache({
            model: resolveModel('cloud:fast'),
            system: 'You are an expert concert booking extraction assistant. Extract details about dates, deals, and capacities.',
            prompt: promptText,
            output: { schema: PrismExtractionSchema },
            config: { temperature: 0.1 }
        }));

        const showData = extractResponse.output;
        if (!showData) throw new Error('[PRISM] Failed to extract show details');

        console.log(`[PRISM] Extracted Show: "${showData.artistName}" @ ${showData.venueName}`);

        // 2. Perform Lex Auditor check (deal compliance risk)
        const auditPrompt = `Analyze this live show contract detail and perform a deal compliance audit. Look for unapproved expenses, over-cap estimates, or unfavorable splits:
        
        Artist: ${showData.artistName}
        Venue: ${showData.venueName}
        Show Date: ${showData.showDate}
        Deal Structure: ${showData.dealStructure}
        Estimated Payout: ${showData.payoutEstimate}
        Promoter Expenses: ${showData.promoterExpenses}`;

        const auditResponse = await ai.generate(applyOmnipresenceCache({
            model: resolveModel('cloud:fast'),
            system: 'You are LEX — the contract compliance and risk auditor of the Creative Liberation Engine. Flags risks, unfavorable clauses, or overages in promoter concert contracts.',
            prompt: auditPrompt,
            output: { schema: LexAuditSchema },
            config: { temperature: 0.15 }
        }));

        const auditResult = auditResponse.output || {
            status: 'approved',
            riskScore: 0,
            flags: [],
            recommendations: []
        };

        console.log(`[LEX AUDITOR] Show risk classification: ${auditResult.status.toUpperCase()} (Score: ${auditResult.riskScore})`);

        // 3. Generate Obsidian markdown file
        const vaultDir = getVaultDir('Prism');
        const filename = `IE-SHOW-${showData.showId.slice(0, 4)}_${slugify(showData.artistName)}.md`;
        const filepath = path.join(vaultDir, filename);

        const mdContent = `---
type: show
platform: prism
showId: "${showData.showId}"
artistName: "${showData.artistName}"
venueName: "${showData.venueName}"
showDate: "${showData.showDate}"
payoutEstimate: ${showData.payoutEstimate}
auditStatus: "${auditResult.status}"
auditRiskScore: ${auditResult.riskScore}
ingestedAt: "${new Date().toISOString()}"
---

# Show: ${showData.artistName}

## Tour Details
- **Venue**: ${showData.venueName}
- **Show Date**: ${showData.showDate}
- **Estimated Payout**: $${showData.payoutEstimate.toLocaleString()}

## Ticket Scaling & Capacity
${showData.ticketScaling}

## Deal Structure
${showData.dealStructure}

## Promoter Expenses
${showData.promoterExpenses}

## Crew Schedule & Run-of-Show
${showData.crewSchedule}

---

## ⚖️ LEX AUDIT REPORT
- **Status**: ${auditResult.status.toUpperCase()}
- **Risk Score**: ${auditResult.riskScore} / 100

### Flags & Warnings
${auditResult.flags.map(f => `- ⚠️ ${f}`).join('\n') || '- ✅ No anomalies or risk factors detected.'}

### Recommendations
${auditResult.recommendations.map(r => `- 💡 ${r}`).join('\n') || '- No active recommendations.'}
`;

        fs.writeFileSync(filepath, mdContent, 'utf8');
        console.log(`[PRISM] 💾 Obsidian report written → ${filepath}`);

        // 4. Write to SCRIBE memory
        await memoryBus.commit({
            agentName: 'LEX',
            task: `Ingest & Audit Prism.fm Show: ${showData.artistName}`,
            outcome: `Audited and logged show "${showData.artistName}" at "${showData.venueName}" on ${showData.showDate}. Audit status: ${auditResult.status.toUpperCase()} (Risk Score: ${auditResult.riskScore}). Saved report to Obsidian: ${filename}.`,
            tags: ['prism', 'live-show', 'deal-audit', 'ingestion', showData.artistName.toLowerCase()],
            sessionId: `show_${showData.showId}`
        });

        return { success: true, showId: showData.showId, filename, path: filepath, showData, auditResult };
    }
);
