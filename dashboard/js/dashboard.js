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

// ── Reset History modal ────────────────────────────────────────────────────────

function openResetModal() {
  document.getElementById("reset-modal").style.display = "flex";
}

function closeResetModal() {
  document.getElementById("reset-modal").style.display = "none";
}

async function confirmReset() {
  await chrome.storage.local.remove(["visits", "tabStateSnapshot"]);
  closeResetModal();
  initDashboard();
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
      {
        label: "By Day",
        render: () => renderRatioBreakdownByDay(cachedVisits),
        afterRender: (el) => {
          const days   = last7Days();
          const totals = Object.fromEntries(days.map(d => [d.key, { sum: 0, count: 0 }]));
          for (const v of cachedVisits) {
            const key = dayKey(new Date(v.opened_at));
            if (key in totals) { totals[key].sum += ratio(v); totals[key].count++; }
          }
          const values = days.map(d => {
            const { sum, count } = totals[d.key];
            return count > 0 ? Math.round(sum / count * 100) : 0;
          });
          return drawBreakdownPie(el, days.map(d => d.label), values, v => `${v}%`);
        },
      },
      {
        label: "By Category",
        render: () => renderRatioBreakdownByCategory(cachedVisits),
        afterRender: (el) => {
          const cats   = buildCategoryStats(cachedVisits);
          const sorted = [...cats].sort((a, b) => b.avgActiveRatio - a.avgActiveRatio);
          return drawBreakdownPie(
            el,
            sorted.map(c => `${c.emoji} ${c.name}`),
            sorted.map(c => Math.round(c.avgActiveRatio * 100)),
            v => `${v}%`,
          );
        },
      },
      {
        label: "By Domain",
        render: () => renderRatioBreakdownByDomain(cachedVisits),
        afterRender: (el) => {
          const domainMap = {};
          for (const v of cachedVisits) {
            if (!domainMap[v.domain]) domainMap[v.domain] = { sum: 0, count: 0 };
            domainMap[v.domain].sum += ratio(v);
            domainMap[v.domain].count++;
          }
          const domains = Object.entries(domainMap)
            .map(([domain, { sum, count }]) => ({ domain, avgRatio: sum / count }))
            .sort((a, b) => b.avgRatio - a.avgRatio)
            .slice(0, 10);
          return drawBreakdownPie(
            el,
            domains.map(d => d.domain),
            domains.map(d => Math.round(d.avgRatio * 100)),
            v => `${v}%`,
          );
        },
      },
    ],
  });
});

// Guilt Tabs stat card
document.getElementById("card-guilt-count").addEventListener("click", () => {
  detailModal.open({
    title: "Guilt Tabs — Breakdown",
    tabs: [
      {
        label: "By Day",
        render: () => renderGuiltBreakdownByDay(cachedVisits),
        afterRender: (el) => {
          const guilt  = cachedVisits.filter(isGuiltTab);
          const days   = last7Days();
          const counts = Object.fromEntries(days.map(d => [d.key, 0]));
          for (const v of guilt) {
            const key = dayKey(new Date(v.opened_at));
            if (key in counts) counts[key]++;
          }
          return drawBreakdownPie(el, days.map(d => d.label), days.map(d => counts[d.key]));
        },
      },
      {
        label: "By Category",
        render: () => renderGuiltBreakdownByCategory(cachedVisits),
        afterRender: (el) => {
          const guilt  = cachedVisits.filter(isGuiltTab);
          const catMap = {};
          for (const v of guilt) {
            const cat = categorizeDomain(v.domain);
            if (!catMap[cat.name]) catMap[cat.name] = { ...cat, count: 0 };
            catMap[cat.name].count++;
          }
          const sorted = Object.values(catMap).sort((a, b) => b.count - a.count);
          return drawBreakdownPie(el, sorted.map(c => `${c.emoji} ${c.name}`), sorted.map(c => c.count));
        },
      },
      {
        label: "By Domain",
        render: () => renderGuiltBreakdownByDomain(cachedVisits),
        afterRender: (el) => {
          const guilt     = cachedVisits.filter(isGuiltTab);
          const domainMap = {};
          for (const v of guilt) {
            if (!domainMap[v.domain]) domainMap[v.domain] = { count: 0 };
            domainMap[v.domain].count++;
          }
          const domains = Object.entries(domainMap)
            .map(([domain, { count }]) => ({ domain, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
          return drawBreakdownPie(el, domains.map(d => d.domain), domains.map(d => d.count));
        },
      },
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
document.getElementById("btn-view-guilt-tabs").addEventListener("click", toggleGuiltTabList);
document.getElementById("btn-close-guilt-tabs").addEventListener("click", closeGuiltTabs);

// Reset History modal
document.getElementById("btn-reset-history").addEventListener("click", openResetModal);
document.getElementById("btn-reset-cancel").addEventListener("click", closeResetModal);
document.getElementById("btn-reset-confirm").addEventListener("click", confirmReset);
document.getElementById("reset-modal").addEventListener("click", e => {
  if (e.target === document.getElementById("reset-modal")) closeResetModal();
});

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
