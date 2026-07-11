const fs = require('fs');
const path = require('path');
const { formatNumber } = require('./utils');

const sign = (n) => (n > 0 ? `+${n}` : `${n}`);

// Format a Google Play install count as its store "band" label (e.g. 50K+).
function installBand(installs) {
  return typeof installs === 'number' ? `${formatNumber(installs)}+` : null;
}

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

// PURE: turn the change between two snapshots into a list of discrete, human-
// readable events — the signal a monitoring subscriber actually cares about
// (a new release, a rating move, an install-band jump), rather than raw numbers.
// Returns [] when there is no previous snapshot or nothing changed.
function detectChanges(previous, current) {
  if (!previous) return [];
  const changes = [];

  if (previous.version && current.version && previous.version !== current.version) {
    changes.push({
      type: 'version',
      message: `New version released: ${previous.version} → ${current.version}`,
    });
  }

  if (typeof previous.score === 'number' && typeof current.score === 'number') {
    const diff = Number((current.score - previous.score).toFixed(3));
    if (diff !== 0) {
      changes.push({
        type: 'rating',
        message: `Rating ${diff > 0 ? 'up' : 'down'} ${sign(diff)} (${previous.score} → ${current.score})`,
      });
    }
  }

  if (
    typeof previous.installs === 'number' && typeof current.installs === 'number'
    && previous.installs !== current.installs
  ) {
    changes.push({
      type: 'installs',
      message: `Install band changed: ${installBand(previous.installs)} → ${installBand(current.installs)}`,
    });
  }

  if (
    typeof previous.reviews === 'number' && typeof current.reviews === 'number'
    && previous.reviews !== current.reviews
  ) {
    changes.push({
      type: 'reviews',
      message: `Review count ${sign(current.reviews - previous.reviews)} (${previous.reviews} → ${current.reviews})`,
    });
  }

  return changes;
}

module.exports = {
  HISTORY_FILE,
  loadHistory,
  saveHistory,
  appendSnapshot,
  computeDelta,
  detectChanges,
  installBand,
};
