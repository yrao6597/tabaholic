// dashboard.js — reads tab visit data from storage and renders the dashboard UI

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVEN_DAYS_MS       = 7 * 24 * 60 * 60 * 1000;
const GUILT_MIN_TOTAL_MS  = 5 * 60 * 1000;  // tab must be open at least 5 minutes
const GUILT_MAX_RATIO     = 0.10;            // active ratio must be under 10%
const CLAUDE_MODEL        = "claude-sonnet-4-20250514";
const CLAUDE_API_URL      = "https://api.anthropic.com/v1/messages";

// ─── Domain categorization ────────────────────────────────────────────────────

// Each category defined once — name and emoji live in one place
const CAT = {
  SEARCH:       { name: "Search",        emoji: "🔍" },
  SOCIAL:       { name: "Social",        emoji: "📱" },
  SHOPPING:     { name: "Shopping",      emoji: "🛍️" },
  NEWS:         { name: "News",          emoji: "📰" },
  VIDEO:        { name: "Video",         emoji: "🎬" },
  TECH:         { name: "Tech & Dev",    emoji: "💻" },
  FOOD:         { name: "Food",          emoji: "🍳" },
  FINANCE:      { name: "Finance",       emoji: "💰" },
  HEALTH:       { name: "Health",        emoji: "🏋️" },
  LEARNING:     { name: "Learning",      emoji: "📚" },
  EMAIL:        { name: "Email & Comms", emoji: "📧" },
  PRODUCTIVITY: { name: "Productivity",  emoji: "🧰" },
  GOVERNMENT:   { name: "Government",    emoji: "🏛️" },
  OTHER:        { name: "Other",         emoji: "🌐" },
};

// Domains grouped by category — each domain appears exactly once
const CATEGORY_DOMAINS = [
  { category: CAT.SEARCH, domains: [
    "google.com", "bing.com", "duckduckgo.com", "yahoo.com", "ecosia.org", "startpage.com",
  ]},
  { category: CAT.SOCIAL, domains: [
    "twitter.com", "x.com", "facebook.com", "instagram.com", "reddit.com", "linkedin.com",
    "tiktok.com", "pinterest.com", "tumblr.com", "threads.net", "snapchat.com", "discord.com",
  ]},
  { category: CAT.SHOPPING, domains: [
    "amazon.com", "ebay.com", "etsy.com", "target.com", "walmart.com", "nike.com",
    "nordstrom.com", "asos.com", "zara.com", "hm.com", "uniqlo.com", "shein.com",
    "wayfair.com", "bestbuy.com", "sephora.com", "ulta.com", "aloyoga.com", "lululemon.com",
    "gap.com", "apple.com",
  ]},
  { category: CAT.NEWS, domains: [
    "nytimes.com", "bbc.com", "cnn.com", "reuters.com", "theguardian.com", "washingtonpost.com",
    "npr.org", "theatlantic.com", "bloomberg.com", "forbes.com", "wsj.com", "apnews.com",
    "vox.com", "axios.com", "techcrunch.com", "theverge.com", "wired.com", "medium.com",
  ]},
  { category: CAT.VIDEO, domains: [
    "youtube.com", "netflix.com", "hulu.com", "twitch.tv", "vimeo.com", "disneyplus.com",
    "max.com", "peacocktv.com", "primevideo.com", "crunchyroll.com", "spotify.com", "soundcloud.com",
  ]},
  { category: CAT.TECH, domains: [
    "github.com", "stackoverflow.com", "npmjs.com", "developer.mozilla.org",
    "news.ycombinator.com", "dev.to", "codepen.io", "replit.com", "vercel.com", "netlify.com",
  ]},
  { category: CAT.FOOD, domains: [
    "allrecipes.com", "food52.com", "seriouseats.com", "epicurious.com", "foodnetwork.com",
    "bonappetit.com", "tasty.co", "delish.com", "yelp.com", "doordash.com", "ubereats.com", "grubhub.com",
  ]},
  { category: CAT.FINANCE, domains: [
    "robinhood.com", "coinbase.com", "fidelity.com", "schwab.com", "paypal.com",
    "venmo.com", "chase.com", "bankofamerica.com", "wellsfargo.com", "nerdwallet.com",
  ]},
  { category: CAT.HEALTH, domains: [
    "myfitnesspal.com", "strava.com", "webmd.com", "healthline.com", "mayoclinic.org", "nih.gov",
  ]},
  { category: CAT.LEARNING, domains: [
    "coursera.org", "udemy.com", "khanacademy.org", "edx.org", "duolingo.com",
    "brilliant.org", "skillshare.com", "udacity.com", "wikipedia.org",
  ]},
  { category: CAT.EMAIL, domains: [
    "mail.google.com", "gmail.com", "outlook.com", "proton.me", "slack.com",
    "zoom.us", "meet.google.com", "telegram.org", "whatsapp.com",
  ]},
  { category: CAT.PRODUCTIVITY, domains: [
    "notion.so", "docs.google.com", "drive.google.com", "sheets.google.com", "trello.com",
    "asana.com", "monday.com", "airtable.com", "figma.com", "linear.app", "miro.com",
    "coda.io", "obsidian.md",
  ]},
];

// Keyword fallbacks — checked in order when domain isn't in CATEGORY_DOMAINS
const CATEGORY_KEYWORD_PATTERNS = [
  [/news|times|post|herald|journal|daily|gazette|tribune|press|report/i, CAT.NEWS],
  [/shop|store|buy|deals|sale|market|mall|boutique/i,                    CAT.SHOPPING],
  [/health|medical|clinic|doctor|hospital|pharma|wellness/i,             CAT.HEALTH],
  [/learn|course|academy|school|university|college|edu\./i,              CAT.LEARNING],
  [/bank|finance|invest|stock|crypto|money|fund|credit|loan/i,           CAT.FINANCE],
  [/food|recipe|cook|eat|restaurant|kitchen|meal|nutrition/i,            CAT.FOOD],
  [/github|gitlab|code|dev|stack|api|npm|docs\./i,                       CAT.TECH],
  [/mail|email|inbox|message|chat|meet\.|zoom/i,                         CAT.EMAIL],
  [/video|stream|watch|tv|film|movie|music|podcast/i,                    CAT.VIDEO],
];

// Build the domain → category lookup map once from CATEGORY_DOMAINS
const DOMAIN_CATEGORY_MAP = Object.fromEntries(
  CATEGORY_DOMAINS.flatMap(({ category, domains }) =>
    domains.map(domain => [domain, category])
  )
);

function categorizeDomain(domain) {
  const normalized = domain.startsWith("www.") ? domain.slice(4) : domain;

  if (DOMAIN_CATEGORY_MAP[normalized]) return DOMAIN_CATEGORY_MAP[normalized];

  for (const [pattern, category] of CATEGORY_KEYWORD_PATTERNS) {
    if (pattern.test(normalized)) return category;
  }

  if (normalized.endsWith(".edu")) return CAT.LEARNING;
  if (normalized.endsWith(".gov")) return CAT.GOVERNMENT;

  return CAT.OTHER;
}

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

// ─── Bootstrap ────────────────────────────────────────────────────────────────

initTheme();
initDashboard();

// ─── Theme ────────────────────────────────────────────────────────────────────

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

// ─── Data loading ─────────────────────────────────────────────────────────────

// Cached so the chart can redraw on theme toggle without re-reading storage
let cachedVisits = [];

function initDashboard() {
  const cutoff = Date.now() - SEVEN_DAYS_MS;

  Promise.all([
    chrome.storage.local.get(["visits", "apiKey"]),
    chrome.runtime.sendMessage({ type: "GET_OPEN_TABS" }).catch(() => ({ openVisits: [] })),
  ]).then(([storage, { openVisits = [] }]) => {
    const closedVisits = (storage.visits || []).filter(v => v.opened_at >= cutoff);
    const openRecent   = openVisits.filter(v => v.opened_at >= cutoff);

    // Merge: closed visits first, then currently open tabs
    cachedVisits = [...closedVisits, ...openRecent];

    renderStats(cachedVisits);
    renderGuiltList(cachedVisits);
    renderDomainList(cachedVisits);
    renderCategoryList(cachedVisits);
    renderHourlyChart(cachedVisits);

    document.getElementById("api-key-input").value = storage.apiKey || "";
  });
}

// ─── Stats row ────────────────────────────────────────────────────────────────

function renderStats(visits) {
  const avgRatio = visits.length
    ? avg(visits.map(v => ratio(v)))
    : 0;

  document.getElementById("stat-total-tabs").textContent   = visits.length;
  document.getElementById("stat-active-ratio").textContent = pct(avgRatio);
  document.getElementById("stat-guilt-count").textContent  = visits.filter(isGuiltTab).length;

  const top = topDomains(visits, 1);
  document.getElementById("stat-top-domain").textContent = top.length ? top[0].domain : "—";
}

// ─── Guilt tab list ───────────────────────────────────────────────────────────

function renderGuiltList(visits) {
  const el    = document.getElementById("guilt-list");
  const guilt = visits
    .filter(isGuiltTab)
    .sort((a, b) => ratio(a) - ratio(b))  // worst ratio first
    .slice(0, 8);

  if (guilt.length === 0) {
    el.innerHTML = `<div class="empty-state">No guilt tabs yet — you're doing great.</div>`;
    return;
  }

  el.innerHTML = guilt.map(guiltItemHTML).join("");
}

function guiltItemHTML(v) {
  const openBadge = v.is_open
    ? `<span class="guilt-badge blue">still open</span>`
    : "";
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

// ─── Domain list ──────────────────────────────────────────────────────────────

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

// ─── Browsing categories ──────────────────────────────────────────────────────

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

// ─── Hourly chart ─────────────────────────────────────────────────────────────

let chartInstance = null;

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

// ─── Claude weekly report ─────────────────────────────────────────────────────

document.getElementById("btn-report").addEventListener("click", generateReport);
document.getElementById("btn-regenerate").addEventListener("click", generateReport);

async function generateReport() {
  const { visits = [], apiKey = "" } = await chrome.storage.local.get(["visits", "apiKey"]);

  if (!apiKey) {
    openSettings();
    alert("Please enter your Anthropic API key in Settings first.");
    return;
  }

  const cutoff  = Date.now() - SEVEN_DAYS_MS;
  const recent  = visits.filter(v => v.opened_at >= cutoff);

  if (recent.length < 5) {
    alert("Not enough data yet — browse for a bit more and come back!");
    return;
  }

  setReportLoading(true);

  try {
    const summary = buildWeeklySummary(recent);
    const report  = await fetchClaudeReport(apiKey, summary);
    showReport(report);
  } catch (err) {
    showReportError(err.message);
  } finally {
    setReportLoading(false);
  }
}

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
    total_tabs_opened:  visits.length,
    avg_active_ratio:   Math.round((totalRatio / visits.length) * 100) / 100,
    guilt_tab_count:    visits.filter(isGuiltTab).length,
    top_domains:        topDomainList,
    peak_open_hour:     hourCounts.indexOf(Math.max(...hourCounts)),
  };
}

async function fetchClaudeReport(apiKey, summary) {
  const prompt = `You are a behavioral analyst. Here is one week of a user's browser tab data:

${JSON.stringify(summary, null, 2)}

Write a 3-4 paragraph personal cognitive patterns report. Include:
1. Their attention honesty score (do they open tabs they never read?)
2. Their peak focus vs. distraction hours
3. Their top guilt domains (sites they open but rarely engage with)
4. One specific, actionable behavioral insight

Be warm, specific, and use exact numbers from the data. Avoid generic advice.
Write as if you're a thoughtful analyst who genuinely finds their patterns interesting.`;

  const res = await fetch(CLAUDE_API_URL, {
    method:  "POST",
    headers: {
      "Content-Type":                          "application/json",
      "x-api-key":                             apiKey,
      "anthropic-version":                     "2023-06-01",
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
  return data.content[0].text;
}

// ─── Report UI state ──────────────────────────────────────────────────────────

function setReportLoading(on) {
  document.getElementById("report-loading").style.display = on ? "flex" : "none";
  document.getElementById("report-content").style.display = on ? "none"  : "";
}

function showReport(text) {
  const el = document.getElementById("report-content");
  el.className   = "report-content";
  el.textContent = text;
  document.getElementById("btn-regenerate").style.display = "inline-block";
}

function showReportError(msg) {
  const el = document.getElementById("report-content");
  el.className   = "report-placeholder";
  el.textContent = `Error: ${msg}`;
}

// ─── Detail modal (generic) ───────────────────────────────────────────────────
//
// Usage: openDetailModal({ title, tabs: [{ label, render }] })
// Each tab's render() returns an HTML string for that view.

const detailModal = {
  overlay:  document.getElementById("detail-modal"),
  titleEl:  document.getElementById("detail-modal-title"),
  tabsEl:   document.getElementById("detail-modal-tabs"),
  contentEl: document.getElementById("detail-modal-content"),
  tabs:     [],
  activeTab: 0,

  open({ title, tabs }) {
    this.tabs      = tabs;
    this.activeTab = 0;
    this.titleEl.textContent = title;
    this.renderTabs();
    this.renderContent();
    this.overlay.style.display = "flex";
  },

  close() {
    this.overlay.style.display = "none";
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
    this.contentEl.innerHTML = this.tabs[this.activeTab].render();
  },
};

document.getElementById("detail-modal-close").addEventListener("click", () => detailModal.close());
document.getElementById("detail-modal").addEventListener("click", e => {
  if (e.target === document.getElementById("detail-modal")) detailModal.close();
});

// ─── Tabs Opened breakdown ────────────────────────────────────────────────────

document.getElementById("card-total-tabs").addEventListener("click", () => {
  detailModal.open({
    title: "Tabs Opened — Breakdown",
    tabs: [
      { label: "By Day",      render: () => renderBreakdownByDay(cachedVisits) },
      { label: "By Category", render: () => renderBreakdownByCategory(cachedVisits) },
      { label: "By Domain",   render: () => renderBreakdownByDomain(cachedVisits) },
    ],
  });
});

function renderBreakdownByDay(visits) {
  const days = last7Days();
  const counts = Object.fromEntries(days.map(d => [d.key, 0]));

  for (const v of visits) {
    const key = dayKey(new Date(v.opened_at));
    if (key in counts) counts[key]++;
  }

  const max = Math.max(...Object.values(counts), 1);

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

  const max = categories[0].visits;
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

  const max = domains[0].count;
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

// Returns the last 7 calendar days as [{ key: "YYYY-MM-DD", label: "Mon Feb 24" }]
function last7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      key:   dayKey(d),
      label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    };
  });
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

// ─── Settings modal ───────────────────────────────────────────────────────────

document.getElementById("btn-settings").addEventListener("click", openSettings);
document.getElementById("btn-cancel").addEventListener("click", closeSettings);
document.getElementById("btn-save-key").addEventListener("click", async () => {
  const key = document.getElementById("api-key-input").value.trim();
  await chrome.storage.local.set({ apiKey: key });
  closeSettings();
});

function openSettings() {
  document.getElementById("settings-modal").style.display = "flex";
}

function closeSettings() {
  document.getElementById("settings-modal").style.display = "none";
}

// ─── Pure utility functions ───────────────────────────────────────────────────

function ratio(v) {
  return v.total_time_ms > 0 ? v.active_time_ms / v.total_time_ms : 0;
}

function isGuiltTab(v) {
  return v.total_time_ms >= GUILT_MIN_TOTAL_MS && ratio(v) < GUILT_MAX_RATIO;
}

function avg(arr) {
  return arr.length ? arr.reduce((sum, n) => sum + n, 0) / arr.length : 0;
}

function pct(r) {
  return `${Math.round(r * 100)}%`;
}

function formatDuration(ms) {
  if (ms < 60_000)    return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function topDomains(visits, n) {
  const counts = {};
  for (const v of visits) {
    counts[v.domain] = (counts[v.domain] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}
