export {};

/**
 * CLE Agent — Background Service Worker (MV3 / Firefox MV2 compatible)
 *
 * Responsibilities:
 * - Maintain connection to Dispatch Server (DISPATCH_BASE / BMC_WS_URL; set via options for prod)
 * - Forward queued tasks to active popup or content script
 * - Listen for browser tab context signals (URL, title, page type)
 * - Heartbeat ping every 30s to keep dispatch alive
 * - Store agent identity in chrome.storage.local (sovereign, no auth)
 * - Handle TASK messages from BMC WebSocket and execute DOM actions
 * - Send TASK_RESULT back to BMC on completion
 * - Screenshot capability via chrome.tabs.captureVisibleTab
 *
 * Cross-browser: `b` alias resolves to browser (Firefox) or chrome (Chrome/Edge).
 * This single source compiles for all three browsers.
 */

// ─── Cross-Browser API Shim ──────────────────────────────────────────────────
// Firefox exposes `browser` (Promise-based); Chrome/Edge use `chrome` (callback).
// We prefer `browser` if available and fall back to `chrome` so TypeScript types
// stay compatible. All calls below use `b` instead of `chrome` directly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const b: typeof chrome = (typeof (globalThis as any).browser !== 'undefined')
  ? (globalThis as any).browser
  : chrome;

// Detect which browser family we're running in for heartbeat metadata
const BROWSER_FAMILY: 'firefox' | 'chrome' | 'edge' =
  typeof (globalThis as any).browser !== 'undefined' ? 'firefox'
  : navigator.userAgent.includes('Edg/') ? 'edge'
  : 'chrome';

// Zero Day: prod set via options/storage. No 192.168 in source.
const DISPATCH_BASE = 'http://localhost:5050';
const BMC_WS_URL = 'ws://localhost:5100';
const HEARTBEAT_ALARM = 'cle-heartbeat';
const AGENT_ID = 'cle-browser-agent';

// ─── BMC WebSocket Connection ───────────────────────────────────────────────

let bmcSocket: WebSocket | null = null;
let agentId: string = AGENT_ID;

function connectToBMC(id: string) {
  if (bmcSocket && bmcSocket.readyState === WebSocket.OPEN) return;

  bmcSocket = new WebSocket(`${BMC_WS_URL}/${encodeURIComponent(id)}`);

  bmcSocket.onopen = () => {
    console.log(`[CLE] BMC connected as ${id}`);
  };

  bmcSocket.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data as string) as { type: string; payload?: unknown };
      if (msg.type === 'TASK') {
        await handleBMCTask(msg.payload as BmcTaskPayload);
      }
    } catch (e) {
      console.warn('[CLE] BMC bad message:', e);
    }
  };

  bmcSocket.onclose = () => {
    console.log('[CLE] BMC disconnected — will retry on next heartbeat');
    bmcSocket = null;
  };

  bmcSocket.onerror = (err) => {
    console.warn('[CLE] BMC WS error:', err);
    bmcSocket = null;
  };
}

// ─── TASK Execution ─────────────────────────────────────────────────────────

interface BmcTaskPayload {
  taskId?: string;
  action: 'dom-extract' | 'navigate' | 'screenshot' | 'click' | 'scroll';
  url?: string;
  selector?: string;
  tabId?: number;
  x?: number;
  y?: number;
}

async function handleBMCTask(payload: BmcTaskPayload) {
  const { taskId, action } = payload;
  console.log(`[CLE] TASK received: ${action} (id=${taskId ?? 'anon'})`);

  let result: unknown;
  let error: string | undefined;

  try {
    switch (action) {
      case 'navigate': {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error('No active tab');
        await b.tabs.update(tab.id, { url: payload.url });
        await waitForTabLoad(tab.id);
        result = { navigated: true, url: payload.url };
        break;
      }

      case 'dom-extract': {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error('No active tab');
        const extracted = await b.scripting.executeScript({
          target: { tabId: tab.id },
          func: domExtract,
          args: [payload.selector ?? 'body'],
        });
        result = { text: extracted[0]?.result ?? '' };
        break;
      }

      case 'click': {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error('No active tab');
        if (!payload.selector && (payload.x == null || payload.y == null)) {
          throw new Error('click requires selector or x/y coordinates');
        }
        await b.scripting.executeScript({
          target: { tabId: tab.id },
          func: domClick,
          args: [payload.selector ?? null, payload.x ?? null, payload.y ?? null],
        });
        result = { clicked: true };
        break;
      }

      case 'screenshot': {
        const tabId = payload.tabId ?? (await getActiveTab())?.id;
        if (!tabId) throw new Error('No tab for screenshot');
        const dataUrl = await b.tabs.captureVisibleTab({ quality: 90 });
        result = { screenshot: dataUrl };
        break;
      }

      case 'scroll': {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error('No active tab');
        await b.scripting.executeScript({
          target: { tabId: tab.id },
          func: domScroll,
          args: [payload.x ?? 0, payload.y ?? 500],
        });
        result = { scrolled: true };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.warn(`[CLE] TASK ${action} failed:`, error);
  }

  sendTaskResult({ taskId, action, result, error });
}

// ─── DOM Injection Functions (serialized for executeScript) ─────────────────

function domExtract(selector: string): string {
  const el = document.querySelector(selector);
  return el ? (el as HTMLElement).innerText ?? el.textContent ?? '' : '';
}

function domClick(selector: string | null, x: number | null, y: number | null): void {
  if (selector) {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) el.click();
  } else if (x != null && y != null) {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (el) el.click();
  }
}

function domScroll(x: number, y: number): void {
  window.scrollBy(x, y);
}

// ─── Task Result Relay ──────────────────────────────────────────────────────

function sendTaskResult(payload: { taskId?: string; action: string; result?: unknown; error?: string }) {
  if (bmcSocket?.readyState === WebSocket.OPEN) {
    bmcSocket.send(JSON.stringify({ type: 'TASK_RESULT', payload }));
  } else {
    // Fallback: relay via Dispatch REST API
    relayResultViaDispatch(payload).catch(console.warn);
  }
}

async function relayResultViaDispatch(payload: unknown) {
  const { agentId: id } = await b.storage.local.get('agentId');
  await fetch(`${DISPATCH_BASE}/api/tasks/result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId: id || AGENT_ID, result: payload }),
  });
}

// ─── Tab utilities ───────────────────────────────────────────────────────────

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await b.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getAllTabs(): Promise<Array<{ url: string; title: string; tabId: number }>> {
  const tabs = await b.tabs.query({});
  return tabs
    .filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('moz-extension://'))
    .map(t => ({ url: t.url!, title: t.title ?? '', tabId: t.id! }));
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        b.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    b.tabs.onUpdated.addListener(listener);
    // Safety timeout
    setTimeout(resolve, 10_000);
  });
}

// ─── BOOT ───────────────────────────────────────────────────────────────────

b.runtime.onInstalled.addListener(async () => {
  console.log('[CLE] Agent installed — booting dispatch connection');
  await initAgent();
  b.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.5 });
});

b.runtime.onStartup.addListener(async () => {
  await initAgent();
  b.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.5 });
});

async function initAgent() {
  const stored = await b.storage.local.get('agentId');
  if (!stored.agentId) {
    const id = `browser-${crypto.randomUUID().slice(0, 8)}`;
    await b.storage.local.set({ agentId: id });
    agentId = id;
    console.log(`[CLE] New agent identity: ${id}`);
  } else {
    agentId = stored.agentId as string;
  }
  connectToBMC(agentId);
  await pingDispatch();
}

// ─── HEARTBEAT ──────────────────────────────────────────────────────────────

b.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === HEARTBEAT_ALARM) {
    // Reconnect BMC if dropped
    connectToBMC(agentId);
    // Send heartbeat with active tab context
    const tab = await getActiveTab();
    if (bmcSocket?.readyState === WebSocket.OPEN && tab) {
      bmcSocket.send(JSON.stringify({
        type: 'HEARTBEAT',
        payload: { tab: { url: tab.url, title: tab.title } },
      }));
    }
    pingDispatch();
  }
});

async function pingDispatch() {
  try {
    const { agentId: id } = await b.storage.local.get('agentId');
    const allTabs = await getAllTabs();
    await fetch(`${DISPATCH_BASE}/api/agents/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: id || AGENT_ID,
        tool: 'browser-extension',
        browser_family: BROWSER_FAMILY,
        capabilities: ['tab-context', 'all-tabs', 'dom-extract', 'navigate', 'screenshot', 'click', 'scroll'],
        status: 'active',
        // Ship tab manifest so dispatch has it without a separate query
        tab_manifest: allTabs,
        all_tabs_count: allTabs.length,
      }),
    });
  } catch {
    // Dispatch offline — silent fail, retry on next alarm
  }
}

// ─── TAB CONTEXT ─────────────────────────────────────────────────────────────

b.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await b.tabs.get(tabId);
  emitTabContext(tab);
});

b.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') emitTabContext(tab);
});

function emitTabContext(tab: chrome.tabs.Tab) {
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('moz-extension://')) return;
  b.storage.session.set({
    activeTab: {
      url: tab.url,
      title: tab.title,
      tabId: tab.id,
      timestamp: Date.now(),
    },
  });
}

// ─── MESSAGE RELAY ───────────────────────────────────────────────────────────

b.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DISPATCH_TASK') {
    submitToDispatch(message.payload).then(sendResponse);
    return true;
  }
  if (message.type === 'GET_TAB_CONTEXT') {
    b.storage.session.get('activeTab').then(sendResponse);
    return true;
  }
  if (message.type === 'GET_ALL_TABS') {
    // Returns full tab manifest — used by /browser-ideate and dispatch tab endpoint
    getAllTabs().then(sendResponse);
    return true;
  }
  if (message.type === 'GET_STATUS') {
    getAgentStatus().then(sendResponse);
    return true;
  }
  if (message.type === 'EXECUTE_TASK') {
    handleBMCTask(message.payload as BmcTaskPayload).then(sendResponse);
    return true;
  }
});

async function submitToDispatch(payload: Record<string, unknown>) {
  try {
    const res = await fetch(`${DISPATCH_BASE}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function getAgentStatus() {
  const { agentId: id } = await b.storage.local.get('agentId');
  const tab = await b.storage.session.get('activeTab');
  return {
    agentId: id,
    browserFamily: BROWSER_FAMILY,
    ...tab,
    online: true,
    bmcConnected: bmcSocket?.readyState === WebSocket.OPEN,
  };
}
