/**
 * Mailchannels Email API — Outbound Provider
 *
 * Uses the Mailchannels Email API (api.mailchannels.net/tx/v1/send)
 * Requires MAILCHANNELS_API_KEY secret (free tier: 100 emails/day)
 * Sign up: https://www.mailchannels.com
 *
 * Docs: https://api.mailchannels.net/tx/v1/documentation
 */

export interface MailchannelsSendOptions {
  to: string | string[];
  cc?: string;
  bcc?: string;
  from: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailchannelsSendResult {
  ok: boolean;
  status: number;
  error?: string;
}

/**
 * Send an email via Mailchannels Email API.
 * Falls back gracefully if API key not configured.
 */
export async function sendViaMailchannels(
  apiKey: string,
  opts: MailchannelsSendOptions,
): Promise<MailchannelsSendResult> {
  const toAddresses = Array.isArray(opts.to) ? opts.to : [opts.to];

  const body = {
    personalizations: [
      {
        to: toAddresses.map((email) => ({ email })),
        ...(opts.cc ? { cc: [{ email: opts.cc }] } : {}),
        ...(opts.bcc ? { bcc: [{ email: opts.bcc }] } : {}),
      },
    ],
    from: {
      email: opts.from,
      name: opts.fromName ?? 'Creative Liberation Engine',
    },
    ...(opts.replyTo ? { reply_to: { email: opts.replyTo } } : {}),
    subject: opts.subject,
    content: [
      { type: 'text/plain', value: opts.text },
      ...(opts.html ? [{ type: 'text/html', value: opts.html }] : []),
    ],
  };

  try {
    const resp = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Api-Key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (resp.ok || resp.status === 202) {
      return { ok: true, status: resp.status };
    }

    const errText = await resp.text().catch(() => 'unknown error');
    console.error(`[agent-mail] Mailchannels send failed ${resp.status}: ${errText}`);
    return { ok: false, status: resp.status, error: errText };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[agent-mail] Mailchannels fetch error: ${msg}`);
    return { ok: false, status: 0, error: msg };
  }
}
