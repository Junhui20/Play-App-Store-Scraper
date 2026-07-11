const { mockGplayAppDetail } = require('./mocks');

jest.mock('google-play-scraper', () => ({
  __esModule: true,
  default: { app: jest.fn() },
}));

jest.mock('app-store-scraper', () => ({ app: jest.fn() }));

// Keep the pure helpers real; stub only the file I/O.
jest.mock('../src/history', () => {
  const actual = jest.requireActual('../src/history');
  return { ...actual, loadHistory: jest.fn(), saveHistory: jest.fn() };
});

const gplay = require('google-play-scraper').default;
const history = require('../src/history');
const { track } = require('../src/track');

const US_MARKET = { code: 'us', name: 'United States', lang: 'en' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('track', () => {
  test('records a first snapshot with no delta and persists it', async () => {
    gplay.app.mockResolvedValue(mockGplayAppDetail);
    history.loadHistory.mockReturnValue({});

    const result = await track('com.test.app', { market: US_MARKET });

    expect(result.delta).toBeNull();
    expect(result.snapshots).toBe(1);
    expect(history.saveHistory).toHaveBeenCalledTimes(1);
    const saved = history.saveHistory.mock.calls[0][0];
    expect(saved['gplay:com.test.app:us']).toHaveLength(1);
  });

  test('computes deltas against the previous snapshot', async () => {
    gplay.app.mockResolvedValue({ ...mockGplayAppDetail, score: 4.4, reviews: 1600, minInstalls: 60000 });
    history.loadHistory.mockReturnValue({
      'gplay:com.test.app:us': [
        { date: '2026-06-01T00:00:00.000Z', score: 4.2, reviews: 1500, installs: 50000 },
      ],
    });

    const result = await track('com.test.app', { market: US_MARKET });

    expect(result.delta.reviewsDelta).toBe(100);
    expect(result.delta.scoreDelta).toBeCloseTo(0.2, 5);
    expect(result.delta.installsDelta).toBe(10000);
    expect(result.snapshots).toBe(2);
  });

  test('captures the app version in each snapshot', async () => {
    gplay.app.mockResolvedValue({ ...mockGplayAppDetail, version: '2.3.1' });
    history.loadHistory.mockReturnValue({});

    const result = await track('com.test.app', { market: US_MARKET });

    expect(result.snapshot.version).toBe('2.3.1');
    const saved = history.saveHistory.mock.calls[0][0];
    expect(saved['gplay:com.test.app:us'][0].version).toBe('2.3.1');
  });

  test('reports discrete changes (new version + rating move) vs the previous snapshot', async () => {
    gplay.app.mockResolvedValue({ ...mockGplayAppDetail, score: 4.5, version: '1.1.0' });
    history.loadHistory.mockReturnValue({
      'gplay:com.test.app:us': [
        { date: '2026-06-01T00:00:00.000Z', score: 4.2, reviews: 1500, installs: 50000, version: '1.0.0' },
      ],
    });

    const result = await track('com.test.app', { market: US_MARKET });

    const types = result.changes.map((c) => c.type);
    expect(types).toContain('version');
    expect(types).toContain('rating');
  });

  test('reports no changes for a first snapshot', async () => {
    gplay.app.mockResolvedValue(mockGplayAppDetail);
    history.loadHistory.mockReturnValue({});

    const result = await track('com.test.app', { market: US_MARKET });

    expect(result.changes).toEqual([]);
  });
});
