const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Defaults. Any of these can be overridden by an optional config file (see
// loadOverrides below) and a few by CLI flags. Edit here for permanent changes.
// ---------------------------------------------------------------------------

// Markets to scan for cross-market opportunity discovery
const DEFAULT_FOREIGN_MARKETS = [
  { code: 'us', name: 'United States', lang: 'en' },
  { code: 'gb', name: 'United Kingdom', lang: 'en' },
  { code: 'jp', name: 'Japan', lang: 'ja' },
  { code: 'kr', name: 'South Korea', lang: 'ko' },
  { code: 'de', name: 'Germany', lang: 'de' },
  { code: 'au', name: 'Australia', lang: 'en' },
  { code: 'ca', name: 'Canada', lang: 'en' },
  { code: 'in', name: 'India', lang: 'en' },
];

// Your local market - change this to your region (or set it in the config file)
const DEFAULT_LOCAL_MARKET = { code: 'my', name: 'Malaysia', lang: 'en' };

// Filtering thresholds for "niche gem" discovery
const DEFAULT_DISCOVER_FILTERS = {
  maxInstalls: 100000,      // Max installs to count as "niche"
  minScore: 4.0,            // Min rating
  minReviews: 10,           // At least some reviews to validate quality
  maxReviews: 5000,         // Not too many = still niche
};

// Review analysis settings
const DEFAULT_REVIEW_SETTINGS = {
  numReviews: 500,          // Reviews to fetch per app
  lowRatingMax: 3,          // 1-3 stars = negative
  highRatingMin: 4,         // 4-5 stars = positive
};

// Default number of apps to fetch, per command.
const DEFAULT_FETCH_DEFAULTS = {
  discover: 50,
  compare: 30,
  listGooglePlay: 60,
  listAppStore: 50,
};

// Pain-point severity tiers, by number of negative-review mentions.
const DEFAULT_SEVERITY = {
  minMentions: 2,           // ignore issues mentioned fewer than this many times
  medium: 5,                // >= this many mentions => "medium"
  high: 10,                 // >= this many mentions => "high"
};

// ---------------------------------------------------------------------------
// Optional config file. Looks at $APP_SCOUT_CONFIG, otherwise
// ./app-scout.config.json in the current working directory. Keys are camelCase
// (see app-scout.config.example.json). Anything omitted keeps its default, so
// partial overrides are fine.
// ---------------------------------------------------------------------------
function loadOverrides() {
  const candidate = process.env.APP_SCOUT_CONFIG
    || path.join(process.cwd(), 'app-scout.config.json');
  try {
    if (fs.existsSync(candidate)) {
      return JSON.parse(fs.readFileSync(candidate, 'utf-8'));
    }
  } catch (err) {
    console.error(`Warning: ignoring config file ${candidate}: ${err.message}`);
  }
  return {};
}

const overrides = loadOverrides();

// ---- effective config (defaults merged with any file overrides) ----
const FOREIGN_MARKETS = overrides.foreignMarkets || DEFAULT_FOREIGN_MARKETS;
const LOCAL_MARKET = { ...DEFAULT_LOCAL_MARKET, ...overrides.localMarket };
const DISCOVER_FILTERS = { ...DEFAULT_DISCOVER_FILTERS, ...overrides.discoverFilters };
const REVIEW_SETTINGS = { ...DEFAULT_REVIEW_SETTINGS, ...overrides.reviewSettings };
const FETCH_DEFAULTS = { ...DEFAULT_FETCH_DEFAULTS, ...overrides.fetchDefaults };
const SEVERITY = { ...DEFAULT_SEVERITY, ...overrides.severity };
const DESCRIPTION_MAX = overrides.descriptionMax ?? 300;
const UNDERSERVED_MULTIPLIER = overrides.underservedMultiplier ?? 3;
const RATE_LIMIT_MS = overrides.rateLimitMs ?? 1500;   // delay between per-market calls (ms)
const THROTTLE = overrides.throttle ?? 5;              // max scraper requests per second

module.exports = {
  FOREIGN_MARKETS,
  LOCAL_MARKET,
  DISCOVER_FILTERS,
  REVIEW_SETTINGS,
  FETCH_DEFAULTS,
  DESCRIPTION_MAX,
  SEVERITY,
  UNDERSERVED_MULTIPLIER,
  RATE_LIMIT_MS,
  THROTTLE,
};
