// content.js — tracks scroll depth and reports to background script

(function () {
  // Don't run in iframes
  if (window !== window.top) return;

  let maxScrollDepth = 0;

  function getScrollDepth() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    if (docHeight <= 0) return 100; // Page shorter than viewport = fully seen
    return Math.round((scrollTop / docHeight) * 100);
  }

  function reportScrollDepth() {
    const depth = getScrollDepth();
    if (depth > maxScrollDepth) {
      maxScrollDepth = depth;
      chrome.runtime.sendMessage({ type: "SCROLL_DEPTH", depth: maxScrollDepth });
    }
  }

  // Throttle scroll events — report at most once per second
  let scrollTimer = null;
  window.addEventListener("scroll", () => {
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => {
      reportScrollDepth();
      scrollTimer = null;
    }, 1000);
  }, { passive: true });

  // Also report when page becomes hidden (user switches tab or closes)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      reportScrollDepth();
    }
  });

  // Report once on load in case user never scrolls
  window.addEventListener("load", () => {
    reportScrollDepth();
  });
})();
