const gplay = require('google-play-scraper').default || require('google-play-scraper');
const store = require('app-store-scraper').default || require('app-store-scraper');
const { FOREIGN_MARKETS, DISCOVER_FILTERS, FETCH_DEFAULTS, RATE_LIMIT_MS, THROTTLE } = require('./config');
const { saveJson, safeSegment, delay, timestamp } = require('./utils');
const { normalizeGplayApp, normalizeAppStoreApp, passesNicheFilter } = require('./normalize');
const { writeAppExports } = require('./export');

// Search Google Play in each market and keep the niche gems.
async function discoverGooglePlay(keywords, options = {}) {
  const markets = options.markets || FOREIGN_MARKETS;
  const filters = { ...DISCOVER_FILTERS, ...options.filters };
  const results = [];

  for (const market of markets) {
    console.log(`\n[Google Play] Searching "${keywords}" in ${market.name}...`);

    try {
      const apps = await gplay.search({
        term: keywords,
        num: options.num || FETCH_DEFAULTS.discover,
        country: market.code,
        lang: market.lang,
        fullDetail: true,
        throttle: THROTTLE,
      });

      const matched = apps
        .map((app) => normalizeGplayApp(app, market))
        .filter((app) => passesNicheFilter(app, filters));

      results.push(...matched);
      console.log(`  Found ${apps.length} apps, ${matched.length} match niche criteria`);
    } catch (err) {
      console.error(`  Error in ${market.name}: ${err.message}`);
    }

    await delay(RATE_LIMIT_MS);
  }

  // Sort by score descending, then by review count descending
  results.sort((a, b) => b.score - a.score || b.reviews - a.reviews);
  return results;
}

// Search the App Store in each market and keep the niche gems.
async function discoverAppStore(keywords, options = {}) {
  const markets = options.markets || FOREIGN_MARKETS;
  const filters = { ...DISCOVER_FILTERS, ...options.filters };
  const results = [];

  for (const market of markets) {
    console.log(`\n[App Store] Searching "${keywords}" in ${market.name}...`);

    try {
      // App Store search already returns score/reviews via the batched iTunes
      // lookup, so we filter the results directly rather than re-fetching every
      // app with store.app() (which was ~20 redundant requests per market).
      const apps = await store.search({
        term: keywords,
        num: options.num || FETCH_DEFAULTS.discover,
        country: market.code,
        lang: market.lang,
        throttle: THROTTLE,
      });

      const matched = apps
        .map((app) => normalizeAppStoreApp(app, market))
        .filter((app) => passesNicheFilter(app, filters));

      results.push(...matched);
      console.log(`  Found ${apps.length} apps, ${matched.length} match niche criteria`);
    } catch (err) {
      console.error(`  Error in ${market.name}: ${err.message}`);
    }

    await delay(RATE_LIMIT_MS);
  }

  results.sort((a, b) => b.score - a.score || b.reviews - a.reviews);
  return results;
}

// Main discover function - searches both stores.
async function discover(keywords, options = {}) {
  console.log(`\n=== Discovering niche apps for: "${keywords}" ===`);
  console.log(`Filters: installs <= ${DISCOVER_FILTERS.maxInstalls}, score >= ${DISCOVER_FILTERS.minScore}`);

  const storeFilter = options.store || 'both';

  // The two stores hit different hosts (Google vs Apple), so run concurrently.
  const [gplayResults, appStoreResults] = await Promise.all([
    (storeFilter === 'both' || storeFilter === 'gplay')
      ? discoverGooglePlay(keywords, options)
      : Promise.resolve([]),
    (storeFilter === 'both' || storeFilter === 'appstore')
      ? discoverAppStore(keywords, options)
      : Promise.resolve([]),
  ]);

  const allResults = [...gplayResults, ...appStoreResults];

  const report = {
    query: keywords,
    filters: DISCOVER_FILTERS,
    markets: (options.markets || FOREIGN_MARKETS).map((m) => m.name),
    timestamp: new Date().toISOString(),
    totalFound: allResults.length,
    googlePlay: gplayResults.length,
    appStore: appStoreResults.length,
    apps: allResults,
  };

  const base = `discover-${safeSegment(keywords)}-${timestamp()}`;
  saveJson(`${base}.json`, report);
  if (options.format) writeAppExports(base, allResults, options.format);

  console.log(`\n=== Results: ${allResults.length} niche apps found ===`);
  printTopResults(allResults);

  return report;
}

function printTopResults(apps) {
  const top = apps.slice(0, 15);
  for (const app of top) {
    console.log(
      `  [${app.store}] ${app.title} | ${app.market} | ★${app.score} | ${app.installsFormatted || '?'} installs | ${app.reviews} reviews`
    );
  }
}

module.exports = { discover, discoverGooglePlay, discoverAppStore };
