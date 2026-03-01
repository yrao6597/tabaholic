// guilt-cleaner.js — Guilt Tab Cleaner feature; depends on utils.js + categories.js

let guiltCandidates = []; // [{ tabId, url, domain, activeRatio }]

async function openGuiltCleaner() {
  const [chromeTabs, { openVisits = [] }] = await Promise.all([
    chrome.tabs.query({}),
    chrome.runtime.sendMessage({ type: "GET_OPEN_TABS" }).catch(() => ({ openVisits: [] })),
  ]);

  const ratioByUrl = {};
  for (const v of openVisits) {
    if (v.url) ratioByUrl[v.url] = ratio(v);
  }

  guiltCandidates = chromeTabs
    .filter(t => t.url && !t.url.startsWith("chrome://") && t.url in ratioByUrl)
    .map(t => ({
      tabId:       t.id,
      url:         t.url,
      domain:      new URL(t.url).hostname.replace(/^www\./, ""),
      activeRatio: ratioByUrl[t.url],
    }));

  document.getElementById("guilt-open-total").textContent = chromeTabs.filter(
    t => t.url && !t.url.startsWith("chrome://")
  ).length;

  updateGuiltCleanerPreview(parseInt(document.getElementById("guilt-slider").value));
  document.getElementById("guilt-cleaner-modal").style.display = "flex";
}

function updateGuiltCleanerPreview(threshold) {
  const thresholdRatio = threshold / 100;
  const qualifying     = guiltCandidates.filter(c => c.activeRatio < thresholdRatio);

  document.getElementById("guilt-qualify-count").textContent   = qualifying.length;
  document.getElementById("guilt-threshold-label").textContent = threshold;

  const catCounts = {};
  for (const c of qualifying) {
    const cat = categorizeDomain(c.domain);
    if (!catCounts[cat.name]) catCounts[cat.name] = { emoji: cat.emoji, count: 0 };
    catCounts[cat.name].count++;
  }

  const top3 = Object.entries(catCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([name, { emoji, count }]) => `${emoji} ${name} (${count})`)
    .join(", ");

  document.getElementById("guilt-top-domains").textContent =
    top3 ? `Top categories: ${top3}` : "";
}

async function closeGuiltTabs() {
  const threshold  = parseInt(document.getElementById("guilt-slider").value) / 100;
  const qualifying = guiltCandidates.filter(c => c.activeRatio < threshold);
  const tabIds     = qualifying.map(c => c.tabId);

  if (tabIds.length === 0) return;

  await chrome.tabs.remove(tabIds);
  closeGuiltCleaner();
  setTimeout(initDashboard, 300);
}

function closeGuiltCleaner() {
  document.getElementById("guilt-cleaner-modal").style.display = "none";
}
