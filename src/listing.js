const gplay = require('google-play-scraper').default || require('google-play-scraper');
const store = require('app-store-scraper').default || require('app-store-scraper');
const { FOREIGN_MARKETS, DISCOVER_FILTERS, FETCH_DEFAULTS, THROTTLE } = require('./config');
const { saveJson, safeSegment, timestamp } = require('./utils');
const { normalizeGplayApp, normalizeAppStoreApp, passesNicheFilter } = require('./normalize');
const { writeAppExports } = require('./export');

// All Google Play categories
const GPLAY_CATEGORIES = gplay.category;
const GPLAY_COLLECTIONS = gplay.collection;

// All App Store collections & categories
const APPSTORE_COLLECTIONS = store.collection;
const APPSTORE_CATEGORIES = store.category;

// List apps from Google Play by collection + category
async function listGooglePlay(options = {}) {
  const collection = options.collection || 'TOP_FREE';
  const category = options.category || undefined;
  const market = options.market || FOREIGN_MARKETS[0];
  const num = options.num || FETCH_DEFAULTS.listGooglePlay;

  const collectionVal = GPLAY_COLLECTIONS[collection] || collection;
  const categoryVal = category ? (GPLAY_CATEGORIES[category] || category) : undefined;

  console.log(`\n[Google Play] Listing ${collection}${category ? ` / ${category}` : ''} in ${market.name}...`);

  try {
    const apps = await gplay.list({
      collection: collectionVal,
      category: categoryVal,
      country: market.code,
      lang: market.lang,
      num,
      fullDetail: true,
      throttle: THROTTLE,
    });

    return apps.map((app) => normalizeGplayApp(app, market));
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    return [];
  }
}

// List apps from App Store by collection + category
async function listAppStore(options = {}) {
  const collection = options.collection || 'TOP_FREE_IOS';
  const category = options.category || undefined;
  const market = options.market || FOREIGN_MARKETS[0];
  const num = options.num || FETCH_DEFAULTS.listAppStore;

  const collectionVal = APPSTORE_COLLECTIONS[collection] || collection;
  const categoryVal = category ? (APPSTORE_CATEGORIES[category] || category) : undefined;

  console.log(`\n[App Store] Listing ${collection}${category ? ` / ${category}` : ''} in ${market.name}...`);

  try {
    const apps = await store.list({
      collection: collectionVal,
      category: categoryVal,
      country: market.code,
      num,
      throttle: THROTTLE,
    });

    return apps.map((app) => normalizeAppStoreApp(app, market));
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    return [];
  }
}

// Main list function
async function list(options = {}) {
  const storeName = options.store || 'both';
  const collection = options.collection || 'TOP_FREE';
  const category = options.category || undefined;
  const market = options.market || FOREIGN_MARKETS[0];
  const filterNiche = options.niche || false;
  const filters = { ...DISCOVER_FILTERS, ...options.filters };

  console.log(`\n=== Listing: ${collection}${category ? ` / ${category}` : ''} ===`);
  console.log(`Market: ${market.name}${filterNiche ? ' | Niche filter ON' : ''}`);

  // The two stores hit different hosts, so fetch them concurrently.
  const [gplayApps, appStoreApps] = await Promise.all([
    (storeName === 'both' || storeName === 'gplay')
      ? listGooglePlay({ collection, category, market, num: options.num })
      : Promise.resolve([]),
    (storeName === 'both' || storeName === 'appstore')
      ? listAppStore({
          collection: mapToAppStoreCollection(collection),
          category,
          market,
          num: options.num,
        })
      : Promise.resolve([]),
  ]);

  let allApps = [...gplayApps, ...appStoreApps];

  // Apply niche filter if requested
  if (filterNiche) {
    allApps = allApps.filter((app) => passesNicheFilter(app, filters));
  }

  const report = {
    collection,
    category: category || 'all',
    market: market.name,
    store: storeName,
    nicheFilter: filterNiche,
    timestamp: new Date().toISOString(),
    totalFound: allApps.length,
    apps: allApps,
  };

  const catSuffix = category ? `_${safeSegment(category)}` : '';
  const base = `list-${safeSegment(collection)}${catSuffix}-${safeSegment(market.code)}-${timestamp()}`;
  saveJson(`${base}.json`, report);
  if (options.format) writeAppExports(base, allApps, options.format);

  console.log(`\nTotal: ${allApps.length} apps`);
  printListResults(allApps);

  return report;
}

// Map Google Play collection names to App Store equivalents
function mapToAppStoreCollection(gplayCollection) {
  const mapping = {
    TOP_FREE: 'TOP_FREE_IOS',
    TOP_PAID: 'TOP_PAID_IOS',
    GROSSING: 'TOP_GROSSING_IOS',
    NEW_FREE: 'NEW_FREE_IOS',
    NEW_PAID: 'NEW_PAID_IOS',
    NEW: 'NEW_IOS',
  };
  return mapping[gplayCollection] || gplayCollection;
}

function printListResults(apps) {
  const top = apps.slice(0, 20);
  for (let i = 0; i < top.length; i++) {
    const app = top[i];
    const installs = app.installsFormatted ? ` | ${app.installsFormatted} installs` : '';
    console.log(
      `  ${i + 1}. [${app.store}] ${app.title} | ★${app.score || '?'}${installs} | ${app.category || '?'}`
    );
  }
  if (apps.length > 20) {
    console.log(`  ... and ${apps.length - 20} more (see JSON file)`);
  }
}

// Print available options for reference
function printOptions() {
  console.log('\n=== Available Collections ===');
  console.log('\nGoogle Play:');
  for (const k of Object.keys(GPLAY_COLLECTIONS)) {
    console.log(`  ${k}`);
  }
  console.log('\nApp Store:');
  for (const k of Object.keys(APPSTORE_COLLECTIONS)) {
    console.log(`  ${k}`);
  }

  console.log('\n=== Available Categories ===');
  console.log('\nGoogle Play:');
  for (const k of Object.keys(GPLAY_CATEGORIES)) {
    console.log(`  ${k}`);
  }
  console.log('\nApp Store:');
  for (const k of Object.keys(APPSTORE_CATEGORIES)) {
    console.log(`  ${k}`);
  }
}

module.exports = { list, listGooglePlay, listAppStore, printOptions };
