// background.js — Tab Hoarding Analyzer service worker
// Tracks tab lifecycle: open/close times, active focus time, scroll depth, return visits

// ─── State ────────────────────────────────────────────────────────────────────

// In-memory map of open tabs: tabId → TabEntry
// TabEntry: { visitId, url, domain, title, openedAt, activeSessions, currentSessionStart, scrollDepth, returnCount }
const tabState = {};

let windowFocused = true;
let activeTabId   = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function extractDomain(url) {
  try { return new URL(url).hostname; }
  catch { return url; }
}

function isInternalUrl(url) {
  return url.startsWith("chrome") || url.startsWith("chrome-extension");
}

// Factory for a fresh TabEntry
function createTabEntry(url, title, isActive = false) {
  return {
    visitId:              generateId(),
    url,
    domain:               extractDomain(url),
    title:                title || "",
    openedAt:             Date.now(),
    activeSessions:       [],
    currentSessionStart:  isActive ? Date.now() : null,
    scrollDepth:          0,
    returnCount:          0,
  };
}

// Builds a completed visit record from a TabEntry snapshot
function buildVisitRecord(state) {
  const closedAt = Date.now();
  return {
    id:               state.visitId,
    url:              state.url,
    domain:           state.domain,
    title:            state.title,
    opened_at:        state.openedAt,
    closed_at:        closedAt,
    total_time_ms:    closedAt - state.openedAt,
    active_time_ms:   totalActiveMs(state),
    focus_sessions:   state.activeSessions,
    scroll_depth_pct: state.scrollDepth,
    returned_to:      state.returnCount > 0,
    return_count:     state.returnCount,
  };
}

async function saveVisit(visit) {
  const { visits = [] } = await chrome.storage.local.get("visits");
  await chrome.storage.local.set({ visits: [...visits, visit] });
}

// ─── Active session tracking ───────────────────────────────────────────────────

function startActiveSession(tabId) {
  const state = tabState[tabId];
  if (!state || state.currentSessionStart !== null) return;
  state.currentSessionStart = Date.now();
}

function endActiveSession(tabId) {
  const state = tabState[tabId];
  if (!state || state.currentSessionStart === null) return;

  const start    = state.currentSessionStart;
  const end      = Date.now();
  const duration = end - start;

  // Discard sub-second blips to avoid noise from rapid tab switches
  if (duration > 1000) {
    state.activeSessions.push({ start, end, duration_ms: duration });
  }

  state.currentSessionStart = null;
}

function totalActiveMs(state) {
  return state.activeSessions.reduce((sum, s) => sum + s.duration_ms, 0);
}

// ─── Tab lifecycle ─────────────────────────────────────────────────────────────

chrome.tabs.onCreated.addListener((tab) => {
  const url = tab.url || tab.pendingUrl || "";
  if (isInternalUrl(url)) return;
  tabState[tab.id] = createTabEntry(url, tab.title);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = tabState[tabId];
  if (!state) return;

  endActiveSession(tabId);
  await saveVisit(buildVisitRecord(state));
  delete tabState[tabId];
});

// Handles both in-tab navigation (save current page, start new) and title updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    if (isInternalUrl(changeInfo.url)) {
      if (tabState[tabId]) { endActiveSession(tabId); delete tabState[tabId]; }
      return;
    }

    if (tabState[tabId]) {
      const elapsed = Date.now() - tabState[tabId].openedAt;
      if (elapsed >= 3000) {
        // Save the current page as a completed visit before tracking the new URL
        endActiveSession(tabId);
        saveVisit(buildVisitRecord(tabState[tabId]));
      }
      // If under 3s it's likely a redirect — just drop the record and start fresh
    }

    const isActive = activeTabId === tabId && windowFocused;
    tabState[tabId] = createTabEntry(changeInfo.url, tab.title, isActive);
  }

  if (changeInfo.title && tabState[tabId]) {
    tabState[tabId].title = changeInfo.title;
  }
});

// ─── Focus and active tab tracking ────────────────────────────────────────────

chrome.tabs.onActivated.addListener(({ tabId }) => {
  if (activeTabId !== null && activeTabId !== tabId) {
    endActiveSession(activeTabId);
  }
  activeTabId = tabId;
  if (windowFocused) startActiveSession(tabId);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  const lostFocus = windowId === chrome.windows.WINDOW_ID_NONE;
  windowFocused = !lostFocus;

  if (activeTabId !== null) {
    lostFocus ? endActiveSession(activeTabId) : startActiveSession(activeTabId);
  }
});

// ─── Extension icon → open dashboard ──────────────────────────────────────────

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

// ─── Messages from content script ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCROLL_DEPTH") {
    const state = tabState[sender.tab?.id];
    if (state && message.depth > state.scrollDepth) {
      state.scrollDepth = message.depth;
    }
    return;
  }

  if (message.type === "GET_OPEN_TABS") {
    const now = Date.now();
    const openVisits = Object.values(tabState).map(state => {
      // Include any in-progress active session in the active time calculation
      const inProgressMs = state.currentSessionStart !== null
        ? now - state.currentSessionStart
        : 0;

      return {
        id:               state.visitId,
        url:              state.url,
        domain:           state.domain,
        title:            state.title,
        opened_at:        state.openedAt,
        closed_at:        null,
        total_time_ms:    now - state.openedAt,
        active_time_ms:   totalActiveMs(state) + inProgressMs,
        focus_sessions:   state.activeSessions,
        scroll_depth_pct: state.scrollDepth,
        returned_to:      state.returnCount > 0,
        return_count:     state.returnCount,
        is_open:          true,
      };
    });
    sendResponse({ openVisits });
    return true;
  }
});

// ─── Startup: re-register the currently active tab ────────────────────────────
// Service workers reset in-memory state on wake; restore tracking for whatever
// tab the user is currently looking at.

chrome.tabs.query({ active: true, currentWindow: true }, ([tab] = []) => {
  if (!tab) return;

  const url = tab.url || "";
  if (!isInternalUrl(url) && !tabState[tab.id]) {
    tabState[tab.id] = createTabEntry(url, tab.title);
  }

  activeTabId = tab.id;
  if (windowFocused) startActiveSession(tab.id);
});
