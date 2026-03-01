// claude.js — Claude AI integration + report UI; depends on constants.js + analytics.js

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
    const summary             = buildWeeklySummary(recent);
    const { report, insight } = await fetchClaudeReport(apiKey, summary);
    showReport(report);
    if (insight) showInsight(insight);
  } catch (err) {
    showReportError(err.message);
  } finally {
    setReportLoading(false);
  }
}

// ── Report UI ─────────────────────────────────────────────────────────────────

function setReportLoading(on) {
  document.getElementById("report-loading").style.display = on ? "flex" : "none";
  document.getElementById("report-content").style.display = on ? "none"  : "";
}

function showReport(text) {
  const el = document.getElementById("report-content");
  el.className = "report-content";

  // Convert basic markdown to HTML
  const html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p>")
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
