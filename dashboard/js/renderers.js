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

  const isZen         = document.body.classList.contains("zen");
  const isLight       = document.body.classList.contains("light");
  const activeColor   = isZen ? ZEN_BAR_ACTIVE : BAR_ACTIVE_COLOR;
  const emptyBarColor = isZen ? ZEN_BAR_EMPTY  : (isLight ? BAR_EMPTY_LIGHT : BAR_EMPTY_DARK);
  const gridColor     = isZen ? ZEN_BAR_GRID   : (isLight ? BAR_GRID_LIGHT  : BAR_GRID_DARK);
  const tickColor     = isZen ? ZEN_BAR_TICK   : BAR_TICK_COLOR;

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
          backgroundColor: counts.map(c => c > 0 ? activeColor : emptyBarColor),
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
          x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10, family: isZen ? "'Cormorant Garamond', Georgia, serif" : undefined } } },
          y: { grid: { color: gridColor }, ticks: { color: tickColor, precision: 0 } },
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

// ── 7-Day Trend card ──────────────────────────────────────────────────────────

let trendPage         = 0;
let trendScrollLocked = false;
let trendScrollAbort  = null;

// Returns a human-readable comparison phrase with color class.
// type: "ratio" (up = good), "guilt" (up = bad), "neutral"
function trendDeltaHtml(delta, type) {
  if (delta === null) {
    return `<span class="trend-insight-delta trend-delta-neutral">no data from yesterday</span>`;
  }
  if (delta === 0) {
    return `<span class="trend-insight-delta trend-delta-neutral">same as yesterday</span>`;
  }

  const abs  = Math.abs(delta);
  let text, cls;

  if (type === "ratio") {
    const dir = delta > 0 ? "up" : "down";
    cls  = delta > 0 ? "good" : "bad";
    text = `${dir} ${abs}% from yesterday`;
  } else {
    const word = delta > 0 ? "more" : "fewer";
    cls  = (type === "guilt") ? (delta > 0 ? "bad" : "good") : "neutral";
    text = `${abs} ${word} than yesterday`;
  }

  return `<span class="trend-insight-delta trend-delta-${cls}">${text}</span>`;
}

// Inline delta used in the weekly table rows.
function deltaHtml(delta, type) {
  if (delta === null || delta === 0) return "";
  const positive = delta > 0;
  const sign     = positive ? "+" : "";
  const suffix   = type === "ratio" ? "%" : "";

  let cls;
  if (type === "ratio")      cls = positive ? "good" : "bad";
  else if (type === "guilt") cls = positive ? "bad"  : "good";
  else                       cls = "neutral";

  return ` <span class="trend-delta trend-delta-${cls}">${sign}${delta}${suffix}</span>`;
}

function renderTrendCard(visits) {
  const el       = document.getElementById("trend-table");
  const days     = last7Days();
  const todayKey = dayKey(new Date());

  // Accumulate per-day stats
  const dayStats = {};
  for (const d of days) dayStats[d.key] = { count: 0, ratioSum: 0, guilt: 0 };

  for (const v of visits) {
    const key = dayKey(new Date(v.opened_at));
    if (key in dayStats) {
      dayStats[key].count++;
      dayStats[key].ratioSum += ratio(v);
      if (isGuiltTab(v)) dayStats[key].guilt++;
    }
  }

  // Today and yesterday stats
  const todayIdx = days.findIndex(d => d.key === todayKey);
  const ts       = todayIdx >= 0 ? dayStats[days[todayIdx].key] : null;
  const ys       = todayIdx > 0  ? dayStats[days[todayIdx - 1].key] : null;

  const todayCount = ts ? ts.count : 0;
  const todayRatio = ts && ts.count > 0 ? ts.ratioSum / ts.count : null;
  const todayGuilt = ts ? ts.guilt : 0;

  const yCount = ys && ys.count > 0 ? ys.count : null;
  const yRatio = ys && ys.count > 0 ? ys.ratioSum / ys.count : null;
  const yGuilt = ys && ys.count > 0 ? ys.guilt  : null;

  const tabsDelta  = yCount !== null ? todayCount - yCount : null;
  const ratioDelta = (todayRatio !== null && yRatio !== null)
    ? Math.round(todayRatio * 100) - Math.round(yRatio * 100) : null;
  const guiltDelta = yGuilt !== null ? todayGuilt - yGuilt : null;

  const tabsLabel  = `${todayCount} tab${todayCount !== 1 ? "s" : ""} opened today`;
  const ratioLabel = todayRatio !== null ? `${pct(todayRatio)} avg active ratio` : "No browsing data today";
  const guiltLabel = `${todayGuilt} guilt tab${todayGuilt !== 1 ? "s" : ""} today`;

  function insightLine(label, delta, type) {
    return `
      <div class="trend-insight-line">
        <span class="trend-insight-main">${label}</span>
        ${trendDeltaHtml(delta, type)}
      </div>`;
  }

  const page0Html = `
    <div class="trend-insights">
      ${insightLine(tabsLabel,  tabsDelta,  "neutral")}
      ${insightLine(ratioLabel, ratioDelta, "ratio")}
      ${insightLine(guiltLabel, guiltDelta, "guilt")}
    </div>`;

  // 7-day table (page 1)
  const tableHeader = `
    <div class="trend-header">
      <div class="trend-day-col"></div>
      <div class="trend-val-col">Tabs</div>
      <div class="trend-val-col">Ratio</div>
      <div class="trend-val-col">Guilt</div>
    </div>`;

  const tableRows = days.map((d, i) => {
    const s       = dayStats[d.key];
    const count   = s.count;
    const avgRat  = count > 0 ? s.ratioSum / count : null;
    const guilt   = s.guilt;
    const isToday = d.key === todayKey;

    let prev = null;
    if (i > 0) {
      const ps = dayStats[days[i - 1].key];
      if (ps.count > 0) prev = { count: ps.count, avgRat: ps.ratioSum / ps.count, guilt: ps.guilt };
    }

    const tabsDlt  = (count > 0 && prev) ? count - prev.count : null;
    const ratioDlt = (avgRat !== null && prev) ? Math.round(avgRat * 100) - Math.round(prev.avgRat * 100) : null;
    const guiltDlt = (count > 0 && prev) ? guilt - prev.guilt : null;

    const noData    = `<span class="trend-no-data">—</span>`;
    const tabsCell  = count === 0 ? noData : `${count}${deltaHtml(tabsDlt, "neutral")}`;
    const ratioCell = avgRat === null ? noData : `${pct(avgRat)}${deltaHtml(ratioDlt, "ratio")}`;
    const guiltCell = count === 0 ? noData : `${guilt}${deltaHtml(guiltDlt, "guilt")}`;
    const badge     = isToday ? ` <span class="trend-today-badge">today</span>` : "";

    return `
      <div class="trend-row${isToday ? " trend-row-today" : ""}">
        <div class="trend-day-col">${d.label}${badge}</div>
        <div class="trend-val-col">${tabsCell}</div>
        <div class="trend-val-col">${ratioCell}</div>
        <div class="trend-val-col">${guiltCell}</div>
      </div>`;
  }).join("");

  const page1Html = `${tableHeader}${tableRows}`;

  el.innerHTML = `
    <div class="trend-pager">
      <div class="trend-page${trendPage === 0 ? " trend-page-active" : ""}" data-page="0">${page0Html}</div>
      <div class="trend-page${trendPage === 1 ? " trend-page-active" : ""}" data-page="1">${page1Html}</div>
    </div>
    <div class="trend-dots" id="trend-dots">
      <span class="trend-dot${trendPage === 0 ? " active" : ""}" data-page="0" title="Today vs yesterday"></span>
      <span class="trend-dot${trendPage === 1 ? " active" : ""}" data-page="1" title="7-day breakdown"></span>
    </div>`;

  // Shared page-switch — slides in from the correct direction
  function goTrendPage(next) {
    if (next === trendPage || next < 0 || next >= 2) return;
    const pages = el.querySelectorAll(".trend-page");
    const dir   = next > trendPage ? 1 : -1;
    trendPage   = next;

    pages.forEach((p, i) => {
      p.classList.remove("trend-page-active", "trend-page-enter-right", "trend-page-enter-left");
      if (i === trendPage) {
        p.classList.add(dir > 0 ? "trend-page-enter-right" : "trend-page-enter-left");
        requestAnimationFrame(() => p.classList.add("trend-page-active"));
      }
    });

    el.querySelectorAll(".trend-dot").forEach((d, i) => d.classList.toggle("active", i === trendPage));
  }

  // Dot click
  document.getElementById("trend-dots").addEventListener("click", e => {
    const dot = e.target.closest(".trend-dot");
    if (!dot) return;
    goTrendPage(parseInt(dot.dataset.page));
  });

  // Scroll / swipe to flip pages
  if (trendScrollAbort) trendScrollAbort.abort();
  trendScrollAbort = new AbortController();
  el.closest(".card").addEventListener("wheel", e => {
    // Prefer horizontal delta (trackpad swipe); fall back to vertical
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const next  = delta > 0 ? trendPage + 1 : trendPage - 1;
    if (next < 0 || next >= 2) return;  // nothing to flip — let page scroll through
    e.preventDefault();
    if (trendScrollLocked) return;
    goTrendPage(next);
    trendScrollLocked = true;
    setTimeout(() => { trendScrollLocked = false; }, 420);
  }, { passive: false, signal: trendScrollAbort.signal });
}

