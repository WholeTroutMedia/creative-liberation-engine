/**
 * HomeBuild Cost Ledger — UE5 Live Construction Cost Session
 *
 * Maintains a real-time cost ledger for a UE5 HomeBuild walkthrough session.
 * Every actor placement/removal/swap in Unreal fires an event to this flow,
 * which maintains a running total and can generate a structured Purchase Order.
 *
 * Architecture:
 *   UE5 ConstructionItem Blueprint Component
 *     → OnItemPlaced(sku, cost, laborHours)
 *     → HTTP POST → Genkit /generate { flow: 'HomebuildCostLedger', input: { ... } }
 *     → Running total updated + returned to UE5
 *
 * The same session can be terminated with action: 'generate_po' to produce
 * a full purchase order document (JSON + human-readable markdown).
 *
 * See: ue5/ConstructionItem_component_spec.md
 */

import { z } from 'genkit';
import { ai } from '../index.js';

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const ConstructionItemSchema = z.object({
    actorId: z.string().describe('Unique UE5 actor instance ID'),
    sku: z.string().describe('Material or product SKU from builder catalog'),
    materialName: z.string().describe('Human-readable material name'),
    category: z.enum(['flooring', 'countertop', 'cabinetry', 'fixture', 'appliance', 'structural', 'exterior', 'hvac', 'electrical', 'plumbing', 'custom'])
        .default('custom'),
    laborHours: z.number().default(0).describe('Labor hours for installation'),
    unitCost: z.number().describe('Cost per unit (material only, USD)'),
    laborRate: z.number().default(75).describe('Labor rate per hour (USD), defaults to $75/hr'),
    quantity: z.number().default(1).describe('Unit quantity (sq ft, count, linear ft, etc.)'),
    unit: z.string().default('unit').describe('Unit of measure: sqft, count, lft, etc.'),
    zone: z.string().optional().describe('Room zone: kitchen, master_bath, entry, etc.'),
    vendorNotes: z.string().optional(),
});

const LedgerActionSchema = z.enum(['init', 'add', 'remove', 'swap', 'snapshot', 'generate_po', 'upsell_suggest']);

export const HomebuildCostLedgerInputSchema = z.object({
    sessionId: z.string().describe('UE5 walkthrough session identifier'),
    action: LedgerActionSchema,
    item: ConstructionItemSchema.optional().describe('Item for add/remove/swap actions'),
    removeActorId: z.string().optional().describe('Actor ID to remove (for remove/swap actions)'),
    projectName: z.string().optional().describe('Project name for PO generation'),
    clientName: z.string().optional().describe('Client name for PO generation'),
    builderName: z.string().optional().describe('Builder name for PO generation'),
});

export const HomebuildCostLedgerOutputSchema = z.object({
    sessionId: z.string(),
    action: z.string(),
    runningTotal: z.number().describe('Running material + labor total in USD'),
    materialTotal: z.number(),
    laborTotal: z.number(),
    lineItemCount: z.number(),
    lineItems: z.array(ConstructionItemSchema).describe('All current line items in session'),
    lastChange: z.object({
        delta: z.number().describe('Cost change from last action (positive = increase)'),
        description: z.string(),
    }).optional(),
    purchaseOrder: z.string().nullable().describe('Full PO markdown — only present on generate_po action'),
    upsellSuggestion: z.string().nullable().describe('PRISM upsell suggestion — on upsell_suggest action'),
    sessionStarted: z.string().describe('ISO timestamp of session init'),
    lastUpdated: z.string().describe('ISO timestamp of last update'),
});

export type HomebuildCostLedgerInput = z.infer<typeof HomebuildCostLedgerInputSchema>;
export type HomebuildCostLedgerOutput = z.infer<typeof HomebuildCostLedgerOutputSchema>;
export type ConstructionItem = z.infer<typeof ConstructionItemSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY SESSION STORE
// (Production: replace with Redis at key homebuild:{sessionId}:ledger)
// ─────────────────────────────────────────────────────────────────────────────

interface LedgerSession {
    items: Map<string, ConstructionItem>;
    sessionStarted: string;
    lastUpdated: string;
}

const _sessions = new Map<string, LedgerSession>();

function getOrCreateSession(sessionId: string): LedgerSession {
    if (!_sessions.has(sessionId)) {
        const now = new Date().toISOString();
        _sessions.set(sessionId, {
            items: new Map(),
            sessionStarted: now,
            lastUpdated: now,
        });
        console.log(`[LEDGER] New session initialized: ${sessionId}`);
    }
    return _sessions.get(sessionId)!;
}

function calculateTotals(items: Map<string, ConstructionItem>) {
    let materialTotal = 0;
    let laborTotal = 0;
    for (const item of items.values()) {
        materialTotal += item.unitCost * item.quantity;
        laborTotal += item.laborHours * item.laborRate;
    }
    return { materialTotal, laborTotal, runningTotal: materialTotal + laborTotal };
}

function formatPurchaseOrder(
    items: ConstructionItem[],
    projectName: string,
    clientName: string,
    builderName: string,
    totals: { materialTotal: number; laborTotal: number; runningTotal: number }
): string {
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const itemRows = items.map(item => {
        const matCost = (item.unitCost * item.quantity).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        const labCost = (item.laborHours * item.laborRate).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        return `| ${item.materialName} | ${item.sku} | ${item.quantity} ${item.unit} | ${matCost} | ${labCost} |`;
    }).join('\n');

    return `# PURCHASE ORDER — ${projectName}

**Date:** ${date}  
**Client:** ${clientName}  
**Builder:** ${builderName}  
**Session ID:** ${items[0]?.zone ?? 'N/A'}

---

## Line Items

| Material | SKU | Quantity | Material Cost | Labor Cost |
|---|---|---|---|---|
${itemRows}

---

## Summary

| | |
|---|---|
| **Material Total** | ${totals.materialTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} |
| **Labor Total** | ${totals.laborTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} |
| **Project Total** | **${totals.runningTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}** |

---

*Generated by Creative Liberation Engine HomeBuilder — Powered by UE5 + Genkit*
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GENKIT FLOW
// ─────────────────────────────────────────────────────────────────────────────

export const HomebuildCostLedgerFlow = ai.defineFlow(
    {
        name: 'HomebuildCostLedger',
        inputSchema: HomebuildCostLedgerInputSchema,
        outputSchema: HomebuildCostLedgerOutputSchema,
    },
    async (input: HomebuildCostLedgerInput): Promise<HomebuildCostLedgerOutput> => {
        const session = getOrCreateSession(input.sessionId);
        const prevTotals = calculateTotals(session.items);
        let delta = 0;
        let deltaDescription = '';
        const now = new Date().toISOString();

        console.log(`[LEDGER] Session ${input.sessionId} — action: ${input.action}`);

        switch (input.action) {
            case 'init':
                // Already initialized above — just return current state
                deltaDescription = 'Session initialized';
                break;

            case 'add': {
                if (!input.item) throw new Error('item required for add action');
                const existing = session.items.get(input.item.actorId);
                if (existing) {
                    console.warn(`[LEDGER] Actor ${input.item.actorId} already exists — updating`);
                }
                session.items.set(input.item.actorId, input.item);
                const newTotals = calculateTotals(session.items);
                delta = newTotals.runningTotal - prevTotals.runningTotal;
                deltaDescription = `Added ${input.item.materialName} (+${delta.toLocaleString('en-US', { style: 'currency', currency: 'USD' })})`;
                console.log(`[LEDGER] + ${input.item.materialName} (${input.item.sku}) | Δ${delta >= 0 ? '+' : ''}$${delta.toFixed(0)}`);
                break;
            }

            case 'remove': {
                const targetId = input.removeActorId ?? input.item?.actorId;
                if (!targetId) throw new Error('removeActorId or item.actorId required for remove action');
                const removed = session.items.get(targetId);
                if (removed) {
                    session.items.delete(targetId);
                    const newTotals = calculateTotals(session.items);
                    delta = newTotals.runningTotal - prevTotals.runningTotal;
                    deltaDescription = `Removed ${removed.materialName} (${delta.toLocaleString('en-US', { style: 'currency', currency: 'USD' })})`;
                    console.log(`[LEDGER] - ${removed.materialName} | Δ$${delta.toFixed(0)}`);
                }
                break;
            }

            case 'swap': {
                // Remove old actor, add new item
                const swapOutId = input.removeActorId ?? input.item?.actorId;
                if (swapOutId) session.items.delete(swapOutId);
                if (input.item) session.items.set(input.item.actorId, input.item);
                const newTotals = calculateTotals(session.items);
                delta = newTotals.runningTotal - prevTotals.runningTotal;
                deltaDescription = `Swapped to ${input.item?.materialName ?? 'new item'} (${delta >= 0 ? '+' : ''}${delta.toLocaleString('en-US', { style: 'currency', currency: 'USD' })})`;
                break;
            }

            case 'snapshot':
                deltaDescription = `Snapshot taken — ${session.items.size} items`;
                break;

            case 'generate_po':
            case 'upsell_suggest':
                deltaDescription = input.action === 'generate_po' ? 'Purchase order generated' : 'Upsell analysis run';
                break;
        }

        session.lastUpdated = now;
        const finalTotals = calculateTotals(session.items);
        const lineItems = Array.from(session.items.values());

        // Generate PO if requested
        let purchaseOrder: string | null = null;
        if (input.action === 'generate_po') {
            purchaseOrder = formatPurchaseOrder(
                lineItems,
                input.projectName ?? 'Untitled Project',
                input.clientName ?? 'Client',
                input.builderName ?? 'Builder',
                finalTotals
            );
            console.log(`[LEDGER] Purchase Order generated — ${lineItems.length} items — Total: $${finalTotals.runningTotal.toFixed(0)}`);
        }

        // Upsell suggestion via PRISM
        let upsellSuggestion: string | null = null;
        if (input.action === 'upsell_suggest' && lineItems.length > 0) {
            try {
                const { output } = await ai.generate({
                    model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
                    system: `You are PRISM — the AI model ops agent for Creative Liberation Engine HomeBuild.
Analyze the current material selections and suggest ONE relevant upgrade that adds real value.
Be specific about the product, the cost impact, and the ROI reason.
Keep it to 1-2 sentences. Sound like a knowledgeable contractor, not a salesperson.`,
                    prompt: `Current selections (${lineItems.length} items, $${finalTotals.runningTotal.toFixed(0)} total):\n${lineItems.map(i => `- ${i.materialName} (${i.category}, ${i.zone ?? 'unzoned'})`).join('\n')}\n\nSuggest one upgrade:`,
                    config: { temperature: 0.6 },
                });
                upsellSuggestion = output ?? null;
            } catch (e) {
                console.warn(`[LEDGER] Upsell generation failed: ${e}`);
            }
        }

        return {
            sessionId: input.sessionId,
            action: input.action,
            runningTotal: finalTotals.runningTotal,
            materialTotal: finalTotals.materialTotal,
            laborTotal: finalTotals.laborTotal,
            lineItemCount: lineItems.length,
            lineItems,
            lastChange: delta !== 0 ? { delta, description: deltaDescription } : undefined,
            purchaseOrder,
            upsellSuggestion,
            sessionStarted: session.sessionStarted,
            lastUpdated: now,
        };
    }
);
