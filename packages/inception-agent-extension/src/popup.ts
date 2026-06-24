export {};

/**
 * CLE Agent Popup UI
 *
 * Minimal sovereign popup — shows:
 * - Agent identity + browser family + online status
 * - Active tab URL
 * - Quick actions: Summon ALFRED, Add Task to Dispatch, Open Console
 *
 * Cross-browser: uses `b` alias for Chrome/Edge/Firefox compatibility.
 */

// ─── Cross-Browser API Shim ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const b: typeof chrome = (typeof (globalThis as any).browser !== 'undefined')
  ? (globalThis as any).browser
  : chrome;


// Zero Day: prod must set dispatch URL via extension options (storage). No 192.168 in source.
const DISPATCH_BASE = 'http://localhost:5050';

const app = document.getElementById('root')!;

interface AgentStatus {
  agentId?: string;
  browserFamily?: string;
  activeTab?: { url: string; title: string; timestamp: number };
  online: boolean;
}

async function getStatus(): Promise<AgentStatus> {
  return new Promise((resolve) => {
    b.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
      resolve(res || { online: false });
    });
  });
}

async function getDispatchQueue(): Promise<number> {
  try {
    const res = await fetch(`${DISPATCH_BASE}/api/tasks?status=queued&limit=1`);
    const json = await res.json();
    return json.count ?? 0;
  } catch {
    return -1;
  }
}

function summonAlfredOnPage(mode: 'chat' | 'terminal') {
  b.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id) return;
    b.tabs.sendMessage(tab.id, { type: 'SUMMON_ALFRED', mode });
  });
}

function formatUrl(url?: string) {
  if (!url) return '—';
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname !== '/' ? u.pathname : '');
  } catch {
    return url.slice(0, 40);
  }
}

async function render() {
  const [status, queueCount] = await Promise.all([getStatus(), getDispatchQueue()]);

  const queueBadge = queueCount < 0 ? '⚡ offline' : `${queueCount} queued`;
  const statusDot = status.online ? '🟢' : '🔴';
  const browserBadge = status.browserFamily ? ` · ${status.browserFamily}` : '';

  app.innerHTML = `
    <header>
      <div class="brand">
        <span class="logo">◈</span>
        <span class="name">CLE Agent${browserBadge}</span>
      </div>
      <span class="status-chip">${statusDot} ${status.agentId?.slice(0, 12) ?? 'booting...'}</span>
    </header>

    <section class="tab-context">
      <label>Active Tab</label>
      <p class="url">${formatUrl(status.activeTab?.url)}</p>
      <p class="title">${status.activeTab?.title?.slice(0, 52) ?? '—'}</p>
    </section>

    <section class="dispatch-status">
      <label>Dispatch</label>
      <span class="badge">${queueBadge}</span>
    </section>

    <div class="actions">
      <button id="btn-chat" title="Summon ALFRED chat on this page">💬 ALFRED Chat</button>
      <button id="btn-terminal" title="Open ALFRED terminal on this page">▶ Terminal</button>
      <button id="btn-console" title="Open CLE Console">⊞ Console</button>
    </div>

    <footer>
      <span>Creative Liberation Engine v5</span>
      <span>GENESIS</span>
    </footer>
  `;

  document.getElementById('btn-chat')?.addEventListener('click', () => summonAlfredOnPage('chat'));
  document.getElementById('btn-terminal')?.addEventListener('click', () => summonAlfredOnPage('terminal'));
  document.getElementById('btn-console')?.addEventListener('click', () => {
    b.tabs.create({ url: 'http://localhost:3000' });
  });
}

render();
