import nodemailer from 'nodemailer';
import axios from 'axios';
import { Resend } from 'resend';

// ─── ZERO DAY — Notifier ──────────────────────────────────────────────────────
// RELAY agent's outbound communication layer.
// Sends transactional emails (Resend) and SMS (Twilio) for client milestones.

export type NotificationType =
    | 'intake_received'
    | 'contract_sent'
    | 'invoice_sent'
    | 'deliverable_sent'
    | 'approval_received'
    | 'revision_requested'
    | 'project_complete'
    | 'follow_up_needed'
    | 'payment_received'
    | 'payment_overdue'
    | 'validation_sent'
    | 'raw_message';

export interface NotificationPayload {
    type: NotificationType;
    to_email?: string;
    to_phone?: string;
    client_name: string;
    project_title?: string;
    body?: string;
    cta_url?: string;
    cta_label?: string;
    amount?: number;
    attachments?: { filename: string; content: Buffer | string }[];
}

// ─── Email Templates ──────────────────────────────────────────────────────────

const EMAIL_TEMPLATES: Record<NotificationType, (p: NotificationPayload) => { subject: string; html: string }> = {
    intake_received: (p) => ({
        subject: `We received your project brief, ${p.client_name} ✨`,
        html: emailWrapper(`
      <h2>Your brief is in our hands.</h2>
      <p>Hi ${p.client_name},</p>
      <p>We've received everything we need to get started on <strong>${p.project_title}</strong>. Our team will review your brief and reach back within 24 hours with a proposal and timeline.</p>
      ${p.cta_url ? `<a href="${p.cta_url}" class="btn">${p.cta_label || 'View Your Portal'}</a>` : ''}
    `),
    }),
    contract_sent: (p) => ({
        subject: `Your contract is ready — ${p.project_title}`,
        html: emailWrapper(`
      <h2>Ready for your signature.</h2>
      <p>Hi ${p.client_name},</p>
      <p>The contract for <strong>${p.project_title}</strong> is ready for review and signature. Please take a moment to read it through and reach out if you have any questions.</p>
      ${p.cta_url ? `<a href="${p.cta_url}" class="btn">Review & Sign Contract</a>` : ''}
    `),
    }),
    invoice_sent: (p) => ({
        subject: `Invoice for ${p.project_title}${p.amount ? ` — $${p.amount.toLocaleString()}` : ''}`,
        html: emailWrapper(`
      <h2>Invoice ready for payment.</h2>
      <p>Hi ${p.client_name},</p>
      <p>An invoice${p.amount ? ` for $${p.amount.toLocaleString()}` : ''} has been issued for <strong>${p.project_title}</strong>.</p>
      ${p.cta_url ? `<a href="${p.cta_url}" class="btn">Pay Invoice</a>` : ''}
    `),
    }),
    deliverable_sent: (p) => ({
        subject: `Your deliverable is ready for review — ${p.project_title}`,
        html: emailWrapper(`
      <h2>Ready for your eyes. 👀</h2>
      <p>Hi ${p.client_name},</p>
      <p>A new deliverable for <strong>${p.project_title}</strong> is ready for your review. Please take a look when you get a chance — we look forward to your feedback.</p>
      ${p.body ? `<p>${p.body}</p>` : ''}
      ${p.cta_url ? `<a href="${p.cta_url}" class="btn">Review Deliverable</a>` : ''}
    `),
    }),
    approval_received: (p) => ({
        subject: `Deliverable approved ✅ — ${p.project_title}`,
        html: emailWrapper(`
      <h2>Approved — moving forward!</h2>
      <p>Hi ${p.client_name},</p>
      <p>The deliverable for <strong>${p.project_title}</strong> has been approved. We're moving to the next phase.</p>
    `),
    }),
    revision_requested: (p) => ({
        subject: `Revision request received — ${p.project_title}`,
        html: emailWrapper(`
      <h2>Revision request noted.</h2>
      <p>Hi ${p.client_name},</p>
      <p>We've received your feedback on <strong>${p.project_title}</strong> and will incorporate your changes. We'll reach back once the revision is complete.</p>
      ${p.body ? `<blockquote>${p.body}</blockquote>` : ''}
    `),
    }),
    project_complete: (p) => ({
        subject: `🎉 Project complete — ${p.project_title}`,
        html: emailWrapper(`
      <h2>It's a wrap!</h2>
      <p>Hi ${p.client_name},</p>
      <p><strong>${p.project_title}</strong> is officially complete. It's been a real pleasure working with you, and we hope the results exceed expectations.</p>
      ${p.cta_url ? `<a href="${p.cta_url}" class="btn">Download Final Assets</a>` : ''}
      <p style="margin-top: 32px;">If you have more projects in mind — or if you'd like to refer us to someone — we'd love to hear from you.</p>
    `),
    }),
    follow_up_needed: (p) => ({
        subject: `Following up — ${p.project_title}`,
        html: emailWrapper(`
      <h2>Just checking in.</h2>
      <p>Hi ${p.client_name},</p>
      <p>We noticed we haven't heard back yet on <strong>${p.project_title}</strong>. No rush — just wanted to make sure you have everything you need and offer to answer any questions.</p>
      ${p.cta_url ? `<a href="${p.cta_url}" class="btn">View in Portal</a>` : ''}
    `),
    }),
    payment_received: (p) => ({
        subject: `Payment received — thank you! ${p.amount ? `($${p.amount.toLocaleString()})` : ''}`,
        html: emailWrapper(`
      <h2>Payment confirmed. ✅</h2>
      <p>Hi ${p.client_name},</p>
      <p>We've received your payment${p.amount ? ` of $${p.amount.toLocaleString()}` : ''} for <strong>${p.project_title}</strong>. Thank you!</p>
    `),
    }),
    payment_overdue: (p) => ({
        subject: `Invoice overdue — ${p.project_title}`,
        html: emailWrapper(`
      <h2>Friendly reminder on your invoice.</h2>
      <p>Hi ${p.client_name},</p>
      <p>We wanted to follow up on an outstanding invoice${p.amount ? ` of $${p.amount.toLocaleString()}` : ''} for <strong>${p.project_title}</strong>. Please let us know if you have any questions or need alternative payment arrangements.</p>
      ${p.cta_url ? `<a href="${p.cta_url}" class="btn">Pay Now</a>` : ''}
    `),
    }),
    validation_sent: (p) => ({
        subject: `ACTION REQUIRED: Validate deployment for ${p.project_title}`,
        html: emailWrapper(`
      <h2>Ship complete. Validation required.</h2>
      <p>Hi ${p.client_name},</p>
      <p>Our autonomous SHIP agents have completed code execution for <strong>${p.project_title}</strong>.</p>
      <p>Please click the link below to validate the deployment before it goes live to production.</p>
      ${p.cta_url ? `<a href="${p.cta_url}" class="btn">Validate Deployment</a>` : ''}
    `),
    }),
    raw_message: (p) => ({ subject: '', html: '' }),
};

// ─── HTML Email Wrapper ───────────────────────────────────────────────────────

function emailWrapper(content: string): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body { font-family: -apple-system, 'Outfit', sans-serif; background: #f5f0e8; margin: 0; padding: 0; }
  .wrapper { max-width: 600px; margin: 40px auto; background: #0a0a0f; border-radius: 16px; overflow: hidden; }
  .header { background: linear-gradient(135deg, #b87333, #d4956a); padding: 32px; text-align: center; }
  .header-logo { font-size: 13px; font-weight: 800; letter-spacing: 3px; color: #0a0a0f; text-transform: uppercase; }
  .body { padding: 40px; color: #f5f0e8; }
  h2 { font-size: 1.5rem; font-weight: 700; margin: 0 0 20px; color: #f5f0e8; }
  p { line-height: 1.7; color: rgba(245,240,232,0.75); margin: 0 0 16px; }
  blockquote { border-left: 3px solid #b87333; padding-left: 16px; color: rgba(245,240,232,0.6); font-style: italic; }
  .btn { display: inline-block; margin: 24px 0; padding: 14px 28px; background: linear-gradient(135deg, #b87333, #d4956a); color: #0a0a0f; font-weight: 700; text-decoration: none; border-radius: 10px; font-size: 14px; }
  .footer { padding: 24px 40px; border-top: 1px solid rgba(245,240,232,0.1); color: rgba(245,240,232,0.3); font-size: 12px; }
</style></head><body>
<div class="wrapper">
  <div class="header"><div class="header-logo">⚡ Creative Liberation Engine</div></div>
  <div class="body">${content}</div>
  <div class="footer">Creative Liberation Engine · Whole Trout Media · You're receiving this because you're a client or prospect.</div>
</div>
</body></html>`;
}

// ─── Notifier Class ───────────────────────────────────────────────────────────

export class ZeroDayNotifier {
    private emailTransport: nodemailer.Transporter | null = null;
    private resend: Resend | null = null;

    constructor() {
        if (process.env.RESEND_API_KEY) {
            this.resend = new Resend(process.env.RESEND_API_KEY);
        }

        // Gmail OAuth2 SMTP (Fallback)
        if (!this.resend && process.env.GMAIL_CLIENT_ID && process.env.GMAIL_REFRESH_TOKEN) {
            this.emailTransport = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    type: 'OAuth2',
                    user: process.env.ADMIN_EMAIL || 'inquiries@creativeliberationengine.org',
                    clientId: process.env.GMAIL_CLIENT_ID,
                    clientSecret: process.env.GMAIL_CLIENT_SECRET,
                    refreshToken: process.env.GMAIL_REFRESH_TOKEN
                }
            });
        }
    }

    async send(payload: NotificationPayload): Promise<{ email: boolean; sms: boolean }> {
        const results = { email: false, sms: false };

        // Email
        if (payload.to_email) {
            const template = EMAIL_TEMPLATES[payload.type](payload);
            results.email = await this.sendEmail(payload.to_email, template.subject, template.html, payload.attachments);
        }

        // SMS (Telnyx)
        if (payload.to_phone && process.env.TELNYX_API_KEY) {
            const smsBody = this.buildSMSBody(payload);
            results.sms = await this.sendSMS(payload.to_phone, smsBody);
        }

        console.log(`[ZERO DAY NOTIFIER] ${payload.type} → ${payload.to_email ?? payload.to_phone}`, results);
        return results;
    }

    private async sendEmail(to: string, subject: string, html: string, attachments?: { filename: string; content: Buffer | string }[]): Promise<boolean> {
        const fromEmail = `"${process.env.FROM_NAME || 'Creative Liberation Engine'}" <${process.env.FROM_EMAIL || 'inquiries@creativeliberationengine.org'}>`;
        
        // Priority 1: Cloudflare Worker API (agent-mail)
        if (process.env.AGENT_MAIL_API_KEY) {
            try {
                const url = process.env.AGENT_MAIL_URL || 'https://agent-mail.wholetrou.workers.dev/api/send';
                const bodyText = html.replace(/<[^>]*>/g, '');
                const resp = await axios.post(
                    url,
                    {
                        to,
                        subject,
                        body_text: bodyText,
                        body_html: html,
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-Key': process.env.AGENT_MAIL_API_KEY,
                        },
                    }
                );
                if (resp.status === 200 || resp.status === 201) {
                    return true;
                }
                console.error(`[ZERO DAY NOTIFIER] Cloudflare API returned status ${resp.status}`);
            } catch (e: any) {
                console.error(`[ZERO DAY NOTIFIER] Cloudflare send failed:`, e.message);
            }
        }

        // Priority 2: Resend
        if (this.resend) {
            try {
                await this.resend.emails.send({
                    from: fromEmail,
                    to,
                    bcc: process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : undefined,
                    subject,
                    html,
                    attachments: attachments?.map(a => ({ filename: a.filename, content: a.content })) as any,
                });
                return true;
            } catch (e: unknown) {
                console.error(`[ZERO DAY NOTIFIER] Resend failed:`, (e as Error).message);
                return false;
            }
        }

        // Priority 3: Nodemailer (SMTP)
        if (!this.emailTransport) {
            console.log(`[ZERO DAY NOTIFIER] 📧 (dev) Email to ${to}: ${subject}`);
            return true; // Pretend success in dev mode
        }
        try {
            await this.emailTransport.sendMail({
                from: fromEmail,
                to,
                bcc: process.env.ADMIN_EMAIL,
                subject,
                html,
                attachments: attachments?.map(a => ({ filename: a.filename, content: a.content })),
            });
            return true;
        } catch (e: unknown) {
            console.error(`[ZERO DAY NOTIFIER] Nodemailer failed:`, (e as Error).message);
            return false;
        }
    }

    private async sendSMS(to: string, body: string): Promise<boolean> {
        try {
            if (!process.env.TELNYX_API_KEY || !process.env.TELNYX_FROM_NUMBER) {
                console.warn('[ZERO DAY] SMS skipped: Telnyx not configured');
                return false;
            }
            await axios.post(
                'https://api.telnyx.com/v2/messages',
                { from: process.env.TELNYX_FROM_NUMBER, to, text: body },
                { headers: { 'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`, 'Content-Type': 'application/json' } }
            );
            return true;
        } catch (e: unknown) {
            console.error(`[ZERO DAY NOTIFIER] SMS failed:`, (e as Error).message);
            return false;
        }
    }

    private buildSMSBody(p: NotificationPayload): string {
        const smsMap: Record<NotificationType, string> = {
            intake_received: `Hi ${p.client_name}! We got your project brief and will be in touch within 24 hours. — Creative Liberation Engine`,
            contract_sent: `Hi ${p.client_name}, your contract for ${p.project_title} is ready to sign: ${p.cta_url}`,
            invoice_sent: `Invoice ready for ${p.project_title}: ${p.cta_url}`,
            deliverable_sent: `Hi ${p.client_name}! New deliverable ready for your review: ${p.cta_url}`,
            approval_received: `Approved! Moving to the next phase on ${p.project_title}.`,
            revision_requested: `Revision request received for ${p.project_title}. We'll send an update soon.`,
            project_complete: `🎉 ${p.project_title} is complete! Great working with you, ${p.client_name}.`,
            follow_up_needed: `Hi ${p.client_name}, just checking in on ${p.project_title}. Any questions? Reply anytime.`,
            payment_received: `Payment confirmed${p.amount ? ` ($${p.amount})` : ''} for ${p.project_title}. Thank you!`,
            payment_overdue: `Hi ${p.client_name}, friendly reminder: invoice for ${p.project_title} is overdue. ${p.cta_url}`,
            validation_sent: `Hi ${p.client_name}, your autonomous deployment for ${p.project_title} is ready for validation: ${p.cta_url}`,
            raw_message: p.body ?? ''
        };
        return smsMap[p.type];
    }
    // ─── Typed Shorthand Methods (called by server.ts) ────────────────────────

    async sendIntakeConfirmation(p: { client_email: string; client_name: string; session_id: string }): Promise<void> {
        await this.send({
            type: 'intake_received',
            to_email: p.client_email,
            client_name: p.client_name,
            project_title: `Session ${p.session_id}`,
        });
    }

    async sendProjectComplete(p: { client_email: string; client_name: string; project_name: string; portal_url: string }): Promise<void> {
        await this.send({
            type: 'project_complete',
            to_email: p.client_email,
            client_name: p.client_name,
            project_title: p.project_name,
            cta_url: p.portal_url,
            cta_label: 'View Final Assets',
        });
    }

    async sendPaymentReceived(p: { client_email: string; amount: number; invoice_id: string }): Promise<void> {
        await this.send({
            type: 'payment_received',
            to_email: p.client_email,
            client_name: p.client_email, // email as fallback name when not provided
            project_title: `Invoice ${p.invoice_id}`,
            amount: p.amount,
        });
    }

    async sendInvoiceSent(p: { client_email: string; client_name: string; invoice_number: string; amount: number; due_date: string; invoice_url: string }): Promise<void> {
        await this.send({
            type: 'invoice_sent',
            to_email: p.client_email,
            client_name: p.client_name,
            project_title: `Invoice ${p.invoice_number}`,
            amount: p.amount,
            cta_url: p.invoice_url,
            cta_label: 'Pay Invoice',
            body: `Due: ${p.due_date}`,
        });
    }

    async sendMagicLink(p: { client_email: string; client_name: string; magic_link: string; expires_in_minutes: number }): Promise<void> {
        await this.send({
            type: 'intake_received', // closest template — portal access
            to_email: p.client_email,
            client_name: p.client_name,
            project_title: 'Client Portal Access',
            cta_url: p.magic_link,
            cta_label: 'Access Your Portal',
            body: `This link expires in ${p.expires_in_minutes} minutes.`,
        });
    }

    async sendValidationLink(p: { client_email: string; client_name: string; project_name: string; validation_url: string }): Promise<void> {
        await this.send({
            type: 'validation_sent',
            to_email: p.client_email,
            client_name: p.client_name,
            project_title: p.project_name,
            cta_url: p.validation_url,
            cta_label: 'Validate Deployment',
            body: `Autonomous shipping is complete and ready for your review.`,
        });
    }
}

// Singleton
export const notifier = new ZeroDayNotifier();
