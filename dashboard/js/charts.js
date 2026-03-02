// charts.js — Reusable chart utilities for Tab Analyzer

// ── Tooltip positioner ────────────────────────────────────────────────────────
// Offsets tooltip from cursor so it doesn't cover the hovered segment
Chart.Tooltip.positioners.cursor = function(_items, eventPos) {
  return { x: eventPos.x + 16, y: eventPos.y - 28 };
};

// ── Constants ─────────────────────────────────────────────────────────────────
// PIE_COLORS lives in colors.js

const PIE_HEIGHT = 120;

// ── Doughnut / pie chart ──────────────────────────────────────────────────────
// Renders a doughnut chart prepended to `el`. Returns the Chart instance.
// Zero-value entries are filtered out so they don't clutter the legend.
// Optional `formatValue` fn formats the raw value in the tooltip (e.g. v => `${v}%`).
function drawBreakdownPie(el, labels, data, formatValue) {
  const filtered = labels.reduce((acc, label, i) => {
    if (data[i] > 0) { acc.labels.push(label); acc.data.push(data[i]); }
    return acc;
  }, { labels: [], data: [] });

  // Wrapper with a fixed height — Chart.js reads parent.clientHeight, so this
  // ensures all tabs get exactly PIE_HEIGHT regardless of content below.
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `height:${PIE_HEIGHT}px; position:relative; margin:0 0 20px;`;
  el.insertBefore(wrapper, el.firstChild);

  const canvas = document.createElement("canvas");
  wrapper.appendChild(canvas);

  const isLight   = document.body.classList.contains("light");
  const textColor = isLight ? PIE_TEXT_LIGHT : PIE_TEXT_DARK;

  return new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: filtered.labels,
      datasets: [{
        data:            filtered.data,
        backgroundColor: PIE_COLORS.slice(0, filtered.data.length),
        borderWidth:     2,
        borderColor:     isLight ? PIE_BORDER_LIGHT : PIE_BORDER_DARK,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      layout: { padding: { right: 8 } },
      plugins: {
        legend: {
          position: "right",
          labels: { color: textColor, font: { size: 11 }, padding: 14, boxWidth: 12, maxWidth: 180 },
        },
        tooltip: {
          position: "cursor",
          callbacks: {
            label: ctx => {
              const total = filtered.data.reduce((a, b) => a + b, 0);
              const val   = formatValue ? formatValue(ctx.raw) : ctx.raw;
              return ` ${ctx.label}: ${val} (${Math.round(ctx.raw / total * 100)}%)`;
            },
          },
        },
      },
    },
  });
}
