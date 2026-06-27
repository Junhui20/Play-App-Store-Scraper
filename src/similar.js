const gplay = require('google-play-scraper').default || require('google-play-scraper');
const store = require('app-store-scraper').default || require('app-store-scraper');
const { FOREIGN_MARKETS, FETCH_DEFAULTS, THROTTLE } = require('./config');
const { saveJson, safeSegment, timestamp } = require('./utils');
const { normalizeGplayApp, normalizeAppStoreApp } = require('./normalize');
const { writeAppExports } = require('./export');

// "Customers also viewed / similar apps" for a seed app — a fast way to build a
// competitor set without hunting for app IDs by hand.
async function similarGooglePlay(appId, market, num) {
  const apps = await gplay.similar({
    appId,
    country: market.code,
    lang: market.lang,
    fullDetail: true,
    throttle: THROTTLE,
  });
  return apps.slice(0, num).map((app) => normalizeGplayApp(app, market));
}

async function similarAppStore(appId, market, num) {
  // store.similar needs a numeric track id; resolve a bundle id first.
  let id = appId;
  if (!/^\d+$/.test(String(appId))) {
    const app = await store.app({ appId, country: market.code });
    id = app.id;
  }
  const apps = await store.similar({ id: Number(id), country: market.code });
  return apps.slice(0, num).map((app) => normalizeAppStoreApp(app, market));
}

async function similar(appId, options = {}) {
  const storeName = options.store || 'gplay';
  const market = options.market || FOREIGN_MARKETS[0];
  const num = options.num || FETCH_DEFAULTS.discover;

  console.log(`\n=== Apps similar to ${appId} (${storeName}, ${market.name}) ===`);

  let apps = [];
  try {
    apps = storeName === 'appstore'
      ? await similarAppStore(appId, market, num)
      : await similarGooglePlay(appId, market, num);
  } catch (err) {
    console.error(`  Error: ${err.message}`);
  }

  apps.sort((a, b) => (b.score || 0) - (a.score || 0));

  const report = {
    seed: appId,
    store: storeName,
    market: market.name,
    timestamp: new Date().toISOString(),
    totalFound: apps.length,
    apps,
  };

  const base = `similar-${safeSegment(appId)}-${safeSegment(market.code)}-${timestamp()}`;
  saveJson(`${base}.json`, report);
  if (options.format) writeAppExports(base, apps, options.format);

  console.log(`\nFound ${apps.length} similar apps:`);
  for (const app of apps.slice(0, 15)) {
    console.log(`  [${app.store}] ${app.title} | ★${app.score || '?'} | ${app.installsFormatted || '?'} installs | ${app.category || '?'}`);
  }

  return report;
}

module.exports = { similar, similarGooglePlay, similarAppStore };
