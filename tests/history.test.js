const os = require('os');
const fs = require('fs');
const path = require('path');
const { appendSnapshot, computeDelta, detectChanges, loadHistory, saveHistory } = require('../src/history');

describe('appendSnapshot', () => {
  test('appends to a new key', () => {
    const h = appendSnapshot({}, 'k', { reviews: 1 });
    expect(h.k).toEqual([{ reviews: 1 }]);
  });

  test('appends to an existing series without mutating the input', () => {
    const orig = { k: [{ reviews: 1 }] };
    const h = appendSnapshot(orig, 'k', { reviews: 2 });
    expect(h.k).toHaveLength(2);
    expect(orig.k).toHaveLength(1); // original untouched
  });
});

describe('computeDelta', () => {
  test('returns null without a previous snapshot', () => {
    expect(computeDelta(undefined, { reviews: 5 })).toBeNull();
  });

  test('computes review/score/install deltas and the day gap', () => {
    const prev = { date: '2026-06-01T00:00:00.000Z', score: 4.2, reviews: 1500, installs: 50000 };
    const cur = { date: '2026-06-11T00:00:00.000Z', score: 4.5, reviews: 1700, installs: 60000 };
    const d = computeDelta(prev, cur);
    expect(d.days).toBe(10);
    expect(d.reviewsDelta).toBe(200);
    expect(d.scoreDelta).toBe(0.3);
    expect(d.installsDelta).toBe(10000);
  });

  test('null fields when a metric is missing', () => {
    const d = computeDelta(
      { date: '2026-06-01T00:00:00.000Z' },
      { date: '2026-06-02T00:00:00.000Z', reviews: 5 }
    );
    expect(d.reviewsDelta).toBeNull();
    expect(d.installsDelta).toBeNull();
    expect(d.days).toBe(1);
  });
});

describe('detectChanges', () => {
  test('returns [] without a previous snapshot', () => {
    expect(detectChanges(undefined, { score: 4.5 })).toEqual([]);
  });

  test('returns [] when nothing notable changed', () => {
    const snap = { score: 4.2, reviews: 1500, installs: 50000, version: '1.0.0' };
    expect(detectChanges(snap, { ...snap })).toEqual([]);
  });

  test('flags a new version release', () => {
    const changes = detectChanges(
      { score: 4.2, reviews: 1500, installs: 50000, version: '1.0.0' },
      { score: 4.2, reviews: 1500, installs: 50000, version: '1.1.0' }
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('version');
    expect(changes[0].message).toContain('1.0.0 → 1.1.0');
  });

  test('flags a rating move with direction', () => {
    const [change] = detectChanges(
      { score: 4.2, reviews: 1500, installs: 50000 },
      { score: 4.5, reviews: 1500, installs: 50000 }
    );
    expect(change.type).toBe('rating');
    expect(change.message).toContain('up +0.3');
    expect(change.message).toContain('(4.2 → 4.5)');
  });

  test('flags an install-band change using store band labels', () => {
    const [change] = detectChanges(
      { score: 4.2, reviews: 1500, installs: 50000 },
      { score: 4.2, reviews: 1500, installs: 100000 }
    );
    expect(change.type).toBe('installs');
    expect(change.message).toBe('Install band changed: 50.0K+ → 100.0K+');
  });

  test('flags a review-count change and detects several changes at once', () => {
    const changes = detectChanges(
      { score: 4.2, reviews: 1500, installs: 50000, version: '1.0.0' },
      { score: 4.5, reviews: 1600, installs: 100000, version: '1.1.0' }
    );
    expect(changes.map((c) => c.type)).toEqual(['version', 'rating', 'installs', 'reviews']);
    expect(changes.find((c) => c.type === 'reviews').message).toContain('+100');
  });
});

describe('loadHistory / saveHistory', () => {
  test('round-trips through a file', () => {
    const file = path.join(os.tmpdir(), `hist-${process.pid}-${Date.now()}.json`);
    saveHistory({ a: [{ reviews: 1 }] }, file);
    expect(loadHistory(file)).toEqual({ a: [{ reviews: 1 }] });
    fs.unlinkSync(file);
  });

  test('returns {} when the file is absent', () => {
    expect(loadHistory(path.join(os.tmpdir(), 'app-scout-no-such-history.json'))).toEqual({});
  });
});
