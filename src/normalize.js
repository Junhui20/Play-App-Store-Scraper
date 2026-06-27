// Single source of truth for turning a raw store result into the shape this
// tool saves and prints. Previously this mapping was hand-copied (and had
// drifted) across discover/compare/listing — keep it here so the schema and
// the "niche" filter are defined exactly once.
const { DESCRIPTION_MAX } = require('./config');
const { formatNumber } = require('./utils');

// Normalize a Google Play app (from search/list, with fullDetail).
function normalizeGplayApp(app, market) {
  return {
    store: 'google-play',
    market: market.name,
    marketCode: market.code,
    appId: app.appId,
    title: app.title,
    developer: app.developer,
    score: app.score,
    reviews: app.reviews,
    installs: app.minInstalls,
    installsFormatted: formatNumber(app.minInstalls || 0),
    free: app.free,
    price: app.price,
    category: app.genre,
    description: (app.summary || app.description || '').slice(0, DESCRIPTION_MAX),
    url: app.url,
    updated: app.updated,
    released: app.released,
  };
}

// Normalize an App Store app (from search/list — both return rating fields).
function normalizeAppStoreApp(app, market) {
  return {
    store: 'app-store',
    market: market.name,
    marketCode: market.code,
    appId: app.appId,
    trackId: app.id,
    title: app.title,
    developer: app.developer,
    score: app.score,
    reviews: app.reviews,
    free: app.free,
    price: app.price,
    category: app.primaryGenre,
    description: (app.description || '').slice(0, DESCRIPTION_MAX),
    url: app.url,
    updated: app.updated,
    released: app.released,
  };
}

// Single "niche gem" predicate, applied consistently to normalized apps from
// either store. App Store apps have no install count, so `installs` defaults to
// 0 and the maxInstalls bound is a no-op for them.
function passesNicheFilter(app, filters) {
  const installs = app.installs || 0;
  const score = app.score || 0;
  const reviews = app.reviews || 0;
  return (
    installs <= filters.maxInstalls &&
    score >= filters.minScore &&
    reviews >= filters.minReviews &&
    reviews <= filters.maxReviews
  );
}

module.exports = {
  normalizeGplayApp,
  normalizeAppStoreApp,
  passesNicheFilter,
};
