// colors.js — Single source of truth for all colors in Tabaholics
//
// Sections:
//   1. Accent        — brand color shared across both themes
//   2. Dark theme    — mirrors the :root CSS variables in dashboard.css
//   3. Light theme   — mirrors the .light CSS variables in dashboard.css
//   4. Pie chart     — 12-color categorical palette + per-theme chrome
//   5. Bar chart     — hourly activity chart colors


// ── 1. Accent (identical in both themes) ──────────────────────────────────────

const ACCENT       = "#6366f1";  // primary brand / interactive color
const ACCENT_HOVER = "#4f52d4";  // button hover state
const ACCENT_LIGHT_VAR = "#818cf8";  // --accent-light in dark theme (lighter tint)
//                  "#4f52d4"        // --accent-light in light theme (same as hover)


// ── 2. Dark theme ─────────────────────────────────────────────────────────────
// Used by dashboard.css as CSS variables on :root.
// JS chart code that needs to respect the active theme reads these directly.

const DARK = {
  // Backgrounds
  bg:             "#0d0d0f",   // --bg            page background
  surface:        "#17171f",   // --surface        card / panel background
  surfaceAlt:     "#13131e",   // --surface-alt    alternate surface (subtle)
  surfaceRaised:  "#1e1e28",   // --surface-raised elevated element (input, pill)

  // Borders
  border:         "#1e1e28",   // --border         card border
  borderSubtle:   "#2a2a35",   // --border-subtle  dividers, input outlines

  // Text
  textPrimary:    "#ffffff",   // --text-primary   headings, stat values
  textSecondary:  "#e2e2e6",   // --text-secondary body text
  textMuted:      "#6b6b7a",   // --text-muted     labels, secondary info
  textFaint:      "#444455",   // --text-faint     placeholder, empty states
  textMeta:       "#9999aa",   // --text-meta      timestamps, sub-labels
  textReport:     "#c8c8d4",   // --text-report    Claude report body text

  // Status badges
  badgeRedBg:     "#2d1515",   // --badge-red-bg
  badgeRedText:   "#f87171",   // --badge-red-text
  badgeYellowBg:  "#1f1a0e",   // --badge-yellow-bg
  badgeYellowText:"#fbbf24",   // --badge-yellow-text
  badgeBlueBg:    "#0e1a2d",   // --badge-blue-bg
  badgeBlueText:  "#60a5fa",   // --badge-blue-text

  // Modal
  modalOverlay:   "rgba(0,0,0,0.6)",  // --modal-overlay
};


// ── 3. Light theme ────────────────────────────────────────────────────────────
// Applied via the .light class on <body>. CSS uses these as overrides on .light.

const LIGHT = {
  // Backgrounds
  bg:             "#f4f4f8",   // --bg
  surface:        "#ffffff",   // --surface
  surfaceAlt:     "#eeeef6",   // --surface-alt
  surfaceRaised:  "#ebebf3",   // --surface-raised

  // Borders
  border:         "#e2e2ec",   // --border
  borderSubtle:   "#d0d0e0",   // --border-subtle

  // Text
  textPrimary:    "#0d0d0f",   // --text-primary
  textSecondary:  "#1e1e28",   // --text-secondary
  textMuted:      "#6b6b7a",   // --text-muted     (same as dark)
  textFaint:      "#9999aa",   // --text-faint
  textMeta:       "#6b6b7a",   // --text-meta      (same as textMuted in light)
  textReport:     "#2a2a35",   // --text-report

  // Status badges
  badgeRedBg:     "#fde8e8",   // --badge-red-bg
  badgeRedText:   "#dc2626",   // --badge-red-text
  badgeYellowBg:  "#fef3c7",   // --badge-yellow-bg
  badgeYellowText:"#d97706",   // --badge-yellow-text
  badgeBlueBg:    "#dbeafe",   // --badge-blue-bg
  badgeBlueText:  "#2563eb",   // --badge-blue-text

  // Modal
  modalOverlay:   "rgba(0,0,0,0.3)",  // --modal-overlay
};


// ── 4. Pie / doughnut charts ───────────────────────────────────────────────────
// Used by: charts.js → drawBreakdownPie()

// 12-color categorical sequence for pie/doughnut slices
const PIE_COLORS = [
  "#6366f1",  // indigo   (= accent)
  "#8b5cf6",  // violet
  "#ec4899",  // pink
  "#f59e0b",  // amber
  "#10b981",  // emerald
  "#3b82f6",  // blue
  "#ef4444",  // red
  "#14b8a6",  // teal
  "#f97316",  // orange
  "#06b6d4",  // cyan
  "#a78bfa",  // light violet
  "#34d399",  // light emerald
];

// Legend text color (Chart.js labels to the right of the chart)
const PIE_TEXT_DARK  = "#c8c8d8";
const PIE_TEXT_LIGHT = "#3a3a4a";

// Segment border (thin gap between adjacent slices)
const PIE_BORDER_DARK  = "#12121a";  // slightly darker than DARK.bg for depth
const PIE_BORDER_LIGHT = "#ffffff";  // = LIGHT.surface


// ── 5. Bar chart (hourly activity) ────────────────────────────────────────────
// Used by: renderers.js → renderHourlyChart()

const BAR_ACTIVE_COLOR = "#6366f1";  // filled bar (= accent)

// Empty bars (hours with zero tabs) — blends into the background
const BAR_EMPTY_DARK  = "#1e1e28";   // = DARK.surfaceRaised
const BAR_EMPTY_LIGHT = "#ebebf3";   // = LIGHT.surfaceRaised

// Y-axis grid lines
const BAR_GRID_DARK  = "#1e1e28";    // = DARK.surfaceRaised
const BAR_GRID_LIGHT = "#e2e2ec";    // = LIGHT.border

// Axis tick label color (same in both themes)
const BAR_TICK_COLOR = "#6b6b7a";    // = textMuted
