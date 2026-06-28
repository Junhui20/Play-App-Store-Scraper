const fs = require('fs');
const path = require('path');

// Where the per-app metric history lives. Kept out of output/ (which is meant to
// be wiped/regenerated) so trend data survives. Overridable for tests.
const HISTORY_FILE = process.env.APP_SCOUT_HISTORY
  || path.join(__dirname, '..', '.app-scout-history.json');

function loadHistory(file = HISTORY_FILE) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    console.error(`Warning: could not read history ${file}: ${err.message}`);
  }
  return {};
}

function saveHistory(history, file = HISTORY_FILE) {
  fs.writeFileSync(file, JSON.stringify(history, null, 2), 'utf-8');
  return file;
}

// PURE: append a snapshot to the series for `key`, returning a new history object
// (does not mutate the input).
function appendSnapshot(history, key, snapshot) {
  const series = history[key] ? [...history[key]] : [];
  series.push(snapshot);
  return { ...history, [key]: series };
}

// PURE: the change between a previous snapshot and the current one. Returns null
// when there is no previous snapshot, and null fields when a metric is missing.
function computeDelta(previous, current) {
  if (!previous) return null;
  const numDiff = (a, b) =>
    (typeof a === 'number' && typeof b === 'number' ? a - b : null);
  const days = previous.date && current.date
    ? Math.round((new Date(current.date) - new Date(previous.date)) / 86400000)
    : null;
  const scoreDelta = typeof current.score === 'number' && typeof previous.score === 'number'
    ? Number((current.score - previous.score).toFixed(3))
    : null;
  return {
    since: previous.date,
    days,
    reviewsDelta: numDiff(current.reviews, previous.reviews),
    scoreDelta,
    installsDelta: numDiff(current.installs, previous.installs),
  };
}

module.exports = { HISTORY_FILE, loadHistory, saveHistory, appendSnapshot, computeDelta };
