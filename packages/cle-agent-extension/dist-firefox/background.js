const b = typeof globalThis.browser !== "undefined" ? globalThis.browser : chrome;
const BROWSER_FAMILY = typeof globalThis.browser !== "undefined" ? "firefox" : navigator.userAgent.includes("Edg/") ? "edge" : "chrome";
const DISPATCH_BASE = "http://127.0.0.1:5050";
const BMC_WS_URL = "ws://127.0.0.1:5100";
const HEARTBEAT_ALARM = "cle-heartbeat";
const AGENT_ID = "cle-browser-agent";
let bmcSocket = null;
let agentId = AGENT_ID;
function connectToBMC(id) {
  if (bmcSocket && bmcSocket.readyState === WebSocket.OPEN) return;
  bmcSocket = new WebSocket(`${BMC_WS_URL}/${encodeURIComponent(id)}`);
  bmcSocket.onopen = () => {
    console.log(`[CLE] BMC connected as ${id}`);
  };
  bmcSocket.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "TASK") {
        await handleBMCTask(msg.payload);
      }
    } catch (e) {
      console.warn("[CLE] BMC bad message:", e);
    }
  };
  bmcSocket.onclose = () => {
    console.log("[CLE] BMC disconnected — will retry on next heartbeat");
    bmcSocket = null;
  };
  bmcSocket.onerror = (err) => {
    console.warn("[CLE] BMC WS error:", err);
    bmcSocket = null;
  };
}
async function handleBMCTask(payload) {
  const { taskId, action } = payload;
  console.log(`[CLE] TASK received: ${action} (id=${taskId ?? "anon"})`);
  let result;
  let error;
  try {
    switch (action) {
      case "navigate": {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error("No active tab");
        await b.tabs.update(tab.id, { url: payload.url });
        await waitForTabLoad(tab.id);
        result = { navigated: true, url: payload.url };
        break;
      }
      case "dom-extract": {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error("No active tab");
        const extracted = await b.scripting.executeScript({
          target: { tabId: tab.id },
          func: domExtract,
          args: [payload.selector ?? "body"]
        });
        result = { text: extracted[0]?.result ?? "" };
        break;
      }
      case "click": {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error("No active tab");
        if (!payload.selector && (payload.x == null || payload.y == null)) {
          throw new Error("click requires selector or x/y coordinates");
        }
        await b.scripting.executeScript({
          target: { tabId: tab.id },
          func: domClick,
          args: [payload.selector ?? null, payload.x ?? null, payload.y ?? null]
        });
        result = { clicked: true };
        break;
      }
      case "screenshot": {
        const tabId = payload.tabId ?? (await getActiveTab())?.id;
        if (!tabId) throw new Error("No tab for screenshot");
        const dataUrl = await b.tabs.captureVisibleTab({ quality: 90 });
        result = { screenshot: dataUrl };
        break;
      }
      case "scroll": {
        const tab = await getActiveTab();
        if (!tab?.id) throw new Error("No active tab");
        await b.scripting.executeScript({
          target: { tabId: tab.id },
          func: domScroll,
          args: [payload.x ?? 0, payload.y ?? 500]
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
function domExtract(selector) {
  const el = document.querySelector(selector);
  return el ? el.innerText ?? el.textContent ?? "" : "";
}
function domClick(selector, x, y) {
  if (selector) {
    const el = document.querySelector(selector);
    if (el) el.click();
  } else if (x != null && y != null) {
    const el = document.elementFromPoint(x, y);
    if (el) el.click();
  }
}
function domScroll(x, y) {
  window.scrollBy(x, y);
}
function sendTaskResult(payload) {
  if (bmcSocket?.readyState === WebSocket.OPEN) {
    bmcSocket.send(JSON.stringify({ type: "TASK_RESULT", payload }));
  } else {
    relayResultViaDispatch(payload).catch(console.warn);
  }
}
async function relayResultViaDispatch(payload) {
  const { agentId: id } = await b.storage.local.get("agentId");
  await fetch(`${DISPATCH_BASE}/api/tasks/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: id || AGENT_ID, result: payload })
  });
}
async function getActiveTab() {
  const [tab] = await b.tabs.query({ active: true, currentWindow: true });
  return tab;
}
async function getAllTabs() {
  const tabs = await b.tabs.query({});
  return tabs.filter((t) => t.url && !t.url.startsWith("chrome://") && !t.url.startsWith("moz-extension://")).map((t) => ({ url: t.url, title: t.title ?? "", tabId: t.id }));
}
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        b.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    b.tabs.onUpdated.addListener(listener);
    setTimeout(resolve, 1e4);
  });
}
b.runtime.onInstalled.addListener(async () => {
  console.log("[CLE] Agent installed — booting dispatch connection");
  await initAgent();
  b.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.5 });
});
b.runtime.onStartup.addListener(async () => {
  await initAgent();
  b.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.5 });
});
async function initAgent() {
  const stored = await b.storage.local.get("agentId");
  if (!stored.agentId) {
    const id = `browser-${crypto.randomUUID().slice(0, 8)}`;
    await b.storage.local.set({ agentId: id });
    agentId = id;
    console.log(`[CLE] New agent identity: ${id}`);
  } else {
    agentId = stored.agentId;
  }
  connectToBMC(agentId);
  await pingDispatch();
}
b.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === HEARTBEAT_ALARM) {
    connectToBMC(agentId);
    const tab = await getActiveTab();
    if (bmcSocket?.readyState === WebSocket.OPEN && tab) {
      bmcSocket.send(JSON.stringify({
        type: "HEARTBEAT",
        payload: { tab: { url: tab.url, title: tab.title } }
      }));
    }
    pingDispatch();
  }
});
async function pingDispatch() {
  try {
    const { agentId: id } = await b.storage.local.get("agentId");
    const allTabs = await getAllTabs();
    await fetch(`${DISPATCH_BASE}/api/agents/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: id || AGENT_ID,
        tool: "browser-extension",
        browser_family: BROWSER_FAMILY,
        capabilities: ["tab-context", "all-tabs", "dom-extract", "navigate", "screenshot", "click", "scroll"],
        status: "active",
        // Ship tab manifest so dispatch has it without a separate query
        tab_manifest: allTabs,
        all_tabs_count: allTabs.length
      })
    });
  } catch {
  }
}
b.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await b.tabs.get(tabId);
  emitTabContext(tab);
});
b.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") emitTabContext(tab);
});
function emitTabContext(tab) {
  if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("moz-extension://")) return;
  b.storage.session.set({
    activeTab: {
      url: tab.url,
      title: tab.title,
      tabId: tab.id,
      timestamp: Date.now()
    }
  });
}
b.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "DISPATCH_TASK") {
    submitToDispatch(message.payload).then(sendResponse);
    return true;
  }
  if (message.type === "GET_TAB_CONTEXT") {
    b.storage.session.get("activeTab").then(sendResponse);
    return true;
  }
  if (message.type === "GET_ALL_TABS") {
    getAllTabs().then(sendResponse);
    return true;
  }
  if (message.type === "GET_STATUS") {
    getAgentStatus().then(sendResponse);
    return true;
  }
  if (message.type === "EXECUTE_TASK") {
    handleBMCTask(message.payload).then(sendResponse);
    return true;
  }
});
async function submitToDispatch(payload) {
  try {
    const res = await fetch(`${DISPATCH_BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
async function getAgentStatus() {
  const { agentId: id } = await b.storage.local.get("agentId");
  const tab = await b.storage.session.get("activeTab");
  return {
    agentId: id,
    browserFamily: BROWSER_FAMILY,
    ...tab,
    online: true,
    bmcConnected: bmcSocket?.readyState === WebSocket.OPEN
  };
}
