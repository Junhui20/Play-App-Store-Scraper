const os = require('os');
const fs = require('fs');
const path = require('path');
const { appendSnapshot, computeDelta, loadHistory, saveHistory } = require('../src/history');

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
