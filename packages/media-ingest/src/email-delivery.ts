/**
 * email-delivery.ts — Reel delivery via ZeroDayNotifier
 * Uses the established zero-day email stack: Resend (priority 1) → Gmail OAuth2 nodemailer (fallback).
 * Required env: RESEND_API_KEY OR (GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET + GMAIL_REFRESH_TOKEN + ADMIN_EMAIL)
 */

import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export interface ReelDeliveryPayload {
  eventSlug: string;
  eventLabel: string;
  reelPath: string;
  edlPath: string;
  manifestPath: string;
  clipCount: number;
  durationSec: number;
  nasProjectPath: string;
}

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20MB

// ── Transport builder (mirrors ZeroDayNotifier priority order) ────────────────

function buildTransport(): nodemailer.Transporter | null {
    // Priority 1: Resend via SMTP relay
  if (process.env.RESEND_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY,
      },
    });
  }

  // Priority 2: Gmail App Password (simplest — no OAuth dance)
  if (process.env.GMAIL_APP_PASSWORD) {
    const user = process.env.USER_GOOGLE_EMAIL || process.env.ADMIN_EMAIL || 'inquiries@creativeliberationengine.org';
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }

  // Priority 3: Gmail OAuth2
  if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_REFRESH_TOKEN) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.USER_GOOGLE_EMAIL || process.env.ADMIN_EMAIL,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      },
    });
  }

  return null;
}

// ── HTML email body ───────────────────────────────────────────────────────────

function buildHtml(p: ReelDeliveryPayload): string {
  const mins = Math.floor(p.durationSec / 60);
  const secs = Math.round(p.durationSec % 60);
  const durationLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#f0f0f0;margin:0;padding:0}
  .c{max-width:600px;margin:0 auto;padding:40px 24px}
  .h{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:40px;border-radius:16px;text-align:center;margin-bottom:32px}
  .h h1{margin:0 0 8px;font-size:28px;font-weight:700;color:#fff}
  .h p{margin:0;color:#a0aec0;font-size:14px}
  .badge{display:inline-block;background:#e53e3e;color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:16px;letter-spacing:1px;text-transform:uppercase}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px}
  .stat{background:#1a1a2e;border:1px solid #2d3748;border-radius:12px;padding:20px;text-align:center}
  .sv{font-size:32px;font-weight:700;color:#63b3ed}
  .sl{font-size:12px;color:#718096;margin-top:4px;text-transform:uppercase;letter-spacing:.5px}
  .sec{background:#111;border:1px solid #2d3748;border-radius:12px;padding:24px;margin-bottom:24px}
  .sec h3{margin:0 0 16px;font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#a0aec0}
  .code{background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:12px 16px;font-family:monospace;font-size:12px;color:#58a6ff;word-break:break-all}
  .ft{text-align:center;color:#4a5568;font-size:12px;margin-top:40px}
</style></head><body>
<div class="c">
  <div class="h">
    <div class="badge">🎬 Creative Liberation Engine</div>
    <h1>🎉 Reel Ready</h1>
    <p>${p.eventLabel}</p>
  </div>
  <div class="stats">
    <div class="stat"><div class="sv">${p.clipCount}</div><div class="sl">Clips</div></div>
    <div class="stat"><div class="sv">${durationLabel}</div><div class="sl">Duration</div></div>
    <div class="stat"><div class="sv">9:16</div><div class="sl">Format</div></div>
  </div>
  <div class="sec">
    <h3>📦 Attached</h3>
    <p style="margin:0 0 8px;font-size:14px;">Reel: <strong>${path.basename(p.reelPath)}</strong></p>
    <p style="margin:0;font-size:13px;color:#718096;">EDL timeline attached for DaVinci Resolve import.</p>
  </div>
  <div class="sec">
    <h3>🎬 DaVinci Resolve — Project Folder</h3>
    <div class="code">${p.nasProjectPath}</div>
    <p style="margin:12px 0 0;font-size:13px;color:#718096;">File → Import → Timeline (EDL) → select the .edl → relink media to proxies/</p>
  </div>
  <div class="ft"><p>Creative Liberation Engine · Sony A1 II Ingest Pipeline · Creative Liberation Engine v5</p></div>
</div></body></html>`;
}

// ── Main delivery ─────────────────────────────────────────────────────────────

export async function deliverReel(payload: ReelDeliveryPayload): Promise<void> {
  const to   = process.env.OPERATOR_EMAIL || process.env.ADMIN_EMAIL || 'justin@wholetroutmedia.com';
  const from = process.env.FROM_EMAIL
    ? `"Creative Liberation Engine" <${process.env.FROM_EMAIL}>`
    : '"Creative Liberation Engine" <engine@wholetroutmedia.com>';

  const html = buildHtml(payload);
  const text = `🎬 ${payload.eventLabel} — Reel Ready. Reel: ${path.basename(payload.reelPath)}. timeline: ${path.basename(payload.edlPath)}. folder: ${payload.nasProjectPath}`;

  // Priority 1: Cloudflare Worker API (agent-mail)
  if (process.env.AGENT_MAIL_API_KEY) {
    try {
      const url = process.env.AGENT_MAIL_URL || 'https://agent-mail.wholetrou.workers.dev/api/send';
      const axios = require('axios');
      const resp = await axios.post(
        url,
        {
          to,
          subject: `🎬 ${payload.eventLabel} — Reel Ready`,
          body_text: text,
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
        console.log(`[email] ✅ Delivered to ${to} via Cloudflare Worker`);
        return;
      }
    } catch (e: any) {
      console.warn(`[email] Cloudflare Worker send failed: ${e.message}. Trying SMTP fallbacks...`);
    }
  }

  const transport = buildTransport();
  if (!transport) {
    console.warn('[email] No email transport configured (need RESEND_API_KEY or GMAIL_CLIENT_ID + GMAIL_REFRESH_TOKEN)');
    console.log(`[email] Reel path: ${payload.reelPath}`);
    console.log(`[email] EDL path:  ${payload.edlPath}`);
    return;
  }

  // Build attachments
  const attachments: nodemailer.SendMailOptions['attachments'] = [];

  const reelStat = fs.existsSync(payload.reelPath) ? fs.statSync(payload.reelPath) : null;
  if (reelStat && reelStat.size <= MAX_ATTACHMENT_BYTES) {
    attachments.push({ filename: path.basename(payload.reelPath), path: payload.reelPath });
  } else if (reelStat) {
    console.warn(`[email] Reel too large (${(reelStat.size / 1024 / 1024).toFixed(1)}MB) — sending NAS path only`);
  }

  if (fs.existsSync(payload.edlPath)) {
    attachments.push({ filename: path.basename(payload.edlPath), path: payload.edlPath });
  }

  const result = await transport.sendMail({
    from,
    to,
    subject: `🎬 ${payload.eventLabel} — Reel Ready`,
    html: buildHtml(payload),
    attachments,
  });

  console.log(`[email] ✅ Delivered to ${to} — messageId: ${result.messageId}`);
}
