// utils.js — Pure utility functions, no dependencies on other app files

// ── Visit metrics ─────────────────────────────────────────────────────────────
function ratio(v) {
  return v.total_time_ms > 0 ? v.active_time_ms / v.total_time_ms : 0;
}

function isGuiltTab(v) {
  return v.total_time_ms >= GUILT_MIN_TOTAL_MS && ratio(v) < GUILT_MAX_RATIO;
}

// ── Math helpers ──────────────────────────────────────────────────────────────
function avg(arr) {
  return arr.length ? arr.reduce((sum, n) => sum + n, 0) / arr.length : 0;
}

// ── Formatting ────────────────────────────────────────────────────────────────
function pct(r) {
  return `${Math.round(r * 100)}%`;
}

function formatDuration(ms) {
  if (ms < 60_000)    return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

// ── Domain helpers ────────────────────────────────────────────────────────────
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

// ── Date helpers ──────────────────────────────────────────────────────────────
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
