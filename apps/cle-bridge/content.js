// content.js - CLE Bridge Content Script

// This script is injected into all pages to facilitate complex interactions 
// requested by the NAS Agent that cannot be done via simple executeScript.

console.log("CLE Bridge Content Script loaded.");

// Listen for messages from background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "highlight_elements") {
    // Example: Highlight elements based on VLM bounding boxes
    request.boxes.forEach(box => {
      const overlay = document.createElement('div');
      overlay.style.position = 'absolute';
      overlay.style.border = '2px solid red';
      overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
      overlay.style.left = box.x + 'px';
      overlay.style.top = box.y + 'px';
      overlay.style.width = box.width + 'px';
      overlay.style.height = box.height + 'px';
      overlay.style.zIndex = 999999;
      overlay.style.pointerEvents = 'none'; // let clicks pass through
      document.body.appendChild(overlay);
    });
    sendResponse({status: "success"});
  }
});
