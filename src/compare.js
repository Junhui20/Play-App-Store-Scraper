const gplay = require('google-play-scraper').default || require('google-play-scraper');
const store = require('app-store-scraper').default || require('app-store-scraper');
const { FOREIGN_MARKETS, LOCAL_MARKET, FETCH_DEFAULTS, RATE_LIMIT_MS, THROTTLE, UNDERSERVED_MULTIPLIER } = require('./config');
const { saveJson, safeSegment, delay, timestamp } = require('./utils');
const { normalizeGplayApp, normalizeAppStoreApp } = require('./normalize');
const { writeAppExports } = require('./export');

// Find apps that exist in a foreign market but are absent/unpopular locally.
async function compareMarkets(keywords, options = {}) {
  const foreignMarket = options.foreignMarket || FOREIGN_MARKETS[0]; // default: US
  const localMarket = options.localMarket || LOCAL_MARKET;
  const storeName = options.store || 'gplay';

  console.log(`\n=== Cross-Market Comparison ===`);
  console.log(`Foreign: ${foreignMarket.name} vs Local: ${localMarket.name}`);
  console.log(`Keywords: "${keywords}"\n`);

  // Foreign and local searches hit the same store/host, so they stay
  // sequential with a delay between them (parallelizing would raise ban risk).
  const foreignApps = storeName === 'appstore'
    ? await searchAppStore(keywords, foreignMarket, options)
    : await searchGooglePlay(keywords, foreignMarket, options);

  await delay(RATE_LIMIT_MS);

  const localApps = storeName === 'appstore'
    ? await searchAppStore(keywords, localMarket, options)
    : await searchGooglePlay(keywords, localMarket, options);

  const opportunities = findNotInLocal(foreignApps, localApps, foreignMarket, localMarket);
  const underserved = findUnderserved(foreignApps, localApps, foreignMarket, UNDERSERVED_MULTIPLIER);

  const report = {
    query: keywords,
    foreignMarket: foreignMarket.name,
    localMarket: localMarket.name,
    store: storeName,
    timestamp: new Date().toISOString(),
    summary: {
      foreignAppsFound: foreignApps.length,
      localAppsFound: localApps.length,
      notInLocalMarket: opportunities.length,
      underservedLocally: underserved.length,
    },
    opportunities,
    underserved,
    foreignApps,
    localApps,
  };

  const base = `compare-${safeSegment(keywords)}-${safeSegment(foreignMarket.code)}_vs_${safeSegment(localMarket.code)}-${timestamp()}`;
  saveJson(`${base}.json`, report);
  if (options.format) writeAppExports(base, opportunities, options.format);

  printComparisonSummary(report);
  return report;
}

// Foreign apps with no local match — by app id OR case-insensitive title.
function findNotInLocal(foreignApps, localApps, foreignMarket, localMarket) {
  const localAppIds = new Set(localApps.map((a) => a.appId));
  const localTitles = new Set(localApps.map((a) => a.title.toLowerCase()));

  return foreignApps
    .filter((app) => !(localAppIds.has(app.appId) || localTitles.has(app.title.toLowerCase())))
    .map((app) => ({
      ...app,
      opportunity: 'not_in_local_market',
      reason: `Available in ${foreignMarket.name} but not found in ${localMarket.name} search results`,
    }));
}

// Foreign apps that also exist locally (by app id) but have far more reviews
// abroad — i.e. demand the local market hasn't caught up to yet.
function findUnderserved(foreignApps, localApps, foreignMarket, multiplier) {
  const localAppMap = new Map(localApps.map((a) => [a.appId, a]));

  return foreignApps
    .filter((app) => localAppMap.has(app.appId))
    .map((app) => {
      const local = localAppMap.get(app.appId);
      return {
        ...app,
        localScore: local.score,
        localReviews: local.reviews,
        opportunity: 'underserved_locally',
        reason: `${app.reviews} reviews in ${foreignMarket.name} vs ${local.reviews} locally`,
      };
    })
    .filter((app) => app.reviews > (app.localReviews || 0) * multiplier);
}

async function searchGooglePlay(keywords, market, options = {}) {
  console.log(`[Google Play] Searching "${keywords}" in ${market.name}...`);

  try {
    const apps = await gplay.search({
      term: keywords,
      num: options.num || FETCH_DEFAULTS.compare,
      country: market.code,
      lang: market.lang,
      fullDetail: true,
      throttle: THROTTLE,
    });

    return apps.map((app) => normalizeGplayApp(app, market));
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    return [];
  }
}

async function searchAppStore(keywords, market, options = {}) {
  console.log(`[App Store] Searching "${keywords}" in ${market.name}...`);

  try {
    const apps = await store.search({
      term: keywords,
      num: options.num || FETCH_DEFAULTS.compare,
      country: market.code,
      throttle: THROTTLE,
    });

    return apps.map((app) => normalizeAppStoreApp(app, market));
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    return [];
  }
}

function printComparisonSummary(report) {
  console.log(`\n=== Comparison Results ===`);
  console.log(`${report.foreignMarket}: ${report.summary.foreignAppsFound} apps`);
  console.log(`${report.localMarket}: ${report.summary.localAppsFound} apps`);
  console.log(`\nOpportunities:`);
  console.log(`  Not in local market: ${report.summary.notInLocalMarket}`);
  console.log(`  Underserved locally: ${report.summary.underservedLocally}`);

  if (report.opportunities.length > 0) {
    console.log(`\nTop apps NOT in ${report.localMarket}:`);
    for (const app of report.opportunities.slice(0, 10)) {
      console.log(`  ${app.title} | ★${app.score} | ${app.installsFormatted || '?'} installs | ${app.category}`);
    }
  }
}

module.exports = { compareMarkets };
