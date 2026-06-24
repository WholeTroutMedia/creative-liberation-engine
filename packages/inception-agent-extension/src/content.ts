export {};

/**
 * Content Script — CLE Agent
 *
 * Injected into all pages. Reads page metadata and signals ALFRED panel
 * when the user is on a ArtistAharoni Photography site.
 *
 * Cross-browser: uses `b` alias for Chrome/Edge/Firefox compatibility.
 */

// ─── Cross-Browser API Shim ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const b: typeof chrome = (typeof (globalThis as any).browser !== 'undefined')
  ? (globalThis as any).browser
  : chrome;

// Emit page context to background on load
const pageContext = {
  url: window.location.href,
  title: document.title,
  description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
  ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '',
  timestamp: Date.now(),
};

b.runtime.sendMessage({ type: 'PAGE_CONTEXT', payload: pageContext });

// Listen for ALFRED activation signal from popup
b.runtime.onMessage.addListener((message) => {
  if (message.type === 'SUMMON_ALFRED') {
    window.postMessage({ source: 'cle-agent', action: 'summon-alfred', mode: message.mode }, '*');
  }
});

