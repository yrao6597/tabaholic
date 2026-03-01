// constants.js — Shared constants for Tab Analyzer

// ── Time / threshold constants ────────────────────────────────────────────────
const SEVEN_DAYS_MS      = 7 * 24 * 60 * 60 * 1000;
const GUILT_MIN_TOTAL_MS = 5 * 60 * 1000;   // tab must be open at least 5 min
const GUILT_MAX_RATIO    = 0.10;             // active ratio must be under 10%

// ── Claude API ────────────────────────────────────────────────────────────────
const CLAUDE_MODEL   = "claude-sonnet-4-20250514";
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
