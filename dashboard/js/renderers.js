// renderers.js — All DOM rendering functions; depends on utils + categories + analytics

// ── Hourly chart state ────────────────────────────────────────────────────────
let hourlyChartInstance = null;

// ── Stats row ─────────────────────────────────────────────────────────────────

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

  if (hourlyChartInstance) {
    hourlyChartInstance.destroy();
    hourlyChartInstance = null;
  }

  hourlyChartInstance = new Chart(
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

// ── Tabs opened breakdown views ───────────────────────────────────────────────

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
  const guilt  = visits.filter(isGuiltTab);
  const days   = last7Days();
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
  const guilt = visits.filter(isGuiltTab);
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

