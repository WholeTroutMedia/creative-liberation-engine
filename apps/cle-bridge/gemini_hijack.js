// gemini_hijack.js
// Injects into gemini.google.com to intercept commands for the Creative Liberation Engine.

console.log("[CLE ENGINE] Gemini Hijack Active. Awaiting '/averi' commands.");

let averiModeEnabled = false;

function injectAveriToggle() {
    const btn = document.createElement('button');
    btn.id = 'averi-toggle-btn';
    btn.innerText = 'AVERI: OFF';
    btn.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        background: #111;
        color: #888;
        border: 1px solid #333;
        padding: 8px 16px;
        border-radius: 4px;
        z-index: 2147483647;
        font-family: 'Inter', monospace;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
    `;
    
    btn.onclick = () => {
        averiModeEnabled = !averiModeEnabled;
        if (averiModeEnabled) {
            btn.innerText = 'AVERI: ON';
            btn.style.background = '#00ffcc';
            btn.style.color = '#000';
            btn.style.boxShadow = '0 0 10px rgba(0,255,204,0.3)';
        } else {
            btn.innerText = 'AVERI: OFF';
            btn.style.background = '#111';
            btn.style.color = '#888';
            btn.style.boxShadow = 'none';
        }
    };
    document.body.appendChild(btn);
}

// Ensure it's injected even if body is loading
if (document.body) injectAveriToggle();
else window.addEventListener('DOMContentLoaded', injectAveriToggle);


document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    let activeEl = document.activeElement;
    
    // Penetrate shadow DOM to find the true active element
    while (activeEl && activeEl.shadowRoot && activeEl.shadowRoot.activeElement) {
        activeEl = activeEl.shadowRoot.activeElement;
    }
    
    if (activeEl) {
      // Get text, cleaning up zero-width spaces and non-breaking spaces
      let text = (activeEl.value || activeEl.innerText || activeEl.textContent || '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ').trim();
      
      // Look for our execution trigger
      if (averiModeEnabled || text.startsWith('/averi')) {
        e.preventDefault();
        e.stopImmediatePropagation(); // Crucial to prevent Gemini from submitting
        
        const command = text.startsWith('/averi') ? text.replace('/averi', '').trim() : text.trim();
        console.log("[CLE ENGINE] Intercepted command:", command);
        
        // Dispatch to background worker
        chrome.runtime.sendMessage({
          action: "nas_dispatch",
          payload: command
        });
        
        // Clear the input field
        if (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT') {
            activeEl.value = '';
        } else {
            // Clear contenteditable
            activeEl.innerHTML = '';
            // Or use Selection API if it's resistant
            const selection = window.getSelection();
            if (selection) {
                selection.selectAllChildren(activeEl);
                selection.deleteFromDocument();
            }
        }
        
        // Dispatch input events so the underlying JS framework registers the clear
        activeEl.dispatchEvent(new Event('input', { bubbles: true }));
        activeEl.dispatchEvent(new Event('change', { bubbles: true }));
        
        showToast("Dispatched to NAS: " + command);
      }
    }
  }
}, true); // useCapture = true to intercept before Gemini's React/Angular handlers

function showToast(msg) {
  const toast = document.createElement('div');
  toast.innerText = msg;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #00ffcc;
    color: #000;
    padding: 12px 24px;
    border-radius: 4px;
    z-index: 2147483647;
    font-family: 'Inter', monospace;
    font-size: 14px;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(0, 255, 204, 0.2);
    border: 1px solid #00ffcc;
    pointer-events: none;
    transition: opacity 0.3s;
  `;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'render_ui') {
        renderOverlay(request.payload.html, request.payload.css);
    } else if (request.action === 'reply_ui') {
        injectReply(request.payload.text || request.payload.html);
    }
});

function injectReply(content) {
    const message = document.createElement('div');
    message.className = 'averi-injected-reply';
    message.style.cssText = `
        background: #000;
        color: #00ffcc;
        border: 1px solid #00ffcc;
        padding: 16px;
        margin: 16px 0;
        font-family: 'Inter', monospace;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,255,204,0.1);
        word-wrap: break-word;
        white-space: pre-wrap;
        font-size: 14px;
        line-height: 1.5;
        position: relative;
        z-index: 100;
    `;
    message.innerHTML = `<div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 8px; display: flex; justify-content: space-between;"><span>[AVERI NAS ENGINE]</span><span style="cursor:pointer;color:#888;" onclick="this.parentElement.parentElement.remove()">âœ•</span></div>${content}`;

    // Try to find Gemini's chat stream container. 
    // Usually it's an element containing the chat messages.
    // If we can't find it reliably, we insert it before the input box.
    const inputBox = document.querySelector('rich-textarea') || document.querySelector('textarea');
    
    if (inputBox) {
        // Walk up to find a suitable container to append before the input area
        let container = inputBox.closest('.chat-container') || inputBox.closest('main') || inputBox.parentElement.parentElement;
        if (container) {
            container.insertBefore(message, container.lastElementChild);
            message.scrollIntoView({ behavior: 'smooth', block: 'end' });
        } else {
            document.body.appendChild(message);
        }
    } else {
        // Fallback: fixed position
        message.style.position = 'fixed';
        message.style.bottom = '80px';
        message.style.right = '20px';
        message.style.width = '400px';
        message.style.maxHeight = '60vh';
        message.style.overflowY = 'auto';
        message.style.zIndex = '2147483647';
        document.body.appendChild(message);
    }
}


function renderOverlay(html, css) {
    let overlay = document.getElementById('averi-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'averi-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 85vw;
            height: 85vh;
            background: #000;
            z-index: 2147483646;
            border-radius: 12px;
            border: 1px solid #333;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8);
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;
        
        const header = document.createElement('div');
        header.style.cssText = 'padding: 12px 16px; background: #111; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; color: #fff; font-family: monospace; font-size: 14px;';
        header.innerHTML = `<span><span style="color: #00ffcc;">â—</span> AVERI RENDER PIPELINE</span><button id="averi-close" style="background:none;border:none;color:#888;cursor:pointer;font-size: 16px;">âœ•</button>`;
        
        const iframe = document.createElement('iframe');
        iframe.id = 'averi-iframe';
        iframe.style.cssText = 'flex: 1; width: 100%; border: none; background: #fff;';
        
        overlay.appendChild(header);
        overlay.appendChild(iframe);
        document.body.appendChild(overlay);
        
        document.getElementById('averi-close').onclick = () => overlay.remove();
    }
    
    const iframe = document.getElementById('averi-iframe');
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>${css || ''}</style>
        </head>
        <body>${html || ''}</body>
        </html>
    `);
    doc.close();
}
