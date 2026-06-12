/**
 * Flipboard Sentinel â€” Email Dispatcher
 * 
 * Pipeline framing:
 *   BRAINSTORM = saved/bookmarked links from Flipboard RSS
 *   IDEATION   = ATHENA strategic analysis delivered via email
 * 
 * Emails are ONLY sent when ATHENA returns a full ideation.
 * Each email contains the complete IDEATION result and a reference
 * code (job ID) that the operator can use to activate execution.
 */

import { CONFIG } from './config.js';
import { JobManifest, updateManifest } from './job-registry.js';
import type { CrossRefResult } from './cross-reference.js';
import nodemailer from 'nodemailer';

/**
 * Send a completed IDEATION email via Gmail.
 * Only sends when ATHENA has returned results â€” never sends "pending" emails.
 * Non-fatal â€” logs errors but never blocks the pipeline.
 */
export async function sendIdeationEmail(manifest: JobManifest, crossRefs: CrossRefResult[] = []): Promise<void> {
    // Only send email when we have actual ATHENA ideation results
    if (!manifest.athenaOutput?.directive) {
        console.log(`[SENTINEL] ℹ️ No ATHENA ideation yet for ${manifest.jobId} — skipping email (brainstorm saved)`);
        return;
    }

    const html = buildIdeationEmailHtml(manifest, crossRefs);
    const text = manifest.athenaOutput.rationale + '\n\n' + (manifest.athenaOutput.options?.map((o, i) => `${i+1}. ${o.title}: ${o.description}`).join('\n') || '');
    const statusEmoji = manifest.inceptionRelevance >= 70 ? '🔥' : manifest.inceptionRelevance >= 40 ? '⚡️' : '📡';
    const subject = `${statusEmoji} [IDEATION BRIEFING] ${manifest.sourceArticle.title}`;

    // Prefer Cloudflare agent-mail API
    const agentMailUrl = process.env.AGENT_MAIL_URL || 'https://agent-mail.wholetrou.workers.dev';
    const agentMailApiKey = process.env.AGENT_MAIL_API_KEY || 'cf_agent_mail_secure_key_2026';

    if (agentMailUrl && agentMailApiKey) {
        try {
            console.log(`[SENTINEL] 📤 Sending ${manifest.jobId} via Cloudflare agent-mail API...`);
            const response = await fetch(`${agentMailUrl}/api/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${agentMailApiKey}`
                },
                body: JSON.stringify({
                    to: CONFIG.notifyEmail,
                    subject,
                    body_text: text,
                    body_html: html,
                    agent_id: 'athena'
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Cloudflare agent-mail returned ${response.status}: ${errText}`);
            }

            const data = await response.json() as any;
            console.log(`[SENTINEL] 📧 IDEATION delivered via Cloudflare: ${manifest.jobId} -> ${CONFIG.notifyEmail} (status: ${data.status})`);
            
            manifest.emailedAt = new Date().toISOString();
            try { updateManifest(manifest); } catch (_) { /* non-fatal */ }
            return;
        } catch (err: any) {
            console.warn(`[SENTINEL] ⚠️ Cloudflare email dispatch failed: ${err.message}. Falling back to Nodemailer...`);
        }
    }

    if (!CONFIG.gmailUser || (!CONFIG.gmailAppPassword && !process.env.GMAIL_REFRESH_TOKEN)) {
        console.log(`[SENTINEL] ℹ️ Gmail credentials not set — skipping email dispatch`);
        return;
    }

    const auth: any = {
        user: CONFIG.gmailUser,
    };
    if (process.env.GMAIL_REFRESH_TOKEN && process.env.GMAIL_CLIENT_ID) {
        auth.type = 'OAuth2';
        auth.clientId = process.env.GMAIL_CLIENT_ID;
        auth.clientSecret = process.env.GMAIL_CLIENT_SECRET;
        auth.refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    } else {
        auth.pass = CONFIG.gmailAppPassword;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth
    });

    let delivered = false;
    try {
        await transporter.sendMail({
            from: `"SENTINEL" <${CONFIG.gmailUser}>`,
            to: CONFIG.notifyEmail,
            subject,
            html,
        });
        delivered = true;
        console.log(`[SENTINEL] 📧 IDEATION delivered via Gmail Nodemailer: ${manifest.jobId} → ${CONFIG.notifyEmail}`);
    } catch (err: any) {
        console.warn(`[SENTINEL] ⚠️ Gmail Nodemailer OAuth2 failed: ${err.message}. Retrying with App Password...`);
        if (auth.type === 'OAuth2' && CONFIG.gmailAppPassword) {
            try {
                const fallbackTransporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: CONFIG.gmailUser,
                        pass: CONFIG.gmailAppPassword,
                    }
                });
                await fallbackTransporter.sendMail({
                    from: `"SENTINEL" <${CONFIG.gmailUser}>`,
                    to: CONFIG.notifyEmail,
                    subject,
                    html,
                });
                delivered = true;
                console.log(`[SENTINEL] 📧 IDEATION delivered via Gmail Nodemailer (App Password fallback): ${manifest.jobId} → ${CONFIG.notifyEmail}`);
            } catch (fallbackErr: any) {
                console.warn(`[SENTINEL] ⚠️ Gmail Nodemailer App Password fallback failed: ${fallbackErr.message}`);
            }
        } else {
            console.warn(`[SENTINEL] ⚠️ Gmail Nodemailer failed and no App Password fallback is available.`);
        }
    }

    if (delivered) {
        // Stamp emailedAt for tracking
        manifest.emailedAt = new Date().toISOString();
        try { updateManifest(manifest); } catch (_) { /* non-fatal */ }
    }
}

/**
 * Send an RSS health alert email.
 */
export async function sendHealthAlert(message: string): Promise<void> {
    const agentMailUrl = process.env.AGENT_MAIL_URL || 'https://agent-mail.wholetrou.workers.dev';
    const agentMailApiKey = process.env.AGENT_MAIL_API_KEY || 'cf_agent_mail_secure_key_2026';
    const subject = `⚠️ Sentinel Health Alert`;
    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a1a; color: #e0e0e0;">
            <h2 style="color: #ff6b35;">⚠️ Sentinel Health Alert</h2>
            <p>${message}</p>
            <p style="color: #888; font-size: 12px;">Creative Liberation Engine — Flipboard Sentinel</p>
        </div>
    `;

    if (agentMailUrl && agentMailApiKey) {
        try {
            const response = await fetch(`${agentMailUrl}/api/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${agentMailApiKey}`
                },
                body: JSON.stringify({
                    to: CONFIG.notifyEmail,
                    subject,
                    body_text: message,
                    body_html: html,
                    agent_id: 'sentinel'
                })
            });
            if (response.ok) return;
        } catch { /* fallback to nodemailer */ }
    }

    if (!CONFIG.gmailUser || (!CONFIG.gmailAppPassword && !process.env.GMAIL_REFRESH_TOKEN)) return;

    const auth: any = {
        user: CONFIG.gmailUser,
    };
    if (process.env.GMAIL_REFRESH_TOKEN && process.env.GMAIL_CLIENT_ID) {
        auth.type = 'OAuth2';
        auth.clientId = process.env.GMAIL_CLIENT_ID;
        auth.clientSecret = process.env.GMAIL_CLIENT_SECRET;
        auth.refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    } else {
        auth.pass = CONFIG.gmailAppPassword;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth
    });

    try {
        await transporter.sendMail({
            from: `"SENTINEL" <${CONFIG.gmailUser}>`,
            to: CONFIG.notifyEmail,
            subject,
            html,
        });
    } catch (err: any) {
        if (auth.type === 'OAuth2' && CONFIG.gmailAppPassword) {
            try {
                const fallbackTransporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: CONFIG.gmailUser,
                        pass: CONFIG.gmailAppPassword,
                    }
                });
                await fallbackTransporter.sendMail({
                    from: `"SENTINEL" <${CONFIG.gmailUser}>`,
                    to: CONFIG.notifyEmail,
                    subject,
                    html,
                });
            } catch (fallbackErr) {
                // Non-fatal fallback error
            }
        }
    }
}

/**
 * Build the CORTEX execution mailto link for a given vector.
 */
function buildCortexMailto(jobId: string, vectorNum: number, optTitle: string): string {
    const subject = encodeURIComponent(`[CORTEX EXECUTE] ${jobId} â€” Vector ${String(vectorNum).padStart(2, '0')}: ${optTitle}`);
    const body = encodeURIComponent(
        `CORTEX â€” Execute the following vector.\n\n` +
        `Job: ${jobId}\n` +
        `Vector: ${String(vectorNum).padStart(2, '0')}\n` +
        `Title: ${optTitle}\n\n` +
        `--- OPERATOR NOTES ---\n` +
        `(Add any additional context or constraints here)\n\n`
    );
    return `mailto:${CONFIG.notifyEmail}?subject=${subject}&body=${body}`;
}

/**
 * Generate Editorial HTML for IDEATION briefing.
 * Full-width, tight layout, CORTEX-actionable, complete ideation details.
 */
export function buildIdeationEmailHtml(manifest: JobManifest, crossRefs: CrossRefResult[]): string {
    const { jobId, sourceArticle, categories, inceptionRelevance, athenaOutput } = manifest;
    const athena = athenaOutput!;

    const isHigh = inceptionRelevance >= 70;
    const isMed = inceptionRelevance >= 40;
    const accent = isHigh ? '#E11D48' : isMed ? '#D97706' : '#059669';
    const accentBg = isHigh ? '#FFF1F2' : isMed ? '#FFFBEB' : '#ECFDF5';
    const dk = '#0F172A';
    const tx = '#1E293B';
    const txm = '#64748B';
    const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace";
    const sans = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    const serif = "'Georgia', 'Times New Roman', serif";

    const date = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const relLabel = isHigh ? 'HIGH RELEVANCE' : isMed ? 'MODERATE' : 'SIGNAL';
    const catStr = (categories || []).join(', ') || 'General';

    // --- Options HTML ---
    let optionsHtml = '';
    if (athena.options?.length) {
        optionsHtml = athena.options.map((opt, i) => {
            const num = String(i + 1).padStart(2, '0');
            const isPref = opt.recommendation === 'preferred';
            const isAvoid = opt.recommendation === 'avoid';
            const recColor = isPref ? '#059669' : isAvoid ? '#DC2626' : '#7C3AED';
            const recBg = isPref ? '#ECFDF5' : isAvoid ? '#FEF2F2' : '#F5F3FF';
            const recBorder = isPref ? '#059669' : isAvoid ? '#DC2626' : '#7C3AED';
            const cortexLink = buildCortexMailto(jobId, i + 1, opt.title);

            // Real-world examples
            let exHtml = '';
            if (opt.realWorldExamples && opt.realWorldExamples.length > 0) {
                const items = opt.realWorldExamples.map(ex =>
                    `<tr><td style="padding: 3px 0 3px 12px; font-size: 13px; line-height: 1.5; color: ${tx};">â€¢ ${ex}</td></tr>`
                ).join('');
                exHtml = `
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 14px; background: #F8FAFC; border-radius: 4px;">
                        <tr><td style="padding: 10px 14px 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: ${txm}; font-weight: 700;">Real-World Examples</td></tr>
                        ${items}
                        <tr><td style="padding: 4px;"></td></tr>
                    </table>`;
            }

            // Implementation details
            let implHtml = '';
            if (opt.implementationDetails) {
                implHtml = `
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 14px;">
                        <tr><td style="font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: ${txm}; font-weight: 700; padding-bottom: 6px;">Implementation</td></tr>
                        <tr><td style="background: ${dk}; color: #E2E8F0; padding: 14px; border-radius: 4px; font-family: ${mono}; font-size: 13px; line-height: 1.6;">${opt.implementationDetails}</td></tr>
                    </table>`;
            }

            return `
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; border: 1px solid #E2E8F0; border-radius: 6px; border-collapse: separate;">
                    <!-- Vector header bar -->
                    <tr><td style="background: ${recBg}; padding: 10px 16px; border-bottom: 2px solid ${recBorder}; border-radius: 6px 6px 0 0;">
                        <table width="100%" cellpadding="0" cellspacing="0"><tr>
                            <td style="font-size: 14px; font-weight: 700; color: ${dk}; font-family: ${sans};">${num}. ${opt.title}</td>
                            <td align="right" style="font-size: 10px; font-weight: 700; color: ${recColor}; text-transform: uppercase; letter-spacing: 1px;">${opt.recommendation}</td>
                        </tr></table>
                    </td></tr>
                    <!-- Description -->
                    <tr><td style="padding: 16px; font-size: 14px; line-height: 1.7; color: ${tx}; font-family: ${sans};">${opt.description}</td></tr>
                    <!-- Details block -->
                    <tr><td style="padding: 0 16px;">
                        ${implHtml}
                        ${exHtml}
                    </td></tr>
                    <!-- Tradeoffs -->
                    <tr><td style="padding: 14px 16px 0;">
                        <table width="100%" cellpadding="0" cellspacing="0"><tr>
                            <td style="font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: ${txm}; font-weight: 700; padding-bottom: 4px;">Tradeoffs &amp; Risks</td>
                        </tr><tr>
                            <td style="font-size: 13px; line-height: 1.5; color: #94A3B8; font-style: italic;">${opt.tradeoffs}</td>
                        </tr></table>
                    </td></tr>
                    <!-- CORTEX action -->
                    <tr><td style="padding: 14px 16px 16px;">
                        <a href="${cortexLink}" style="display: inline-block; background: ${dk}; color: #fff; text-decoration: none; padding: 8px 18px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-radius: 4px; font-family: ${sans};">Forward to CORTEX â†’</a>
                    </td></tr>
                </table>`;
        }).join('');
    }

    // --- Agents ---
    const agentsHtml = athena.suggestedAgents?.length ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
            <tr><td style="font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: ${txm}; font-weight: 700; padding-bottom: 8px;">Required Agents</td></tr>
            <tr><td>${athena.suggestedAgents.map(a =>
                `<span style="display: inline-block; background: #F1F5F9; color: ${tx}; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; margin: 0 4px 4px 0;">${a}</span>`
            ).join('')}</td></tr>
        </table>` : '';

    // --- Constitutional Flags ---
    const flagsHtml = athena.constitutionalFlags?.length ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; background: #FEF2F2; border-left: 3px solid #EF4444; border-radius: 0 4px 4px 0;">
            <tr><td style="padding: 14px 16px;">
                <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #B91C1C; font-weight: 700; margin-bottom: 8px;">Constitutional Flags</div>
                ${athena.constitutionalFlags.map(f => `<div style="font-size: 13px; color: #7F1D1D; line-height: 1.6;">â€¢ ${f}</div>`).join('')}
            </td></tr>
        </table>` : '';

    // --- Full email ---
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background: #F1F5F9; font-family: ${sans}; -webkit-font-smoothing: antialiased;">
<div style="display:none;font-size:1px;color:#F1F5F9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">ATHENA Briefing: ${athena.directive}</div>

<!-- Outer wrapper â€” full width -->
<table width="100%" cellpadding="0" cellspacing="0" style="background: #F1F5F9;">
<tr><td align="center" style="padding: 0;">

<!-- Content table -->
<table width="100%" cellpadding="0" cellspacing="0" style="max-width: 100%; background: #ffffff;">

    <!-- Header -->
    <tr><td style="background: ${dk}; padding: 20px 24px 18px;">
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td style="font-size: 10px; font-weight: 700; color: ${accent}; text-transform: uppercase; letter-spacing: 2px; font-family: ${sans};">Creative Liberation Engine Briefing</td>
                <td align="right" style="font-size: 11px; color: #94A3B8; font-family: ${sans};">${date} Â· <span style="font-family: ${mono}; background: #1E293B; padding: 1px 5px; border-radius: 3px; color: #CBD5E1; font-size: 10px;">${jobId}</span></td>
            </tr>
        </table>
    </td></tr>

    <!-- Directive -->
    <tr><td style="background: ${dk}; padding: 0 24px 22px;">
        <div style="font-family: ${serif}; font-size: 26px; font-weight: 700; color: #ffffff; line-height: 1.3;">${athena.directive}</div>
    </td></tr>

    <!-- Relevance bar -->
    <tr><td style="padding: 0;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="background: ${accent}; padding: 6px 24px; font-size: 10px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 1.5px;">${relLabel} Â· ${inceptionRelevance}% Â· ${catStr}</td>
        </tr></table>
    </td></tr>

    <!-- Source Material -->
    <tr><td style="padding: 20px 24px; border-bottom: 1px solid #E2E8F0;">
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: ${txm}; font-weight: 700; padding-bottom: 8px;">Source Material</td></tr>
            <tr><td style="font-family: ${serif}; font-size: 18px; font-weight: 700; color: ${dk}; line-height: 1.4; padding-bottom: 6px;">${sourceArticle.title}</td></tr>
            <tr><td style="font-size: 13px; color: ${txm}; padding-bottom: 8px;">By <span style="font-weight: 600; color: ${tx};">${sourceArticle.author || 'Unknown'}</span></td></tr>
            <tr><td><a href="${sourceArticle.url}" style="color: ${accent}; text-decoration: none; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Read Original â†’</a></td></tr>
        </table>
    </td></tr>

    <!-- Strategic Analysis -->
    <tr><td style="padding: 20px 24px; border-bottom: 1px solid #E2E8F0;">
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: ${txm}; font-weight: 700; padding-bottom: 10px; border-bottom: 2px solid ${accent}; display: inline-block;">Strategic Analysis</td></tr>
            <tr><td style="padding-top: 12px; font-size: 15px; line-height: 1.8; color: ${tx}; font-family: ${sans};">${athena.rationale}</td></tr>
        </table>
        ${agentsHtml}
    </td></tr>

    ${flagsHtml ? `<tr><td style="padding: 20px 24px 0;">${flagsHtml}</td></tr>` : ''}

    <!-- Execution Vectors -->
    ${athena.options?.length ? `
    <tr><td style="padding: 20px 24px;">
        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: ${txm}; font-weight: 700; padding-bottom: 16px; border-bottom: 2px solid ${dk}; display: inline-block; margin-bottom: 20px;">Execution Vectors</div>
        ${optionsHtml}
    </td></tr>` : ''}

    <!-- Footer -->
    <tr><td style="background: #F8FAFC; padding: 16px 24px; border-top: 1px solid #E2E8F0;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size: 11px; color: ${txm}; font-family: ${sans};"><strong>ATHENA</strong> Â· Creative Liberation Engine</td>
            <td align="right" style="font-size: 11px; color: #94A3B8; font-family: ${sans};">Reply or forward to CORTEX to execute</td>
        </tr></table>
    </td></tr>

</table>
</td></tr>
</table>

</body>
</html>`;
}

