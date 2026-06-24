const b = typeof globalThis.browser !== "undefined" ? globalThis.browser : chrome;
const DISPATCH_BASE = "http://127.0.0.1:5050";
const app = document.getElementById("root");
async function getStatus() {
  return new Promise((resolve) => {
    b.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
      resolve(res || { online: false });
    });
  });
}
async function getDispatchQueue() {
  try {
    const res = await fetch(`${DISPATCH_BASE}/api/tasks?status=queued&limit=1`);
    const json = await res.json();
    return json.count ?? 0;
  } catch {
    return -1;
  }
}
function summonAlfredOnPage(mode) {
  b.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id) return;
    b.tabs.sendMessage(tab.id, { type: "SUMMON_ALFRED", mode });
  });
}
function formatUrl(url) {
  if (!url) return "—";
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return url.slice(0, 40);
  }
}
async function render() {
  const [status, queueCount] = await Promise.all([getStatus(), getDispatchQueue()]);
  const queueBadge = queueCount < 0 ? "⚡ offline" : `${queueCount} queued`;
  const statusDot = status.online ? "🟢" : "🔴";
  const browserBadge = status.browserFamily ? ` · ${status.browserFamily}` : "";
  app.innerHTML = `
    <header>
      <div class="brand">
        <span class="logo">◈</span>
        <span class="name">CLE Agent${browserBadge}</span>
      </div>
      <span class="status-chip">${statusDot} ${status.agentId?.slice(0, 12) ?? "booting..."}</span>
    </header>

    <section class="tab-context">
      <label>Active Tab</label>
      <p class="url">${formatUrl(status.activeTab?.url)}</p>
      <p class="title">${status.activeTab?.title?.slice(0, 52) ?? "—"}</p>
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
  document.getElementById("btn-chat")?.addEventListener("click", () => summonAlfredOnPage("chat"));
  document.getElementById("btn-terminal")?.addEventListener("click", () => summonAlfredOnPage("terminal"));
  document.getElementById("btn-console")?.addEventListener("click", () => {
    b.tabs.create({ url: "http://127.0.0.1:3000" });
  });
}
render();
