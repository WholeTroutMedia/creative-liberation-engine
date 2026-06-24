/**
 * CORTEX Chat Bridge — Google Chat → NAS Dispatch
 * 
 * This service receives webhook events from Google Chat (messages, @mentions,
 * space events) and routes them through the Creative Liberation Engine dispatch pipeline.
 * Responses are sent back to the Chat Space via the Google Chat API.
 * 
 * Architecture:
 *   Google Chat Space → Webhook POST → This Service → NAS Dispatch → Response → Chat API
 * 
 * Runs on NAS port 5170 behind Cloudflare tunnel for external webhook delivery.
 */

import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

const PORT = 5170;
const DISPATCH_URL = 'http://127.0.0.1:5150';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatEvent {
  type: 'MESSAGE' | 'ADDED_TO_SPACE' | 'REMOVED_FROM_SPACE' | 'CARD_CLICKED';
  eventTime: string;
  message?: {
    name: string;
    sender: {
      name: string;
      displayName: string;
      email: string;
      type: 'HUMAN' | 'BOT';
    };
    createTime: string;
    text: string;
    thread: {
      name: string;
    };
    space: {
      name: string;
      displayName: string;
      type: 'DM' | 'ROOM';
    };
    argumentText?: string; // Text after @mention
  };
  user?: {
    name: string;
    displayName: string;
    email: string;
  };
  space?: {
    name: string;
    displayName: string;
    type: string;
  };
}

interface DispatchPayload {
  source: 'google-chat';
  sender: string;
  senderEmail: string;
  spaceName: string;
  spaceDisplayName: string;
  threadName: string;
  messageText: string;
  timestamp: string;
  eventType: string;
}

// ─── Health Check ────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    service: 'cortex-chat-bridge',
    status: 'online',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ─── Google Chat Webhook Endpoint ────────────────────────────────────────────

app.post('/chat/webhook', async (req, res) => {
  const event: ChatEvent = req.body;
  
  console.log(`[CORTEX-CHAT] Received ${event.type} event at ${event.eventTime}`);

  try {
    switch (event.type) {
      case 'ADDED_TO_SPACE': {
        // Bot was added to a space
        const spaceName = event.space?.displayName || 'a space';
        console.log(`[CORTEX-CHAT] Added to space: ${spaceName}`);
        
        res.json({
          text: `⚡ **CORTEX Online** — Creative Liberation Engine V6\n\n` +
                `I'm now monitoring this space. Here's what I can do:\n\n` +
                `• \`/status\` — System health check\n` +
                `• \`/deploy <service>\` — Trigger a deployment\n` +
                `• \`/ideate <topic>\` — Generate ideation brief\n` +
                `• \`/tasks\` — Show active task queue\n` +
                `• \`/briefing\` — Generate daily briefing\n` +
                `• \`/anomalies\` — Recent anomaly log\n\n` +
                `Or just talk to me naturally. I route through NAS dispatch.`,
        });
        break;
      }

      case 'MESSAGE': {
        if (!event.message) {
          res.json({ text: '⚠️ Empty message received.' });
          return;
        }

        const msg = event.message;
        const text = msg.argumentText?.trim() || msg.text?.trim() || '';
        const sender = msg.sender.displayName;
        const senderEmail = msg.sender.email;
        
        console.log(`[CORTEX-CHAT] Message from ${sender} (${senderEmail}): ${text}`);

        // ── Command Router ─────────────────────────────────────────────
        
        if (text.startsWith('/status')) {
          const statusResponse = await getSystemStatus();
          res.json({ text: statusResponse });
          return;
        }

        if (text.startsWith('/tasks')) {
          const tasksResponse = await getTaskQueue();
          res.json({ text: tasksResponse });
          return;
        }

        if (text.startsWith('/briefing')) {
          res.json({ 
            text: `📋 Generating daily briefing...\n\n` +
                  `Check the briefing doc: https://docs.google.com/document/d/1T6jT2MIMq8mcRnrk7kwAOGOpK2clZpxzG4gaJH5c9s4/edit` 
          });
          return;
        }

        if (text.startsWith('/anomalies')) {
          res.json({
            text: `⚠️ Recent Anomalies:\n\n` +
                  `View the full anomaly log in the Situation Room:\n` +
                  `https://docs.google.com/spreadsheets/d/1HQVJicSmEYG5lBIEPPG8jX0vIuVEOx_AiG0ZONTny98/edit#gid=anomaly`
          });
          return;
        }

        // ── Natural Language → Dispatch ─────────────────────────────────
        
        const dispatchPayload: DispatchPayload = {
          source: 'google-chat',
          sender: sender,
          senderEmail: senderEmail,
          spaceName: msg.space.name,
          spaceDisplayName: msg.space.displayName,
          threadName: msg.thread.name,
          messageText: text,
          timestamp: msg.createTime,
          eventType: 'MESSAGE',
        };

        // Forward to NAS dispatch for intelligent routing
        const dispatchResponse = await forwardToDispatch(dispatchPayload);
        
        res.json({
          text: dispatchResponse || `✅ Received: "${text}"\n\n_Routed to NAS dispatch for processing._`,
        });
        break;
      }

      case 'REMOVED_FROM_SPACE': {
        console.log(`[CORTEX-CHAT] Removed from space: ${event.space?.displayName}`);
        res.json({}); // No response needed
        break;
      }

      default: {
        console.log(`[CORTEX-CHAT] Unhandled event type: ${event.type}`);
        res.json({ text: `Received event: ${event.type}` });
      }
    }
  } catch (error) {
    console.error('[CORTEX-CHAT] Error processing event:', error);
    res.json({
      text: `⚠️ CORTEX encountered an error processing your message. The NAS dispatch may be unreachable.\n\nError: ${(error as Error).message}`,
    });
  }
});

// ─── Dispatch Integration ────────────────────────────────────────────────────

async function forwardToDispatch(payload: DispatchPayload): Promise<string> {
  try {
    const response = await fetch(`${DISPATCH_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          title: `Chat from ${payload.sender}`,
          project: 'creative-liberation-engine',
          workstream: 'communications',
          description: `**Event:** ${payload.eventType}\n**Sender:** ${payload.sender} (${payload.senderEmail})\n**Space:** ${payload.spaceDisplayName || payload.spaceName}\n**Message:**\n${payload.messageText}`,
          created_by: 'cortex-chat-bridge',
          source: 'google-chat',
          metadata: payload
      }),
    });

    if (response.ok) {
      const data = await response.json() as any;
      return `✅ Task queued: ${data.id || 'Task created'}`;
    }
    
    return `⚠️ Dispatch returned status ${response.status}`;
  } catch (err) {
    console.error('[CORTEX-CHAT] Dispatch forward failed:', (err as Error).message);
    return `⚠️ Dispatch unreachable: ${(err as Error).message}`;
  }
}

async function getSystemStatus(): Promise<string> {
  try {
    const response = await fetch(`${DISPATCH_URL}/api/status`);
    if (response.ok) {
      const data = await response.json() as any;
      return `🎯 **Creative Liberation Engine Status**\n\n` +
             `• NAS: 🟢 Online\n` +
             `• Dispatch: 🟢 Active\n` +
             `• Uptime: ${data.uptime || 'N/A'}\n` +
             `• Active Tasks: ${data.activeTasks || 0}\n` +
             `• Queue Depth: ${data.queueDepth || 0}\n\n` +
             `📊 Full dashboard: https://docs.google.com/spreadsheets/d/1HQVJicSmEYG5lBIEPPG8jX0vIuVEOx_AiG0ZONTny98/edit`;
    }
    return '⚠️ Dispatch server unreachable. NAS may be offline.';
  } catch {
    return '⚠️ Could not reach dispatch server at 127.0.0.1:5150';
  }
}

async function getTaskQueue(): Promise<string> {
  return `✅ **Active Task Queue**\n\n` +
         `1. 🔌 Wire Google Chat → NAS Dispatch (Due: Apr 30)\n` +
         `2. 📧 Activate Gmail for CORTEX (Due: Apr 28)\n` +
         `3. 📋 Populate V6 Parity Matrix (Due: May 1)\n` +
         `4. 🔗 NAS Telemetry → Situation Room Sync (Due: May 3)\n` +
         `5. 🧠 RAG Knowledge → Drive Export (Due: May 5)\n\n` +
         `View all: https://tasks.google.com`;
}

// ─── Start Server ────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n⚡ CORTEX Chat Bridge v1.0.0`);
  console.log(`  Listening on port ${PORT}`);
  console.log(`  Dispatch target: ${DISPATCH_URL}`);
  console.log(`  Webhook endpoint: POST /chat/webhook`);
  console.log(`  Health check: GET /health\n`);
});
