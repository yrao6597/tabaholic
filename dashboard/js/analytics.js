// analytics.js — Data aggregation functions; depends on utils.js + categories.js

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
