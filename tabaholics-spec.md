# Tab Hoarding Analyzer — Project Spec

## What This Is

A Chrome extension that passively tracks your tab behavior and uses Claude AI to generate weekly insights about your cognitive and attention patterns. Think Spotify Wrapped, but for your brain's relationship with the internet.

---

## Core Concept

Most people open tabs with intent and never return. The gap between *how long a tab exists* and *how long you actually engaged with it* reveals patterns about decision fatigue, information anxiety, and attention honesty.

---

## Data Model

Every tab visit should produce a record like this:

```json
{
  "id": "unique-visit-id",
  "url": "https://example.com/article",
  "domain": "example.com",
  "title": "Page title",
  "opened_at": 1700000000000,
  "closed_at": 1700003600000,
  "total_time_ms": 3600000,
  "active_time_ms": 180000,
  "focus_sessions": [
    { "start": 1700000000000, "end": 1700000120000, "duration_ms": 120000 },
    { "start": 1700001000000, "end": 1700001060000, "duration_ms": 60000 }
  ],
  "scroll_depth_pct": 34,
  "returned_to": true,
  "return_count": 2
}
```

**Key metric:** `active_ratio = active_time_ms / total_time_ms`  
A tab with 2 hours total but 3 minutes active = guilt tab. This is the core signal.

---

## Technical Architecture

### 1. Background Script (`background.js`)
Tracks tab lifecycle using Chrome APIs:

- `chrome.tabs.onCreated` — log tab open with timestamp
- `chrome.tabs.onRemoved` — log tab close, compute total_time
- `chrome.tabs.onActivated` — track when user switches to a tab (start active session)
- `chrome.windows.onFocusChanged` — detect when user alt-tabs away from Chrome entirely (end active session)
- Store all data in `chrome.storage.local`

### 2. Content Script (`content.js`)
Injected into every page, tracks:

- Scroll depth (max % of page scrolled)
- `document.visibilitychange` — page hidden/visible (supplements background script tracking)

Content script sends data back to background script via `chrome.runtime.sendMessage`.

### 3. Dashboard (`dashboard.html` + `dashboard.js`)
Popup or full-page dashboard showing:

- **Today's stats**: tabs opened, avg active ratio, top domains
- **Guilt tab hall of shame**: tabs open > 1 hour with active ratio < 10%
- **Attention timeline**: when during the day you open/close most tabs
- **Weekly trends**: rolling 7-day view
- **Claude Insights panel**: AI-generated behavioral narrative (see below)

### 4. Claude Insights (`insights.js`)
- Aggregates last 7 days of tab data into a summary object
- Sends to Claude API (`claude-sonnet-4-20250514`) with a prompt asking for behavioral interpretation
- Displays the response in the dashboard as a "Weekly Brain Report"

---

## Claude Insights Prompt (use this exactly)

```
You are a behavioral analyst. Here is one week of a user's browser tab data:

{TAB_SUMMARY_JSON}

Write a 3-4 paragraph personal cognitive patterns report. Include:
1. Their attention honesty score (do they open tabs they never read?)
2. Their peak focus vs. distraction hours
3. Their top guilt domains (sites they open but rarely engage with)
4. One specific, actionable behavioral insight

Be warm, specific, and use exact numbers from the data. Avoid generic advice. 
Write as if you're a thoughtful analyst who genuinely finds their patterns interesting.
```

The `TAB_SUMMARY_JSON` should be a pre-aggregated object, not raw records. Aggregate it before sending:

```json
{
  "total_tabs_opened": 312,
  "avg_active_ratio": 0.08,
  "guilt_tab_count": 147,
  "top_domains": [
    { "domain": "twitter.com", "opens": 89, "avg_active_ratio": 0.04 },
    { "domain": "notion.so", "opens": 23, "avg_active_ratio": 0.61 }
  ],
  "peak_open_hour": 15,
  "peak_close_hour": 22,
  "avg_tabs_open_simultaneously": 14
}
```

---

## Chrome Extension Files Needed

```
tab-analyzer/
├── manifest.json          # Extension config (Manifest V3)
├── background.js          # Service worker — tab lifecycle tracking
├── content.js             # Injected per page — scroll depth
├── dashboard.html         # Main UI
├── dashboard.js           # Dashboard logic + Claude API call
├── dashboard.css          # Styles
└── icons/                 # 16, 48, 128px icons
```

### manifest.json permissions needed:
```json
{
  "permissions": ["tabs", "storage", "windows"],
  "host_permissions": ["<all_urls>"],
  "content_scripts": [{ "matches": ["<all_urls>"], "js": ["content.js"] }],
  "background": { "service_worker": "background.js" }
}
```

---

## Claude API Setup

- Model: `claude-sonnet-4-20250514`
- The API key will need to be entered by the user in an extension settings page
- Store API key in `chrome.storage.local` (never hardcode it)
- Call the API from `dashboard.js` when user clicks "Generate Weekly Report"

---

## Guilt Tab Cleaner

This is the most immediately useful feature. One click closes all the tabs you've already mentally abandoned.

### How It Works

1. User opens the dashboard
2. In the Guilt Tabs block, user clicks a trash can icon (🗑️) to open the Guilt Tab Cleaner UI
3. The UI shows a slider (default: 10%) to set the engagement threshold
4. Dashboard calls `chrome.tabs.query({})` to get all currently open tabs and cross-references each with stored `active_ratio` data
5. Live preview updates as slider moves: count of qualifying tabs and top domains
6. User hits **"Close All Guilt Tabs"** → `chrome.tabs.remove([...tabIds])` closes them all at once

### UI for This Feature

The Guilt Tabs block in the dashboard has a trash can icon (🗑️). Clicking it opens the Guilt Tab Cleaner UI:

```
┌─────────────────────────────────────────────┐
│  🗑️  Guilt Tab Cleaner                       │
│                                             │
│  Close tabs with less than [10%] engagement │
│  ←————————●——————————————→                  │
│                                             │
│  📊 82 tabs qualify (out of 200 open)       │
│  🌐 Top domains: twitter.com (34), reddit   │
│                                             │
│  [ 🗑️ Close All Guilt Tabs ]                │
└─────────────────────────────────────────────┘
```

### Important Notes

- `chrome.tabs.remove` only works on **currently open tabs** — not historical records
- The preview count and top domains list should update live as the slider moves

### Manifest Permissions
```json
"permissions": ["tabs", "storage", "windows"]
```

---

## Dashboard UI Requirements

- Clean, dark-mode-first design
- Show the `active_ratio` prominently — this is the hero metric
- "Guilt Tabs" section with a list of the worst offenders (long open, low engagement), with a 🗑️ trash can icon that opens the Guilt Tab Cleaner UI
- Simple bar chart for hourly open/close patterns (use Chart.js or plain canvas)
- Claude report displayed as a card with a "Regenerate" button
- Settings page: just an API key input field

---

## What "Done" Looks Like

1. Install extension in Chrome (unpacked)
2. Browse normally for a few days
3. Open dashboard, see real tab behavior data
4. Drag the slider → see exactly how many guilt tabs you have
5. Click 🗑️ in the Guilt Tabs block → drag slider → hit "Close All Guilt Tabs" → watch 100+ tabs vanish
6. Click "Generate Weekly Report" → Claude returns a personalized cognitive patterns summary
7. Screenshot the dashboard → post it

---
