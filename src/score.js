const gplay = require('google-play-scraper').default || require('google-play-scraper');
const store = require('app-store-scraper').default || require('app-store-scraper');
const { FOREIGN_MARKETS, FETCH_DEFAULTS, THROTTLE } = require('./config');
const { saveJson, safeSegment, timestamp } = require('./utils');
const { normalizeGplayApp, normalizeAppStoreApp } = require('./normalize');

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round1 = (n) => Number(n.toFixed(1));
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

// Map a count (reviews / installs) onto 0-10 on a log scale: `max` maps to 10.
function logScore(value, max) {
  if (!value || value <= 0) return 0;
  return clamp((Math.log10(value) / Math.log10(max)) * 10, 0, 10);
}

// PURE: estimate keyword difficulty (how hard to rank), traffic (how much
// demand), and a combined opportunity score from search results + autocomplete.
// These are transparent heuristics, not ground-truth ASO metrics — see README.
function computeScores({ keyword, apps, suggestions }) {
  const term = String(keyword).toLowerCase().trim();
  const top = apps.slice(0, 10);
  const n = top.length;

  // --- difficulty: how entrenched is the competition for this term ---
  const titleBroad = top.filter((a) => (a.title || '').toLowerCase().includes(term)).length;
  const titleExact = top.filter((a) => (a.title || '').toLowerCase() === term).length;
  const titleMatchScore = n ? clamp(((titleExact * 2 + titleBroad) / (n * 2)) * 10, 0, 10) : 0;

  const avgReviews = mean(top.map((a) => a.reviews || 0));
  const competitionScore = logScore(avgReviews, 1e6); // 1M avg reviews -> 10

  const difficulty = round1(mean([titleMatchScore, competitionScore]));

  // --- traffic: how much demand the term has ---
  const suggestList = suggestions || [];
  const suggestScore = clamp(suggestList.length, 0, 10); // more autocomplete variants -> more popular

  // installs (Google Play only); App Store has none, so fall back to reviews.
  const hasInstalls = top.some((a) => typeof a.installs === 'number');
  const avgInstalls = mean(top.map((a) => a.installs || 0));
  const demandScore = hasInstalls ? logScore(avgInstalls, 1e8) : competitionScore; // 100M installs -> 10

  const traffic = round1(mean([suggestScore, demandScore]));

  // --- opportunity: high traffic AND low difficulty ---
  const opportunity = round1((traffic * (10 - difficulty)) / 10);

  return {
    difficulty,
    traffic,
    opportunity,
    breakdown: {
      competitors: n,
      titleExact,
      titleBroad,
      titleMatchScore: round1(titleMatchScore),
      avgReviews: Math.round(avgReviews),
      competitionScore: round1(competitionScore),
      suggestions: suggestList.length,
      suggestScore: round1(suggestScore),
      avgInstalls: hasInstalls ? Math.round(avgInstalls) : null,
      demandScore: round1(demandScore),
    },
  };
}

async function fetchKeywordData(keyword, storeName, market, num) {
  if (storeName === 'appstore') {
    const raw = await store.search({ term: keyword, num, country: market.code, throttle: THROTTLE });
    const apps = raw.map((a) => normalizeAppStoreApp(a, market));
    const suggestions = (await store.suggest({ term: keyword })).map((s) => s.term);
    return { apps, suggestions };
  }
  const raw = await gplay.search({
    term: keyword, num, country: market.code, lang: market.lang, fullDetail: true, throttle: THROTTLE,
  });
  const apps = raw.map((a) => normalizeGplayApp(a, market));
  const suggestions = await gplay.suggest({ term: keyword, throttle: THROTTLE });
  return { apps, suggestions };
}

async function score(keyword, options = {}) {
  const storeName = options.store || 'gplay';
  const market = options.market || FOREIGN_MARKETS[0];
  const num = options.num || FETCH_DEFAULTS.compare;

  console.log(`\n=== Keyword opportunity: "${keyword}" (${storeName}, ${market.name}) ===`);

  let apps = [];
  let suggestions = [];
  try {
    ({ apps, suggestions } = await fetchKeywordData(keyword, storeName, market, num));
  } catch (err) {
    console.error(`  Error: ${err.message}`);
  }

  const scores = computeScores({ keyword, apps, suggestions });

  const report = {
    keyword,
    store: storeName,
    market: market.name,
    timestamp: new Date().toISOString(),
    ...scores,
  };

  const base = `score-${safeSegment(keyword)}-${safeSegment(market.code)}-${timestamp()}`;
  saveJson(`${base}.json`, report);

  printScore(report);
  return report;
}

function printScore(r) {
  const b = r.breakdown;
  console.log(`  Difficulty:  ${r.difficulty}/10  (lower = easier to rank)`);
  console.log(`  Traffic:     ${r.traffic}/10  (higher = more demand)`);
  console.log(`  Opportunity: ${r.opportunity}/10  (higher = better gap to target)`);
  console.log(`  Signals: ${b.competitors} top apps, ${b.titleBroad} with "${r.keyword}" in title, ` +
    `${b.avgReviews} avg reviews, ${b.suggestions} autocomplete suggestions`);
}

module.exports = { score, computeScores };
