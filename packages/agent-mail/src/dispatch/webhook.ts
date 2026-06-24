/**
 * CLE Agent Mail — Dispatch Webhook
 *
 * Fires to the CLE dispatch server on inbound email events.
 * Creates a dispatch task automatically for agent processing.
 * HMAC-SHA256 signed if WEBHOOK_SECRET is configured.
 */

import type { Env, WebhookPayload } from '../types';

/**
 * Fire a webhook to the dispatch server.
 */
export async function fireWebhook(
  env: Env,
  payload: WebhookPayload,
): Promise<void> {
  const webhookUrl = env.WEBHOOK_URL;
  if (!webhookUrl) return;

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'CLE-AgentMail/1.0',
  };

  // HMAC-SHA256 signature if secret is configured
  if (env.WEBHOOK_SECRET) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(env.WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const hex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    headers['X-Webhook-Signature'] = hex;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body,
    });
    if (!response.ok) {
      console.error(`[agent-mail] Webhook failed: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.error('[agent-mail] Webhook error:', err);
  }
}

/**
 * Fire a dispatch task creation for an inbound email.
 */
export async function dispatchInboundTask(
  env: Env,
  message: { id: string; thread_id: string; from: string; to: string; subject: string; agent_target: string | null },
): Promise<void> {
  // Fire webhook notification
  await fireWebhook(env, {
    event: 'message.received',
    data: {
      id: message.id,
      thread_id: message.thread_id,
      from: message.from,
      to: message.to,
      subject: message.subject,
      direction: 'inbound',
      approved: 0,
      agent_target: message.agent_target,
    },
    timestamp: Math.floor(Date.now() / 1000),
  });

  // Also create a dispatch task if dispatch URL is available
  const dispatchUrl = env.WEBHOOK_URL;
  if (!dispatchUrl) return;

  const subjectUpper = message.subject.toUpperCase();
  const actionMatch = subjectUpper.match(/^(ACTIVATE|PARK|DISCARD)\s+(IE-IDX-\d+)/);

  // If this is an action email sent to Sentinel, map it to the Sentinel API
  if (message.agent_target?.toUpperCase() === 'SENTINEL' && actionMatch) {
    const action = actionMatch[1];
    const jobId = actionMatch[2];
    const sentinelApiUrl = dispatchUrl.replace(/\/+$/, '') + '/api/sentinel/ideation/action';
    
    try {
      await fetch(sentinelApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          action: action,
          source_email: message.from,
          message_id: message.id,
        }),
      });
      console.log(`[agent-mail] Sentinel Action dispatched: ${action} for ${jobId}`);
    } catch (err) {
      console.error('[agent-mail] Sentinel Action API error:', err);
    }
    return; // Skip normal inbox task creation for action emails
  }

  const taskUrl = dispatchUrl.replace(/\/+$/, '') + '/api/tasks';
  try {
    await fetch(taskUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Inbound email: ${message.subject.substring(0, 60)}`,
        description: `From: ${message.from}\nTo: ${message.to}\nAgent: ${message.agent_target ?? 'unrouted'}\nMessage ID: ${message.id}`,
        workstream: 'inbox',
        priority: 'medium',
        source: 'agent-mail',
        assigned_to_agent: message.agent_target?.toUpperCase() ?? 'VAULT',
      }),
    });
  } catch (err) {
    console.error('[agent-mail] Dispatch task creation error:', err);
  }
}
