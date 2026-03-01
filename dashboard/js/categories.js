// categories.js — Domain category definitions and lookup logic

// ── Category definitions ──────────────────────────────────────────────────────
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

// Domain → category lookup map, built once from CATEGORY_DOMAINS
const DOMAIN_CATEGORY_MAP = Object.fromEntries(
  CATEGORY_DOMAINS.flatMap(({ category, domains }) =>
    domains.map(domain => [domain, category])
  )
);

// ── Lookup function ───────────────────────────────────────────────────────────
function categorizeDomain(domain) {
  if (!domain || typeof domain !== "string") return CAT.OTHER;
  const normalized = domain.startsWith("www.") ? domain.slice(4) : domain;

  if (DOMAIN_CATEGORY_MAP[normalized]) return DOMAIN_CATEGORY_MAP[normalized];

  for (const [pattern, category] of CATEGORY_KEYWORD_PATTERNS) {
    if (pattern.test(normalized)) return category;
  }

  if (normalized.endsWith(".edu")) return CAT.LEARNING;
  if (normalized.endsWith(".gov")) return CAT.GOVERNMENT;

  return CAT.OTHER;
}
