import { z } from 'zod';

// ─── ZERO DAY — AI Proposal Generator ────────────────────────────────────────
// Generates discovery-led, AI-personalized project proposals from client
// intake data. Produces HTML and Markdown output with pricing options,
// tailored scope, and conversion-optimized structure.

export const ProposalIntakeSchema = z.object({
    client_name: z.string(),
    client_company: z.string().optional(),
    client_email: z.string().email(),
    project_type: z.enum(['branding', 'web', 'social_media', 'video', 'campaign', 'retainer', 'consulting', 'custom']),
    budget_range: z.enum(['under_5k', '5k_10k', '10k_25k', '25k_50k', '50k_plus', 'undisclosed']),
    timeline_urgency: z.enum(['rush', 'standard', 'flexible']),
    goals: z.array(z.string()).min(1).max(6).describe('What the client wants to achieve'),
    pain_points: z.array(z.string()).max(5).optional().describe('Current problems the client mentioned'),
    deliverables_requested: z.array(z.string()).optional(),
    agency_name: z.string().default('Whole Trout Media'),
    accent_color: z.string().default('#b87333'),
    include_options: z.boolean().default(true).describe('Include Good/Better/Best pricing tiers'),
});

// ─── Scope builder ────────────────────────────────────────────────────────────

interface Tier { label: string; price: number; summary: string; includes: string[] }

function buildScopeFromIntake(intake: z.infer<typeof ProposalIntakeSchema>): {
    scope_narrative: string;
    problem_statement: string;
    approach: string;
    tiers: Tier[];
    timeline_weeks: number;
} {
    const { project_type, budget_range, timeline_urgency, goals, pain_points } = intake;

    const baseScope: Record<string, string[]> = {
        branding: ['Brand strategy workshop', 'Logo design (3 concepts → 1 refined)', 'Color palette + typography system', 'Brand guidelines PDF', 'Social media assets kit'],
        web: ['Discovery + sitemap', 'UI/UX design (Figma)', 'Responsive build (HTML/React)', 'CMS integration', 'Performance + SEO audit', 'QA + launch support'],
        social_media: ['Platform audit', 'Content strategy', '30 posts/month (copy + design)', 'Community management', 'Monthly analytics report'],
        video: ['Creative brief', 'Script writing', 'Filming (1-day)', 'Post-production', 'Final + 3 social cuts'],
        campaign: ['Campaign strategy', 'Creative concepts', 'Ad design (static + video)', 'Copy + CTA framework', 'Performance tracking setup'],
        retainer: ['Monthly strategy session', 'Ongoing creative support', 'Content production', 'Analytics review', 'Priority response'],
        consulting: ['Audit + discovery', 'Strategic roadmap', 'Implementation support', 'Monthly advisory calls'],
        custom: ['Discovery workshop', 'Custom scope development', 'Dedicated project team', 'Weekly reporting'],
    };

    const deliverables = intake.deliverables_requested?.length ? intake.deliverables_requested : (baseScope[project_type] ?? baseScope.custom);

    const budgetMultiplier: Record<string, number> = {
        under_5k: 1, '5k_10k': 1.5, '10k_25k': 2.5, '25k_50k': 4, '50k_plus': 7, undisclosed: 2,
    };
    const base = budget_range === 'under_5k' ? 3500 : budget_range === '5k_10k' ? 7500 : budget_range === '10k_25k' ? 17500 : budget_range === '25k_50k' ? 35000 : budget_range === '50k_plus' ? 60000 : 10000;
    const rushMultiplier = timeline_urgency === 'rush' ? 1.3 : 1;

    const tiers: Tier[] = intake.include_options ? [
        { label: 'Essential', price: Math.round(base * 0.7 * rushMultiplier / 100) * 100, summary: 'Core deliverables, proven process', includes: deliverables.slice(0, Math.ceil(deliverables.length * 0.6)) },
        { label: 'Growth', price: Math.round(base * rushMultiplier / 100) * 100, summary: 'Full scope + priority support', includes: deliverables },
        { label: 'Premium', price: Math.round(base * 1.4 * rushMultiplier / 100) * 100, summary: 'Everything + dedicated team, unlimited revisions', includes: [...deliverables, 'Dedicated account manager', 'Unlimited revisions (4 weeks)', '60-day post-launch support'] },
    ] : [
        { label: 'Recommended', price: Math.round(base * rushMultiplier / 100) * 100, summary: 'Full scope proposal', includes: deliverables },
    ];

    const timelineWeeks = timeline_urgency === 'rush' ? 3 : timeline_urgency === 'standard' ? 8 : 12;

    const painSentence = pain_points?.length ? `You mentioned challenges with ${pain_points.slice(0, 2).join(' and ')}, which we encounter frequently — our approach is built to address these directly.` : '';
    const goalSentence = `Your goals — ${goals.slice(0, 2).join(' and ')} — align precisely with what we do best.`;

    return {
        scope_narrative: `${goalSentence} ${painSentence}`.trim(),
        problem_statement: pain_points?.length ? `${intake.client_name} needs to overcome ${pain_points[0]}${pain_points.length > 1 ? ` and ${pain_points[1]}` : ''} to achieve ${goals[0]}.` : `${intake.client_name} is ready to invest in ${project_type.replace('_', ' ')} to achieve ${goals.join(' and ')}.`,
        approach: `Our ${project_type.replace('_', ' ')} process begins with a discovery session to fully understand your business, audience, and success metrics. From there we move through ${timelineWeeks > 6 ? 'strategy → creative → build → launch → support' : 'rapid brief → design → deliver'} phases with regular check-ins and transparent progress.`,
        tiers,
        timeline_weeks: timelineWeeks,
    };
}

// ─── Markdown builder ─────────────────────────────────────────────────────────

export function buildProposalMarkdown(intake: z.infer<typeof ProposalIntakeSchema>): string {
    const v = ProposalIntakeSchema.parse(intake);
    const { scope_narrative, problem_statement, approach, tiers, timeline_weeks } = buildScopeFromIntake(v);
    const validUntil = new Date(Date.now() + 14 * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return [
        `# Proposal for ${v.client_company ?? v.client_name}`,
        `**Prepared by:** ${v.agency_name}`,
        `**Date:** ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
        `**Valid until:** ${validUntil}`,
        '',
        '## The Challenge',
        problem_statement,
        '',
        '## Why This Matters',
        scope_narrative,
        '',
        '## Our Approach',
        approach,
        '',
        '## Goals We\'re Solving For',
        v.goals.map(g => `- ${g}`).join('\n'),
        '',
        '## Investment Options',
        tiers.map(t => [
            `### ${t.label} — $${t.price.toLocaleString()}`,
            t.summary,
            t.includes.map(d => `- ${d}`).join('\n'),
        ].join('\n')).join('\n\n'),
        '',
        `## Timeline`,
        `**Estimated delivery:** ${timeline_weeks} weeks from deposit${v.timeline_urgency === 'rush' ? ' (rush rate applied)' : ''}`,
        '',
        '## Next Steps',
        '1. Review this proposal and let us know which option resonates',
        '2. Sign and return (or reply to confirm)',
        '3. Submit 50% deposit to begin',
        '4. We send a project kickoff questionnaire within 24 hours',
    ].join('\n');
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

export function buildProposalHtml(intake: z.infer<typeof ProposalIntakeSchema>): string {
    const v = ProposalIntakeSchema.parse(intake);
    const { scope_narrative, problem_statement, approach, tiers, timeline_weeks } = buildScopeFromIntake(v);
    const ac = v.accent_color;
    const validUntil = new Date(Date.now() + 14 * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Proposal — ${v.client_company ?? v.client_name}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#fff;color:#1a1a1a}
.cover{background:#0a0a0f;color:#f5f0e8;padding:80px;min-height:70vh;display:flex;flex-direction:column;justify-content:flex-end}
.accent-line{width:60px;height:4px;background:${ac};margin-bottom:24px}
.cover-eye{font-size:11px;letter-spacing:4px;text-transform:uppercase;color:${ac};font-weight:700;margin-bottom:12px}
.cover-title{font-size:clamp(36px,6vw,72px);font-weight:800;letter-spacing:-2px}
.cover-meta{margin-top:48px;display:grid;grid-template-columns:repeat(4,1fr);gap:24px;padding-top:32px;border-top:1px solid rgba(245,240,232,.1)}
.meta-item label{font-size:10px;letter-spacing:2px;text-transform:uppercase;opacity:.4;display:block;margin-bottom:4px}
.meta-item span{font-size:15px;font-weight:600}
.section{padding:64px 80px;border-bottom:1px solid #f0f0f0}
.section-label{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${ac};font-weight:700;margin-bottom:20px}
.section-title{font-size:28px;font-weight:700;margin-bottom:16px}
.body-text{font-size:16px;line-height:1.7;color:#444;max-width:680px}
.goals-list{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.goal{background:#f5f5f5;padding:10px 18px;border-radius:100px;font-size:14px;font-weight:600;border-left:3px solid ${ac}}
.tiers{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px}
.tier{padding:28px;border-radius:12px;border:2px solid #f0f0f0;position:relative}
.tier.highlight{border-color:${ac};background:rgba(184,115,51,.04)}
.tier-label{font-size:13px;font-weight:700;color:${ac};letter-spacing:1px;text-transform:uppercase;margin-bottom:8px}
.tier-price{font-size:40px;font-weight:800;letter-spacing:-2px;margin-bottom:4px}
.tier-summary{font-size:13px;color:#666;margin-bottom:16px}
.tier-includes{list-style:none;display:grid;gap:8px}
.tier-includes li{font-size:13px;padding-left:18px;position:relative}
.tier-includes li::before{content:'✓';position:absolute;left:0;color:${ac};font-weight:700}
.rec-badge{position:absolute;top:-12px;right:20px;background:${ac};color:#fff;font-size:10px;font-weight:700;padding:4px 12px;border-radius:100px;letter-spacing:1px}
.steps{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.step{display:flex;gap:16px;align-items:flex-start;padding:20px;background:#f9f9f9;border-radius:8px}
.step-num{font-size:24px;font-weight:800;color:${ac};line-height:1;flex-shrink:0}
.step-text{font-size:14px;line-height:1.5}
.footer{background:#0a0a0f;color:rgba(245,240,232,.4);padding:24px 80px;font-size:12px;display:flex;justify-content:space-between}
</style></head><body>
<div class="cover">
  <div class="accent-line"></div>
  <div class="cover-eye">Project Proposal</div>
  <div class="cover-title">${v.client_company ?? v.client_name}</div>
  <div class="cover-meta">
    <div class="meta-item"><label>Prepared for</label><span>${v.client_name}</span></div>
    <div class="meta-item"><label>Prepared by</label><span>${v.agency_name}</span></div>
    <div class="meta-item"><label>Project type</label><span>${v.project_type.replace('_', ' ')}</span></div>
    <div class="meta-item"><label>Valid until</label><span>${validUntil}</span></div>
  </div>
</div>
<div class="section"><p class="section-label">The Challenge</p><h2 class="section-title">Why You're Here</h2><p class="body-text">${problem_statement}</p></div>
<div class="section"><p class="section-label">Why It Matters</p><h2 class="section-title">Your Goals</h2><p class="body-text">${scope_narrative}</p><div class="goals-list">${v.goals.map(g => `<span class="goal">${g}</span>`).join('')}</div></div>
<div class="section"><p class="section-label">How We Work</p><h2 class="section-title">Our Approach</h2><p class="body-text">${approach}</p><p class="body-text" style="margin-top:16px">Estimated delivery: <strong>${timeline_weeks} weeks</strong> from signed proposal + deposit.</p></div>
<div class="section"><p class="section-label">Investment</p><h2 class="section-title">${v.include_options ? 'Choose Your Package' : 'Proposed Investment'}</h2>
<div class="tiers">${tiers.map((t, i) => `<div class="tier ${i === 1 && tiers.length === 3 ? 'highlight' : ''}">
  ${i === 1 && tiers.length === 3 ? '<div class="rec-badge">RECOMMENDED</div>' : ''}
  <div class="tier-label">${t.label}</div>
  <div class="tier-price">$${t.price.toLocaleString()}</div>
  <div class="tier-summary">${t.summary}</div>
  <ul class="tier-includes">${t.includes.map(d => `<li>${d}</li>`).join('')}</ul>
</div>`).join('')}</div></div>
<div class="section"><p class="section-label">Getting Started</p><h2 class="section-title">Next Steps</h2>
<div class="steps">
  <div class="step"><div class="step-num">01</div><div class="step-text">Choose your package and reply</div></div>
  <div class="step"><div class="step-num">02</div><div class="step-text">Sign the project agreement</div></div>
  <div class="step"><div class="step-num">03</div><div class="step-text">Submit 50% deposit to begin</div></div>
  <div class="step"><div class="step-num">04</div><div class="step-text">Kickoff questionnaire within 24h</div></div>
</div></div>
<div class="footer"><span>${v.agency_name} &bull; Proposal for ${v.client_company ?? v.client_name}</span><span>Valid until ${validUntil}</span></div>
</body></html>`;
}

export function generateProposal(input: z.infer<typeof ProposalIntakeSchema>): { html: string; markdown: string; tiers: Tier[] } {
    const v = ProposalIntakeSchema.parse(input);
    const { tiers } = buildScopeFromIntake(v);
    return { html: buildProposalHtml(v), markdown: buildProposalMarkdown(v), tiers };
}

export const PROPOSAL_TOOLS = [
    { name: 'zeroday_generate_proposal', description: 'Generate an AI-personalized sales proposal from client intake data. Returns HTML, Markdown, and pricing tiers. Great/Better/Best options auto-calculated from budget range.', inputSchema: ProposalIntakeSchema, handler: generateProposal, agentPermissions: ['ZERO_DAY', 'ORACLE', 'GOD_PROMPT'], estimatedCost: 'Free' },
];
