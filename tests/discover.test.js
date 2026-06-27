const { mockGplayApps, mockAppStoreApps } = require('./mocks');

// Mock both scrapers
jest.mock('google-play-scraper', () => ({
  __esModule: true,
  default: {
    search: jest.fn(),
    sort: { RATING: 'RATING', NEWEST: 'NEWEST' },
    collection: { TOP_FREE: 'TOP_FREE' },
    category: { PRODUCTIVITY: 'PRODUCTIVITY' },
  },
}));

jest.mock('app-store-scraper', () => ({
  search: jest.fn(),
  app: jest.fn(),
  sort: { RECENT: 'RECENT' },
  collection: { TOP_FREE_IOS: 'topfreeapplications' },
  category: { PRODUCTIVITY: 6007 },
}));

// Mock utils to avoid file I/O
jest.mock('../src/utils', () => ({
  saveJson: jest.fn().mockReturnValue('/mock/path.json'),
  safeSegment: jest.requireActual('../src/utils').safeSegment,
  delay: jest.fn().mockResolvedValue(undefined),
  formatNumber: jest.requireActual('../src/utils').formatNumber,
  timestamp: jest.fn().mockReturnValue('2026-03-15-00-00-00'),
  extractKeywords: jest.requireActual('../src/utils').extractKeywords,
  extractThemes: jest.requireActual('../src/utils').extractThemes,
}));

const gplay = require('google-play-scraper').default;
const store = require('app-store-scraper');
const { discover, discoverGooglePlay, discoverAppStore } = require('../src/discover');
const { saveJson } = require('../src/utils');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('discoverGooglePlay', () => {
  test('searches and filters niche apps', async () => {
    gplay.search.mockResolvedValue(mockGplayApps);

    const results = await discoverGooglePlay('tracker', {
      markets: [{ code: 'us', name: 'United States', lang: 'en' }],
    });

    expect(gplay.search).toHaveBeenCalledTimes(1);
    expect(gplay.search).toHaveBeenCalledWith(expect.objectContaining({
      term: 'tracker',
      country: 'us',
      fullDetail: true,
    }));

    // Should filter out popular app (10M installs) and low rated (2.5 score)
    // Should keep niche.tracker (5K installs, 4.5 score) and niche.gem (10K installs, 4.7 score)
    expect(results.length).toBe(2);
    expect(results.every((r) => r.store === 'google-play')).toBe(true);
    expect(results.every((r) => r.score >= 4.0)).toBe(true);
    expect(results.every((r) => r.installs <= 100000)).toBe(true);
  });

  test('sorts results by score descending', async () => {
    gplay.search.mockResolvedValue(mockGplayApps);

    const results = await discoverGooglePlay('tracker', {
      markets: [{ code: 'us', name: 'United States', lang: 'en' }],
    });

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  test('searches across multiple markets', async () => {
    gplay.search.mockResolvedValue([mockGplayApps[0]]);

    const markets = [
      { code: 'us', name: 'United States', lang: 'en' },
      { code: 'jp', name: 'Japan', lang: 'ja' },
    ];
    await discoverGooglePlay('tracker', { markets });

    expect(gplay.search).toHaveBeenCalledTimes(2);
    expect(gplay.search).toHaveBeenCalledWith(expect.objectContaining({ country: 'us' }));
    expect(gplay.search).toHaveBeenCalledWith(expect.objectContaining({ country: 'jp' }));
  });

  test('handles API errors gracefully', async () => {
    gplay.search.mockRejectedValue(new Error('API rate limit'));

    const results = await discoverGooglePlay('tracker', {
      markets: [{ code: 'us', name: 'United States', lang: 'en' }],
    });

    expect(results).toEqual([]);
  });

  test('applies custom filters', async () => {
    gplay.search.mockResolvedValue(mockGplayApps);

    const results = await discoverGooglePlay('tracker', {
      markets: [{ code: 'us', name: 'United States', lang: 'en' }],
      filters: { maxInstalls: 8000, minScore: 4.0, minReviews: 10, maxReviews: 5000 },
    });

    // Only com.niche.tracker has 5000 installs <= 8000
    expect(results.length).toBe(1);
    expect(results[0].appId).toBe('com.niche.tracker');
  });

  test('maps app fields correctly', async () => {
    gplay.search.mockResolvedValue([mockGplayApps[0]]);

    const results = await discoverGooglePlay('tracker', {
      markets: [{ code: 'us', name: 'United States', lang: 'en' }],
    });

    const app = results[0];
    expect(app).toMatchObject({
      store: 'google-play',
      market: 'United States',
      marketCode: 'us',
      appId: 'com.niche.tracker',
      title: 'Niche Tracker',
      developer: 'Indie Dev',
      score: 4.5,
      reviews: 50,
      installs: 5000,
      free: true,
    });
    expect(app.installsFormatted).toBe('5.0K');
  });
});

describe('discoverAppStore', () => {
  test('searches and filters niche apps', async () => {
    store.search.mockResolvedValue(mockAppStoreApps);
    store.app.mockImplementation(({ id }) => {
      const found = mockAppStoreApps.find((a) => a.id === id);
      return Promise.resolve(found || mockAppStoreApps[0]);
    });

    const results = await discoverAppStore('tracker', {
      markets: [{ code: 'us', name: 'United States', lang: 'en' }],
    });

    expect(store.search).toHaveBeenCalledTimes(1);
    // Should keep com.appstore.niche (80 reviews, 4.3 score)
    // Should filter out com.appstore.big (500K reviews)
    expect(results.length).toBe(1);
    expect(results[0].appId).toBe('com.appstore.niche');
  });

  test('handles API errors gracefully', async () => {
    store.search.mockRejectedValue(new Error('Network error'));

    const results = await discoverAppStore('tracker', {
      markets: [{ code: 'us', name: 'United States', lang: 'en' }],
    });

    expect(results).toEqual([]);
  });

  test('reads details from search results without a per-app refetch', async () => {
    store.search.mockResolvedValue(mockAppStoreApps);

    const results = await discoverAppStore('tracker', {
      markets: [{ code: 'us', name: 'United States', lang: 'en' }],
    });

    // O1: App Store search already returns score/reviews, so store.app()
    // must not be called (it was ~20 redundant requests per market).
    expect(store.app).not.toHaveBeenCalled();
    expect(results.length).toBe(1);
    expect(results[0].appId).toBe('com.appstore.niche');
  });
});

describe('discover (main)', () => {
  test('searches both stores by default', async () => {
    gplay.search.mockResolvedValue([mockGplayApps[0]]);
    store.search.mockResolvedValue([mockAppStoreApps[0]]);
    store.app.mockResolvedValue(mockAppStoreApps[0]);

    const report = await discover('tracker', {
      markets: [{ code: 'us', name: 'United States', lang: 'en' }],
    });

    expect(report.query).toBe('tracker');
    expect(report.totalFound).toBeGreaterThanOrEqual(0);
    expect(report).toHaveProperty('googlePlay');
    expect(report).toHaveProperty('appStore');
    expect(report).toHaveProperty('apps');
    expect(saveJson).toHaveBeenCalledTimes(1);
  });

  test('filters by gplay only', async () => {
    gplay.search.mockResolvedValue([mockGplayApps[0]]);

    const report = await discover('tracker', {
      store: 'gplay',
      markets: [{ code: 'us', name: 'United States', lang: 'en' }],
    });

    expect(store.search).not.toHaveBeenCalled();
    expect(report.appStore).toBe(0);
  });

  test('filters by appstore only', async () => {
    store.search.mockResolvedValue([mockAppStoreApps[0]]);
    store.app.mockResolvedValue(mockAppStoreApps[0]);

    const report = await discover('tracker', {
      store: 'appstore',
      markets: [{ code: 'us', name: 'United States', lang: 'en' }],
    });

    expect(gplay.search).not.toHaveBeenCalled();
    expect(report.googlePlay).toBe(0);
  });

  test('saves report with correct filename pattern', async () => {
    gplay.search.mockResolvedValue([]);
    store.search.mockResolvedValue([]);

    await discover('habit tracker', {
      markets: [{ code: 'us', name: 'United States', lang: 'en' }],
    });

    expect(saveJson).toHaveBeenCalledWith(
      expect.stringContaining('discover-habit_tracker-'),
      expect.any(Object)
    );
  });
});
