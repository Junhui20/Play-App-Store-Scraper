const gplay = require('google-play-scraper').default || require('google-play-scraper');
const store = require('app-store-scraper').default || require('app-store-scraper');
const { THROTTLE } = require('./config');
const { saveJson, safeSegment, timestamp } = require('./utils');

// Expand a seed keyword into store autocomplete suggestions — a cheap way to
// find more terms to feed `discover` / `compare`.
async function suggestGooglePlay(term) {
  // gplay.suggest returns an array of suggestion strings.
  return gplay.suggest({ term, throttle: THROTTLE });
}

async function suggestAppStore(term) {
  // store.suggest returns an array of { term } objects.
  const results = await store.suggest({ term });
  return results.map((s) => s.term);
}

async function suggest(term, options = {}) {
  const storeName = options.store || 'both';
  console.log(`\n=== Keyword suggestions for "${term}" (${storeName}) ===`);

  const suggestions = {};
  if (storeName === 'both' || storeName === 'gplay') {
    try {
      suggestions.googlePlay = await suggestGooglePlay(term);
    } catch (err) {
      console.error(`  [Google Play] Error: ${err.message}`);
      suggestions.googlePlay = [];
    }
  }
  if (storeName === 'both' || storeName === 'appstore') {
    try {
      suggestions.appStore = await suggestAppStore(term);
    } catch (err) {
      console.error(`  [App Store] Error: ${err.message}`);
      suggestions.appStore = [];
    }
  }

  // Merged, de-duplicated keyword list for convenience.
  const merged = Array.from(new Set([
    ...(suggestions.googlePlay || []),
    ...(suggestions.appStore || []),
  ]));

  const report = {
    term,
    store: storeName,
    timestamp: new Date().toISOString(),
    totalSuggestions: merged.length,
    suggestions,
    merged,
  };

  const base = `suggest-${safeSegment(term)}-${timestamp()}`;
  saveJson(`${base}.json`, report);

  console.log(`\n${merged.length} suggestions:`);
  for (const s of merged) console.log(`  - ${s}`);

  return report;
}

module.exports = { suggest, suggestGooglePlay, suggestAppStore };
