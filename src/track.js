const gplay = require('google-play-scraper').default || require('google-play-scraper');
const store = require('app-store-scraper').default || require('app-store-scraper');
const { FOREIGN_MARKETS } = require('./config');
const { loadHistory, saveHistory, appendSnapshot, computeDelta, detectChanges } = require('./history');

// Fetch the current key metrics for an app (one lightweight detail request).
// The snapshot captures everything change-detection needs over time: rating,
// review count, install band and the published version.
async function fetchSnapshot(appId, storeName, market) {
  if (storeName === 'appstore') {
    const isNumericId = /^\d+$/.test(String(appId));
    const query = isNumericId
      ? { id: Number(appId), country: market.code }
      : { appId, country: market.code };
    const app = await store.app(query);
    return { date: new Date().toISOString(), title: app.title, score: app.score, reviews: app.reviews, installs: null, version: app.version || null };
  }
  const app = await gplay.app({ appId, country: market.code, lang: market.lang });
  return { date: new Date().toISOString(), title: app.title, score: app.score, reviews: app.reviews, installs: app.minInstalls, version: app.version || null };
}

const sign = (n) => (n > 0 ? `+${n}` : `${n}`);

// Record a snapshot of an app's metrics and report what changed since last time.
async function track(appId, options = {}) {
  const storeName = options.store || 'gplay';
  const market = options.market || FOREIGN_MARKETS[0];
  const key = `${storeName}:${appId}:${market.code}`;

  console.log(`\n=== Tracking ${appId} (${storeName}, ${market.name}) ===`);

  const snapshot = await fetchSnapshot(appId, storeName, market);

  const history = loadHistory();
  const series = history[key] || [];
  const previous = series[series.length - 1];
  const delta = computeDelta(previous, snapshot);
  const changes = detectChanges(previous, snapshot);

  saveHistory(appendSnapshot(history, key, snapshot));

  console.log(`${snapshot.title}${snapshot.version ? ` (v${snapshot.version})` : ''}`);
  console.log(`  ★${snapshot.score} | ${snapshot.reviews} reviews${snapshot.installs != null ? ` | ${snapshot.installs}+ installs` : ''}`);
  if (delta) {
    const installs = delta.installsDelta != null ? `, installs ${sign(delta.installsDelta)}` : '';
    console.log(`  Since last check (${delta.days}d ago): reviews ${sign(delta.reviewsDelta)}, rating ${sign(delta.scoreDelta)}${installs}`);
  } else {
    console.log(`  First snapshot recorded — run again later to see the trend.`);
  }
  if (changes.length) {
    console.log(`  Changes detected:`);
    for (const change of changes) console.log(`    • ${change.message}`);
  } else if (delta) {
    console.log(`  No notable changes since last snapshot.`);
  }
  console.log(`  History: ${series.length + 1} snapshot(s) recorded`);

  return { key, snapshot, previous: previous || null, delta, changes, snapshots: series.length + 1 };
}

module.exports = { track, fetchSnapshot };
