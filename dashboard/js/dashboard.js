// dashboard.js — App bootstrap and event listeners

// Cached visits — shared state used by theme.js, modal callbacks, and initDashboard
let cachedVisits = [];

// ── Settings modal ────────────────────────────────────────────────────────────

function openSettings() {
  document.getElementById("settings-modal").style.display = "flex";
}

function closeSettings() {
  document.getElementById("settings-modal").style.display = "none";
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

function initDashboard() {
  const cutoff = Date.now() - SEVEN_DAYS_MS;

  Promise.all([
    chrome.storage.local.get(["visits", "apiKey"]),
    chrome.runtime.sendMessage({ type: "GET_OPEN_TABS" }).catch(() => ({ openVisits: [] })),
  ]).then(([storage, { openVisits = [] }]) => {
    const closedVisits = (storage.visits || []).filter(v => v.opened_at >= cutoff);
    const openRecent   = openVisits.filter(v => v.opened_at >= cutoff);

    cachedVisits = [...closedVisits, ...openRecent];

    renderStats(cachedVisits);
    renderGuiltList(cachedVisits);
    renderDomainList(cachedVisits);
    renderCategoryList(cachedVisits);
    renderHourlyChart(cachedVisits);

    document.getElementById("api-key-input").value = storage.apiKey || "";
  });
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.getElementById("btn-report").addEventListener("click", generateReport);
document.getElementById("btn-regenerate").addEventListener("click", generateReport);

document.getElementById("detail-modal-close").addEventListener("click", () => detailModal.close());
document.getElementById("detail-modal").addEventListener("click", e => {
  if (e.target === document.getElementById("detail-modal")) detailModal.close();
});

// Tabs Opened stat card
document.getElementById("card-total-tabs").addEventListener("click", () => {
  detailModal.open({
    title: "Tabs Opened — Breakdown",
    tabs: [
      {
        label: "By Day",
        render: () => renderBreakdownByDay(cachedVisits),
        afterRender: (el) => {
          const days   = last7Days();
          const counts = Object.fromEntries(days.map(d => [d.key, 0]));
          for (const v of cachedVisits) {
            const key = dayKey(new Date(v.opened_at));
            if (key in counts) counts[key]++;
          }
          return drawBreakdownPie(el, days.map(d => d.label), days.map(d => counts[d.key]));
        },
      },
      {
        label: "By Category",
        render: () => renderBreakdownByCategory(cachedVisits),
        afterRender: (el) => {
          const cats = buildCategoryStats(cachedVisits);
          return drawBreakdownPie(el, cats.map(c => `${c.emoji} ${c.name}`), cats.map(c => c.visits));
        },
      },
      {
        label: "By Domain",
        render: () => renderBreakdownByDomain(cachedVisits),
        afterRender: (el) => {
          const domains = topDomains(cachedVisits, 10);
          return drawBreakdownPie(el, domains.map(d => d.domain), domains.map(d => d.count));
        },
      },
    ],
  });
});

// Avg Active Ratio stat card
document.getElementById("card-active-ratio").addEventListener("click", () => {
  detailModal.open({
    title: "Avg Active Ratio — Breakdown",
    tabs: [
      { label: "By Day",      render: () => renderRatioBreakdownByDay(cachedVisits) },
      { label: "By Category", render: () => renderRatioBreakdownByCategory(cachedVisits) },
      { label: "By Domain",   render: () => renderRatioBreakdownByDomain(cachedVisits) },
    ],
  });
});

// Guilt Tabs stat card
document.getElementById("card-guilt-count").addEventListener("click", () => {
  detailModal.open({
    title: "Guilt Tabs — Breakdown",
    tabs: [
      { label: "By Day",      render: () => renderGuiltBreakdownByDay(cachedVisits) },
      { label: "By Category", render: () => renderGuiltBreakdownByCategory(cachedVisits) },
      { label: "By Domain",   render: () => renderGuiltBreakdownByDomain(cachedVisits) },
    ],
  });
});

// Guilt Tab Cleaner
document.getElementById("btn-guilt-clean").addEventListener("click", openGuiltCleaner);
document.getElementById("guilt-cleaner-close").addEventListener("click", closeGuiltCleaner);
document.getElementById("guilt-cleaner-modal").addEventListener("click", e => {
  if (e.target === document.getElementById("guilt-cleaner-modal")) closeGuiltCleaner();
});
document.getElementById("guilt-slider").addEventListener("input", e => {
  updateGuiltCleanerPreview(parseInt(e.target.value));
});
document.getElementById("btn-close-guilt-tabs").addEventListener("click", closeGuiltTabs);

// Settings modal
document.getElementById("btn-settings").addEventListener("click", openSettings);
document.getElementById("btn-cancel").addEventListener("click", closeSettings);
document.getElementById("btn-save-key").addEventListener("click", async () => {
  const key = document.getElementById("api-key-input").value.trim();
  await chrome.storage.local.set({ apiKey: key });
  closeSettings();
});

// ── Start ─────────────────────────────────────────────────────────────────────

initTheme();
initDashboard();
