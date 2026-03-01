// dashboard.js — Tab Analyzer dashboard

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS LAYER — data aggregation, no DOM
// ═══════════════════════════════════════════════════════════════════════════════

// Returns per-category visit counts and average active ratios
function buildCategoryStats(visits) {
  const map = {};

  for (const v of visits) {
    const cat = categorizeDomain(v.domain);
    if (!map[cat.name]) map[cat.name] = { ...cat, visits: 0, totalRatio: 0 };
    map[cat.name].visits++;
    map[cat.name].totalRatio += ratio(v);
  }

  return Object.values(map)
    .map(d => ({ ...d, avgActiveRatio: d.totalRatio / d.visits }))
    .sort((a, b) => b.visits - a.visits);
}

// Aggregates last 7 days of visits into a summary object for the Claude prompt
function buildWeeklySummary(visits) {
  const domainMap  = {};
  const hourCounts = Array(24).fill(0);
  let   totalRatio = 0;

  for (const v of visits) {
    const r = ratio(v);
    totalRatio += r;
    hourCounts[new Date(v.opened_at).getHours()]++;

    if (!domainMap[v.domain]) domainMap[v.domain] = { opens: 0, totalRatio: 0 };
    domainMap[v.domain].opens++;
    domainMap[v.domain].totalRatio += r;
  }

  const topDomainList = Object.entries(domainMap)
    .map(([domain, d]) => ({
      domain,
      opens:            d.opens,
      avg_active_ratio: Math.round((d.totalRatio / d.opens) * 100) / 100,
    }))
    .sort((a, b) => b.opens - a.opens)
    .slice(0, 5);

  return {
    total_tabs_opened: visits.length,
    avg_active_ratio:  Math.round((totalRatio / visits.length) * 100) / 100,
    guilt_tab_count:   visits.filter(isGuiltTab).length,
    top_domains:       topDomainList,
    peak_open_hour:    hourCounts.indexOf(Math.max(...hourCounts)),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI LAYER — rendering functions, DOM manipulation only
// ═══════════════════════════════════════════════════════════════════════════════

// Cached visits — needed so the chart can redraw on theme toggle without re-reading storage
let cachedVisits  = [];
let chartInstance = null;

// ── Stats row ────────────────────────────────────────────────────────────────

function renderStats(visits) {
  const avgRatio = visits.length ? avg(visits.map(v => ratio(v))) : 0;

  document.getElementById("stat-total-tabs").textContent   = visits.length;
  document.getElementById("stat-active-ratio").textContent = pct(avgRatio);
  document.getElementById("stat-guilt-count").textContent  = visits.filter(isGuiltTab).length;

  const top = topDomains(visits, 1);
  document.getElementById("stat-top-domain").textContent = top.length ? top[0].domain : "—";
}

// ── Guilt tab list ────────────────────────────────────────────────────────────

function renderGuiltList(visits) {
  const el    = document.getElementById("guilt-list");
  const guilt = visits
    .filter(isGuiltTab)
    .sort((a, b) => ratio(a) - ratio(b))
    .slice(0, 8);

  el.innerHTML = guilt.length
    ? guilt.map(guiltItemHTML).join("")
    : `<div class="empty-state">No guilt tabs yet — you're doing great.</div>`;
}

function guiltItemHTML(v) {
  const openBadge = v.is_open ? `<span class="guilt-badge blue">still open</span>` : "";
  return `
    <div class="guilt-item">
      <div class="guilt-item-title" title="${v.url}">${v.title || v.url}</div>
      <div class="guilt-item-domain">${v.domain}</div>
      <div class="guilt-item-stats">
        <span class="guilt-badge red">${pct(ratio(v))} active</span>
        <span class="guilt-badge yellow">${formatDuration(v.total_time_ms)} open</span>
        ${openBadge}
      </div>
    </div>`;
}

// ── Domain list ───────────────────────────────────────────────────────────────

function renderDomainList(visits) {
  const el      = document.getElementById("domain-list");
  const domains = topDomains(visits, 8);

  if (domains.length === 0) {
    el.innerHTML = `<div class="empty-state">No data yet.</div>`;
    return;
  }

  const max = domains[0].count;
  el.innerHTML = domains.map(d => domainRowHTML(d, max)).join("");
}

function domainRowHTML(d, max) {
  const barWidth = Math.round((d.count / max) * 100);
  return `
    <div class="domain-row">
      <div class="domain-name" title="${d.domain}">${d.domain}</div>
      <div class="domain-bar-wrap">
        <div class="domain-bar" style="width:${barWidth}%"></div>
      </div>
      <div class="domain-count">${d.count}</div>
    </div>`;
}

// ── Browsing categories ───────────────────────────────────────────────────────

function renderCategoryList(visits) {
  const el         = document.getElementById("category-list");
  const categories = buildCategoryStats(visits);

  if (categories.length === 0) {
    el.innerHTML = `<div class="empty-state">No data yet.</div>`;
    return;
  }

  const max = categories[0].visits;
  el.innerHTML = categories.map(c => categoryRowHTML(c, max)).join("");
}

function categoryRowHTML(c, max) {
  const barWidth = Math.round((c.visits / max) * 100);
  return `
    <div class="category-row">
      <div class="category-label">
        <span class="category-emoji">${c.emoji}</span>
        <span class="category-name">${c.name}</span>
      </div>
      <div class="category-bar-wrap">
        <div class="category-bar" style="width:${barWidth}%"></div>
      </div>
      <div class="category-meta">
        <span class="category-count">${c.visits}</span>
        <span class="category-ratio">${pct(c.avgActiveRatio)}</span>
      </div>
    </div>`;
}

// ── Hourly chart ──────────────────────────────────────────────────────────────

function renderHourlyChart(visits) {
  const counts = Array(24).fill(0);
  visits.forEach(v => counts[new Date(v.opened_at).getHours()]++);

  const labels = Array.from({ length: 24 }, (_, h) => {
    if (h === 0)  return "12a";
    if (h === 12) return "12p";
    return h < 12 ? `${h}a` : `${h - 12}p`;
  });

  const isLight       = document.body.classList.contains("light");
  const emptyBarColor = isLight ? "#ebebf3" : "#1e1e28";
  const gridColor     = isLight ? "#e2e2ec" : "#1e1e28";

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  chartInstance = new Chart(
    document.getElementById("hourly-chart").getContext("2d"),
    {
      type: "bar",
      data: {
        labels,
        datasets: [{
          data:            counts,
          backgroundColor: counts.map(c => c > 0 ? "#6366f1" : emptyBarColor),
          borderRadius:    4,
          borderSkipped:   false,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend:  { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.raw} tab${ctx.raw !== 1 ? "s" : ""}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#6b6b7a", font: { size: 10 } } },
          y: { grid: { color: gridColor }, ticks: { color: "#6b6b7a", precision: 0 } },
        },
      },
    }
  );
}

// ── Breakdown views (rendered inside the detail modal) ────────────────────────

function renderBreakdownByDay(visits) {
  const days   = last7Days();
  const counts = Object.fromEntries(days.map(d => [d.key, 0]));

  for (const v of visits) {
    const key = dayKey(new Date(v.opened_at));
    if (key in counts) counts[key]++;
  }

  const max  = Math.max(...Object.values(counts), 1);
  const rows = days.map(d => {
    const count    = counts[d.key];
    const barWidth = Math.round((count / max) * 100);
    return `
      <div class="breakdown-row">
        <div class="breakdown-label">${d.label}</div>
        <div class="breakdown-bar-wrap">
          <div class="breakdown-bar" style="width:${barWidth}%"></div>
        </div>
        <div class="breakdown-value">${count}</div>
      </div>`;
  }).join("");

  return `<div class="breakdown-list">${rows}</div>`;
}

function renderBreakdownByCategory(visits) {
  const categories = buildCategoryStats(visits);
  if (categories.length === 0) return `<div class="empty-state">No data yet.</div>`;

  const max  = categories[0].visits;
  const rows = categories.map(c => {
    const barWidth = Math.round((c.visits / max) * 100);
    return `
      <div class="breakdown-row">
        <div class="breakdown-label">
          <span>${c.emoji}</span> <span>${c.name}</span>
        </div>
        <div class="breakdown-bar-wrap">
          <div class="breakdown-bar" style="width:${barWidth}%"></div>
        </div>
        <div class="breakdown-value">${c.visits}</div>
      </div>`;
  }).join("");

  return `<div class="breakdown-list">${rows}</div>`;
}

function renderBreakdownByDomain(visits) {
  const domains = topDomains(visits, 50);
  if (domains.length === 0) return `<div class="empty-state">No data yet.</div>`;

  const max  = domains[0].count;
  const rows = domains.map(d => {
    const { emoji } = categorizeDomain(d.domain);
    const barWidth  = Math.round((d.count / max) * 100);
    return `
      <div class="breakdown-row">
        <div class="breakdown-label">
          <span>${emoji}</span>
          <span class="breakdown-domain" title="${d.domain}">${d.domain}</span>
        </div>
        <div class="breakdown-bar-wrap">
          <div class="breakdown-bar" style="width:${barWidth}%"></div>
        </div>
        <div class="breakdown-value">${d.count}</div>
      </div>`;
  }).join("");

  return `<div class="breakdown-list">${rows}</div>`;
}

// ── Active ratio breakdown views ──────────────────────────────────────────────

function renderRatioBreakdownByDay(visits) {
  const days   = last7Days();
  const totals = Object.fromEntries(days.map(d => [d.key, { sum: 0, count: 0 }]));

  for (const v of visits) {
    const key = dayKey(new Date(v.opened_at));
    if (key in totals) {
      totals[key].sum += ratio(v);
      totals[key].count++;
    }
  }

  const rows = days.map(d => {
    const { sum, count } = totals[d.key];
    const avgRatio = count > 0 ? sum / count : 0;
    const barWidth = Math.round(avgRatio * 100);
    return `
      <div class="breakdown-row">
        <div class="breakdown-label">${d.label}</div>
        <div class="breakdown-bar-wrap">
          <div class="breakdown-bar" style="width:${barWidth}%"></div>
        </div>
        <div class="breakdown-value">${pct(avgRatio)}</div>
      </div>`;
  }).join("");

  return `<div class="breakdown-list">${rows}</div>`;
}

function renderRatioBreakdownByCategory(visits) {
  const categories = buildCategoryStats(visits);
  if (categories.length === 0) return `<div class="empty-state">No data yet.</div>`;

  const sorted = [...categories].sort((a, b) => b.avgActiveRatio - a.avgActiveRatio);
  const max    = sorted[0].avgActiveRatio || 1;

  const rows = sorted.map(c => {
    const barWidth = Math.round((c.avgActiveRatio / max) * 100);
    return `
      <div class="breakdown-row">
        <div class="breakdown-label">
          <span>${c.emoji}</span> <span>${c.name}</span>
        </div>
        <div class="breakdown-bar-wrap">
          <div class="breakdown-bar" style="width:${barWidth}%"></div>
        </div>
        <div class="breakdown-value">${pct(c.avgActiveRatio)}</div>
      </div>`;
  }).join("");

  return `<div class="breakdown-list">${rows}</div>`;
}

function renderRatioBreakdownByDomain(visits) {
  const domainMap = {};
  for (const v of visits) {
    if (!domainMap[v.domain]) domainMap[v.domain] = { sum: 0, count: 0 };
    domainMap[v.domain].sum += ratio(v);
    domainMap[v.domain].count++;
  }

  const domains = Object.entries(domainMap)
    .map(([domain, { sum, count }]) => ({ domain, avgRatio: sum / count, count }))
    .sort((a, b) => b.avgRatio - a.avgRatio)
    .slice(0, 20);

  if (domains.length === 0) return `<div class="empty-state">No data yet.</div>`;

  const max  = domains[0].avgRatio || 1;
  const rows = domains.map(d => {
    const { emoji } = categorizeDomain(d.domain);
    const barWidth  = Math.round((d.avgRatio / max) * 100);
    return `
      <div class="breakdown-row">
        <div class="breakdown-label">
          <span>${emoji}</span>
          <span class="breakdown-domain" title="${d.domain}">${d.domain}</span>
        </div>
        <div class="breakdown-bar-wrap">
          <div class="breakdown-bar" style="width:${barWidth}%"></div>
        </div>
        <div class="breakdown-value">${pct(d.avgRatio)}</div>
      </div>`;
  }).join("");

  return `<div class="breakdown-list">${rows}</div>`;
}

// ── Guilt tab breakdown views ─────────────────────────────────────────────────

function renderGuiltBreakdownByDay(visits) {
  const guilt = visits.filter(isGuiltTab);
  const days  = last7Days();
  const counts = Object.fromEntries(days.map(d => [d.key, 0]));

  for (const v of guilt) {
    const key = dayKey(new Date(v.opened_at));
    if (key in counts) counts[key]++;
  }

  const max  = Math.max(...Object.values(counts), 1);
  const rows = days.map(d => {
    const count    = counts[d.key];
    const barWidth = Math.round((count / max) * 100);
    return `
      <div class="breakdown-row">
        <div class="breakdown-label">${d.label}</div>
        <div class="breakdown-bar-wrap">
          <div class="breakdown-bar" style="width:${barWidth}%"></div>
        </div>
        <div class="breakdown-value">${count}</div>
      </div>`;
  }).join("");

  return `<div class="breakdown-list">${rows}</div>`;
}

function renderGuiltBreakdownByCategory(visits) {
  const guilt   = visits.filter(isGuiltTab);
  if (guilt.length === 0) return `<div class="empty-state">No guilt tabs yet.</div>`;

  const catMap = {};
  for (const v of guilt) {
    const cat = categorizeDomain(v.domain);
    if (!catMap[cat.name]) catMap[cat.name] = { ...cat, count: 0 };
    catMap[cat.name].count++;
  }

  const sorted = Object.values(catMap).sort((a, b) => b.count - a.count);
  const max    = sorted[0].count;

  const rows = sorted.map(c => {
    const barWidth = Math.round((c.count / max) * 100);
    return `
      <div class="breakdown-row">
        <div class="breakdown-label">
          <span>${c.emoji}</span> <span>${c.name}</span>
        </div>
        <div class="breakdown-bar-wrap">
          <div class="breakdown-bar" style="width:${barWidth}%"></div>
        </div>
        <div class="breakdown-value">${c.count}</div>
      </div>`;
  }).join("");

  return `<div class="breakdown-list">${rows}</div>`;
}

function renderGuiltBreakdownByDomain(visits) {
  const guilt = visits.filter(isGuiltTab);
  if (guilt.length === 0) return `<div class="empty-state">No guilt tabs yet.</div>`;

  const domainMap = {};
  for (const v of guilt) {
    if (!domainMap[v.domain]) domainMap[v.domain] = { count: 0 };
    domainMap[v.domain].count++;
  }

  const domains = Object.entries(domainMap)
    .map(([domain, { count }]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const max  = domains[0].count;
  const rows = domains.map(d => {
    const { emoji } = categorizeDomain(d.domain);
    const barWidth  = Math.round((d.count / max) * 100);
    return `
      <div class="breakdown-row">
        <div class="breakdown-label">
          <span>${emoji}</span>
          <span class="breakdown-domain" title="${d.domain}">${d.domain}</span>
        </div>
        <div class="breakdown-bar-wrap">
          <div class="breakdown-bar" style="width:${barWidth}%"></div>
        </div>
        <div class="breakdown-value">${d.count}</div>
      </div>`;
  }).join("");

  return `<div class="breakdown-list">${rows}</div>`;
}

// ── Report UI state ───────────────────────────────────────────────────────────

function setReportLoading(on) {
  document.getElementById("report-loading").style.display = on ? "flex" : "none";
  document.getElementById("report-content").style.display = on ? "none"  : "";
}

function showReport(text) {
  const el = document.getElementById("report-content");
  el.className = "report-content";

  // Convert basic markdown to HTML
  const html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") // escape first
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")  // **bold**
    .replace(/\*(.+?)\*/g, "<em>$1</em>")              // *italic*
    .replace(/\n\n/g, "</p><p>")                        // paragraphs
    .replace(/\n/g, "<br>");

  el.innerHTML = `<p>${html}</p>`;
  document.getElementById("btn-regenerate").style.display = "inline-block";
}

function showInsight(text) {
  const el = document.getElementById("insight-text");
  el.textContent = text;
  el.classList.add("has-insight");
}

function showReportError(msg) {
  const el = document.getElementById("report-content");
  el.className   = "report-placeholder";
  el.textContent = `Error: ${msg}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI LAYER — Claude API integration
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchClaudeReport(apiKey, summary) {
  const prompt = `You are a behavioral analyst. Here is one week of a user's browser tab data:

${JSON.stringify(summary, null, 2)}

Write a 3-4 paragraph personal cognitive patterns report. Include:
1. Their attention honesty score (do they open tabs they never read?)
2. Their peak focus vs. distraction hours
3. Their top guilt domains (sites they open but rarely engage with)
4. One specific, actionable behavioral insight

Be warm, specific, and use exact numbers from the data. Avoid generic advice.
Write as if you're a thoughtful analyst who genuinely finds their patterns interesting.

After the report, add one final line in exactly this format (no extra punctuation before INSIGHT:):
INSIGHT: [one specific, actionable sentence the user can act on this week]`;

  const res = await fetch(CLAUDE_API_URL, {
    method:  "POST",
    headers: {
      "Content-Type":                              "application/json",
      "x-api-key":                                 apiKey,
      "anthropic-version":                         "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: 1024,
      messages:   [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  const full  = data.content[0].text;

  const insightMatch = full.match(/^INSIGHT:\s*(.+)$/m);
  const insight      = insightMatch ? insightMatch[1].trim() : null;
  const report       = full.replace(/^INSIGHT:.*$/m, "").trim();

  return { report, insight };
}

async function generateReport() {
  const { visits = [], apiKey = "" } = await chrome.storage.local.get(["visits", "apiKey"]);

  if (!apiKey) {
    openSettings();
    alert("Please enter your Anthropic API key in Settings first.");
    return;
  }

  const cutoff = Date.now() - SEVEN_DAYS_MS;
  const recent = visits.filter(v => v.opened_at >= cutoff);

  if (recent.length < 5) {
    alert("Not enough data yet — browse for a bit more and come back!");
    return;
  }

  setReportLoading(true);

  try {
    const summary          = buildWeeklySummary(recent);
    const { report, insight } = await fetchClaudeReport(apiKey, summary);
    showReport(report);
    if (insight) showInsight(insight);
  } catch (err) {
    showReportError(err.message);
  } finally {
    setReportLoading(false);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

// ── Detail modal ──────────────────────────────────────────────────────────────

const detailModal = {
  overlay:       document.getElementById("detail-modal"),
  titleEl:       document.getElementById("detail-modal-title"),
  tabsEl:        document.getElementById("detail-modal-tabs"),
  contentEl:     document.getElementById("detail-modal-content"),
  tabs:          [],
  activeTab:     0,
  chartInstance: null,

  open({ title, tabs }) {
    this.tabs      = tabs;
    this.activeTab = 0;
    this.titleEl.textContent = title;
    this.overlay.style.display = "flex";
    this.renderTabs();
    this.renderContent();
  },

  close() {
    this._destroyChart();
    this.overlay.style.display = "none";
  },

  _destroyChart() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  },

  renderTabs() {
    this.tabsEl.innerHTML = this.tabs.map((t, i) => `
      <button class="detail-tab ${i === this.activeTab ? "active" : ""}" data-index="${i}">
        ${t.label}
      </button>
    `).join("");

    this.tabsEl.querySelectorAll(".detail-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        this.activeTab = parseInt(btn.dataset.index);
        this.tabsEl.querySelectorAll(".detail-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.renderContent();
      });
    });
  },

  renderContent() {
    this._destroyChart();
    this.contentEl.innerHTML = this.tabs[this.activeTab].render();
    const afterRender = this.tabs[this.activeTab].afterRender;
    if (afterRender) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        this.chartInstance = afterRender(this.contentEl);
      }));
    }
  },
};

// ── Settings modal ────────────────────────────────────────────────────────────

function openSettings() {
  document.getElementById("settings-modal").style.display = "flex";
}

function closeSettings() {
  document.getElementById("settings-modal").style.display = "none";
}

// ── Guilt Tab Cleaner ─────────────────────────────────────────────────────────

// Tabs eligible for closing: currently open in Chrome AND have tracking data
let guiltCandidates = []; // [{ tabId, url, domain, activeRatio }]

async function openGuiltCleaner() {
  // Query Chrome's live tabs and our background tracking data in parallel
  const [chromeTabs, { openVisits = [] }] = await Promise.all([
    chrome.tabs.query({}),
    chrome.runtime.sendMessage({ type: "GET_OPEN_TABS" }).catch(() => ({ openVisits: [] })),
  ]);

  // Build URL → activeRatio map from tracked open visits
  const ratioByUrl = {};
  for (const v of openVisits) {
    if (v.url) ratioByUrl[v.url] = ratio(v);
  }

  // Cross-reference: only include tabs we have tracking data for, skip chrome:// pages
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

  document.getElementById("guilt-qualify-count").textContent  = qualifying.length;
  document.getElementById("guilt-threshold-label").textContent = threshold;

  // Top 3 categories by frequency
  const catCounts = {};
  for (const c of qualifying) {
    const cat = categorizeDomain(c.domain);
    const key = cat.name;
    if (!catCounts[key]) catCounts[key] = { emoji: cat.emoji, count: 0 };
    catCounts[key].count++;
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
  const threshold      = parseInt(document.getElementById("guilt-slider").value) / 100;
  const qualifying     = guiltCandidates.filter(c => c.activeRatio < threshold);
  const tabIds         = qualifying.map(c => c.tabId);

  if (tabIds.length === 0) return;

  await chrome.tabs.remove(tabIds);
  closeGuiltCleaner();
  // Wait for background onRemoved handlers to finish saving before refreshing
  setTimeout(initDashboard, 300);
}

function closeGuiltCleaner() {
  document.getElementById("guilt-cleaner-modal").style.display = "none";
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP BOOTSTRAP — data loading, theme init, event listeners
// ═══════════════════════════════════════════════════════════════════════════════

function initTheme() {
  const btn = document.getElementById("btn-theme");

  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light");
    btn.textContent = "🌙 Dark";
  }

  btn.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light");
    btn.textContent = isLight ? "🌙 Dark" : "☀ Light";
    localStorage.setItem("theme", isLight ? "light" : "dark");
    renderHourlyChart(cachedVisits);
  });
}

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

// Report buttons
document.getElementById("btn-report").addEventListener("click", generateReport);
document.getElementById("btn-regenerate").addEventListener("click", generateReport);

// Detail modal
document.getElementById("detail-modal-close").addEventListener("click", () => detailModal.close());
document.getElementById("detail-modal").addEventListener("click", e => {
  if (e.target === document.getElementById("detail-modal")) detailModal.close();
});

// Tabs Opened stat card → breakdown modal
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

// Avg Active Ratio stat card → breakdown modal
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

// Guilt Tabs stat card → breakdown modal
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
