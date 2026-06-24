const b = typeof globalThis.browser !== "undefined" ? globalThis.browser : chrome;
const pageContext = {
  url: window.location.href,
  title: document.title,
  description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
  ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? "",
  timestamp: Date.now()
};
b.runtime.sendMessage({ type: "PAGE_CONTEXT", payload: pageContext });
b.runtime.onMessage.addListener((message) => {
  if (message.type === "SUMMON_ALFRED") {
    window.postMessage({ source: "cle-agent", action: "summon-alfred", mode: message.mode }, "*");
  }
});
