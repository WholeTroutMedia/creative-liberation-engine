// background.js - CLE Bridge Service Worker

const DISPATCH_SERVER_WS = 'ws://127.0.0.1:5150/ws/bridge';
let socket = null;
let isConnecting = false;
let lastActiveTabId = null;

function connectToNAS() {
  if (isConnecting) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }
  
  isConnecting = true;
  console.log("Attempting to connect to NAS Dispatch at", DISPATCH_SERVER_WS);
  
  try {
    socket = new WebSocket(DISPATCH_SERVER_WS);
  } catch (e) {
    console.error("Failed to create WebSocket", e);
    isConnecting = false;
    setTimeout(connectToNAS, 5000);
    return;
  }

  socket.onopen = () => {
    isConnecting = false;
    console.log("Connected to NAS Dispatch.");
    // Register this bridge instance
    socket.send(JSON.stringify({ type: 'register', client: 'cle-bridge' }));
  };

  socket.onmessage = async (event) => {
    console.log("Received command from NAS:", event.data);
    try {
      const command = JSON.parse(event.data);
      if (command.action === 'execute_script') {
        if (lastActiveTabId) {
          chrome.scripting.executeScript({ target: { tabId: lastActiveTabId }, func: new Function(command.script) });
        }
      } else if (command.action === 'extract_dom') {
        if (lastActiveTabId) {
          const results = await chrome.scripting.executeScript({ target: { tabId: lastActiveTabId }, func: () => document.documentElement.outerHTML });
          if (results && results[0]) {
            socket.send(JSON.stringify({ type: 'dom_response', payload: results[0].result }));
          }
        }
      } else if (command.action === 'render_ui' || command.action === 'reply_ui') {
        if (lastActiveTabId) {
          chrome.tabs.sendMessage(lastActiveTabId, { action: command.action, payload: command.payload }).catch(e => console.log(e));
        } else {
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach(t => chrome.tabs.sendMessage(t.id, { action: command.action, payload: command.payload }).catch(e => {}));
          });
        }
      }
    } catch (e) {
      console.error("Error processing NAS command", e);
    }
  };

  socket.onclose = () => {
    isConnecting = false;
    console.log("Disconnected from NAS. Reconnecting in 5s...");
    setTimeout(connectToNAS, 5000);
  };
  
  socket.onerror = (err) => {
    isConnecting = false;
    console.error("WebSocket error:", err);
  };
}

async function executeOnActiveTab(scriptContent) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: new Function(scriptContent)
    });
  }
}

async function extractDomFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return null;
  
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.documentElement.outerHTML
  });
  return results[0].result;
}

// Handle messages from content scripts (like gemini_hijack.js)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (sender.tab && sender.tab.id) {
    lastActiveTabId = sender.tab.id;
  }
  
  if (request.action === "nas_dispatch") {
    const payload = JSON.stringify({
      type: 'user_command',
      source: 'gemini_web',
      command: request.payload
    });

    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log("Forwarding to NAS:", request.payload);
      socket.send(payload);
    } else {
      console.log("Socket not open. Connecting and queuing message...");
      if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
        connectToNAS();
      }
      
      // Wait for connection to open
      const checkInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          console.log("Socket opened, sending queued message:", request.payload);
          socket.send(payload);
          clearInterval(checkInterval);
        }
      }, 100);
      
      // Timeout after 5 seconds
      setTimeout(() => clearInterval(checkInterval), 5000);
    }
  }
});

// Initialize connection
connectToNAS();
