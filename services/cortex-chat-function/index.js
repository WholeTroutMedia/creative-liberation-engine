// Node 20+ has native fetch — no external deps needed
const DISPATCH_URL = process.env.DISPATCH_URL || 'https://dispatch.cleengine.systems';

/**
 * Google Chat App handler — deployed as Cloud Function.
 * Receives Chat events via Google's infrastructure (no webhook URL needed).
 * Routes messages to NAS dispatch and responds in-chat.
 */
exports.cortexChat = async (req, res) => {
  const event = req.body;
  
  console.log(`[CORTEX-CHAT] Event: ${event.type} at ${event.eventTime}`);

  try {
    switch (event.type) {
      case 'ADDED_TO_SPACE': {
        return res.json({
          text: `⚡ *CORTEX Online* — Creative Liberation Engine V6\n\n` +
                `Commands:\n` +
                `• \`/status\` — System health\n` +
                `• \`/tasks\` — Active task queue\n` +
                `• \`/briefing\` — Daily briefing\n` +
                `• \`/anomalies\` — Recent issues\n` +
                `• \`/deploy\` — Recent deployments\n` +
                `• \`/wiki\` — Architecture wiki\n` +
                `• \`/situation\` — Situation Room\n\n` +
                `Or just talk to me. I route through NAS dispatch.`,
        });
      }

      case 'MESSAGE': {
        const msg = event.message;
        if (!msg) return res.json({ text: '⚠️ Empty message.' });

        const text = (msg.argumentText || msg.text || '').trim();
        const sender = msg.sender?.displayName || 'Unknown';
        const senderEmail = msg.sender?.email || '';

        console.log(`[CORTEX-CHAT] ${sender}: ${text}`);

        // ── Slash Commands ─────────────────────────────────
        if (text.startsWith('/status')) {
          return res.json({ text: await cmdStatus() });
        }
        if (text.startsWith('/tasks')) {
          return res.json({ text: await cmdTasks() });
        }
        if (text.startsWith('/briefing')) {
          return res.json({
            text: `📋 *Daily Briefing*\n\nhttps://docs.google.com/document/d/1T6jT2MIMq8mcRnrk7kwAOGOpK2clZpxzG4gaJH5c9s4/edit`,
          });
        }
        if (text.startsWith('/anomalies')) {
          return res.json({
            text: `⚠️ *Anomaly Log*\n\nhttps://docs.google.com/spreadsheets/d/1HQVJicSmEYG5lBIEPPG8jX0vIuVEOx_AiG0ZONTny98/edit`,
          });
        }
        if (text.startsWith('/deploy')) {
          return res.json({
            text: `🚀 *Deploy History*\n\nhttps://docs.google.com/spreadsheets/d/1HQVJicSmEYG5lBIEPPG8jX0vIuVEOx_AiG0ZONTny98/edit`,
          });
        }
        if (text.startsWith('/wiki')) {
          return res.json({
            text: `📚 *Architecture Wiki*\n\nhttps://docs.google.com/document/d/1Hde9HcXxsBAIgrZxAhdQxmjvETtnjGYh_jC_XmhMhDw/edit`,
          });
        }
        if (text.startsWith('/situation')) {
          return res.json({
            text: `🎯 *Situation Room*\n\nhttps://docs.google.com/spreadsheets/d/1HQVJicSmEYG5lBIEPPG8jX0vIuVEOx_AiG0ZONTny98/edit`,
          });
        }

        // ── Natural Language → NAS Dispatch ────────────────
        const dispatchResult = await forwardToDispatch({
          source: 'google-chat',
          sender,
          senderEmail,
          spaceName: msg.space?.name || '',
          spaceDisplay: msg.space?.displayName || '',
          thread: msg.thread?.name || '',
          text,
          timestamp: msg.createTime,
        });

        return res.json({
          text: dispatchResult || 
                `✅ *Received:* "${text}"\n\n_Routed to NAS dispatch for processing._`,
        });
      }

      case 'REMOVED_FROM_SPACE':
        return res.json({});

      default:
        return res.json({ text: `Event: ${event.type}` });
    }
  } catch (err) {
    console.error('[CORTEX-CHAT] Error:', err);
    return res.json({
      text: `⚠️ Error: ${err.message}\n\nNAS dispatch may be offline.`,
    });
  }
};

// ── Helpers ────────────────────────────────────────────────────

async function forwardToDispatch(payload) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(`${DISPATCH_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Chat from ${payload.sender}: ${payload.text.substring(0, 50)}`,
        description: payload.text,
        project: 'creative-liberation-engine',
        workstream: 'communications',
        priority: 'P1',
        created_by: 'google-chat',
        source: 'google-chat',
        metadata: {
           sender: payload.sender,
           senderEmail: payload.senderEmail,
           spaceName: payload.spaceName,
           spaceDisplay: payload.spaceDisplay,
           thread: payload.thread
        }
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = await resp.json();
      if (data.success && data.task) {
        return `✅ Task queued successfully on NAS Dispatch!\n\nID: \`${data.task.id}\`\nStatus: \`${data.task.status}\``;
      }
      return data.response || data.message || '✅ Received by dispatch.';
    } else {
      const errText = await resp.text();
      console.error('[CORTEX-CHAT] Dispatch returned non-OK:', resp.status, errText);
      return `⚠️ NAS Dispatch rejected the request (Status ${resp.status}).`;
    }
  } catch (e) {
    console.error('[CORTEX-CHAT] Dispatch error:', e.message);
    return `⚠️ NAS Dispatch error: ${e.message}`;
  }
}

async function cmdStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(`${DISPATCH_URL}/api/status`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const d = await resp.json();
      return `🎯 *Creative Liberation Engine Status*\n\n` +
             `• NAS: 🟢 Online\n` +
             `• Dispatch: 🟢 Active\n` +
             `• Uptime: ${d.uptime || 'N/A'}\n` +
             `• Tasks: ${d.activeTasks || 0}\n` +
             `• Queue: ${d.queueDepth || 0}\n\n` +
             `📊 https://docs.google.com/spreadsheets/d/1HQVJicSmEYG5lBIEPPG8jX0vIuVEOx_AiG0ZONTny98/edit`;
    }
    return '⚠️ Dispatch unreachable.';
  } catch(e) {
    return '⚠️ Cannot reach NAS dispatch at 127.0.0.1:5150';
  }
}

async function cmdTasks() {
  return `✅ *Active Task Queue*\n\n` +
         `1. 🔌 Wire Chat → Dispatch (Apr 30)\n` +
         `2. 📧 Activate Gmail (Apr 28)\n` +
         `3. 📋 V6 Parity Matrix (May 1)\n` +
         `4. 🔗 Telemetry Sync (May 3)\n` +
         `5. 🧠 RAG Export (May 5)\n\n` +
         `View: https://tasks.google.com`;
}
