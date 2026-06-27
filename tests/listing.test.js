const { mockGplayApps, mockAppStoreApps } = require('./mocks');

jest.mock('google-play-scraper', () => ({
  __esModule: true,
  default: {
    list: jest.fn(),
    search: jest.fn(),
    sort: { RATING: 'RATING' },
    collection: { TOP_FREE: 'TOP_FREE', TOP_PAID: 'TOP_PAID', GROSSING: 'GROSSING' },
    category: { PRODUCTIVITY: 'PRODUCTIVITY', HEALTH_AND_FITNESS: 'HEALTH_AND_FITNESS' },
  },
}));

jest.mock('app-store-scraper', () => ({
  list: jest.fn(),
  search: jest.fn(),
  sort: { RECENT: 'RECENT' },
  collection: {
    TOP_FREE_IOS: 'topfreeapplications',
    TOP_PAID_IOS: 'toppaidapplications',
    TOP_GROSSING_IOS: 'topgrossingapplications',
    NEW_IOS: 'newapplications',
    NEW_FREE_IOS: 'newfreeapplications',
  },
  category: { PRODUCTIVITY: 6007, HEALTH_AND_FITNESS: 6013 },
}));

jest.mock('../src/utils', () => ({
  saveJson: jest.fn().mockReturnValue('/mock/path.json'),
  safeSegment: jest.requireActual('../src/utils').safeSegment,
  delay: jest.fn().mockResolvedValue(undefined),
  formatNumber: jest.requireActual('../src/utils').formatNumber,
  timestamp: jest.fn().mockReturnValue('2026-03-15-00-00-00'),
}));

const gplay = require('google-play-scraper').default;
const store = require('app-store-scraper');
const { list, listGooglePlay, listAppStore } = require('../src/listing');
const { saveJson } = require('../src/utils');

const US_MARKET = { code: 'us', name: 'United States', lang: 'en' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('listGooglePlay', () => {
  test('calls gplay.list with correct params', async () => {
    gplay.list.mockResolvedValue(mockGplayApps);

    await listGooglePlay({
      collection: 'TOP_FREE',
      category: 'PRODUCTIVITY',
      market: US_MARKET,
      num: 20,
    });

    expect(gplay.list).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'TOP_FREE',
      category: 'PRODUCTIVITY',
      country: 'us',
      lang: 'en',
      num: 20,
      fullDetail: true,
    }));
  });

  test('maps app fields correctly', async () => {
    gplay.list.mockResolvedValue([mockGplayApps[0]]);

    const results = await listGooglePlay({ market: US_MARKET });

    expect(results.length).toBe(1);
    expect(results[0]).toMatchObject({
      store: 'google-play',
      market: 'United States',
      marketCode: 'us',
      appId: 'com.niche.tracker',
      title: 'Niche Tracker',
    });
  });

  test('handles API errors gracefully', async () => {
    gplay.list.mockRejectedValue(new Error('Failed'));

    const results = await listGooglePlay({ market: US_MARKET });
    expect(results).toEqual([]);
  });

  test('uses default values when options omitted', async () => {
    gplay.list.mockResolvedValue([]);

    await listGooglePlay({});

    expect(gplay.list).toHaveBeenCalledWith(expect.objectContaining({
      num: 60,
    }));
  });
});

describe('listAppStore', () => {
  test('calls store.list with correct params', async () => {
    store.list.mockResolvedValue(mockAppStoreApps);

    await listAppStore({
      collection: 'NEW_IOS',
      category: 'PRODUCTIVITY',
      market: US_MARKET,
      num: 30,
    });

    expect(store.list).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'newapplications',
      category: 6007,
      country: 'us',
      num: 30,
    }));
  });

  test('maps app fields correctly', async () => {
    store.list.mockResolvedValue([mockAppStoreApps[0]]);

    const results = await listAppStore({ market: US_MARKET });

    expect(results.length).toBe(1);
    expect(results[0]).toMatchObject({
      store: 'app-store',
      market: 'United States',
      appId: 'com.appstore.niche',
      trackId: 123456,
    });
  });

  test('handles API errors gracefully', async () => {
    store.list.mockRejectedValue(new Error('Failed'));

    const results = await listAppStore({ market: US_MARKET });
    expect(results).toEqual([]);
  });
});

describe('list (main)', () => {
  test('queries both stores by default', async () => {
    gplay.list.mockResolvedValue(mockGplayApps);
    store.list.mockResolvedValue(mockAppStoreApps);

    const report = await list({ market: US_MARKET });

    expect(gplay.list).toHaveBeenCalledTimes(1);
    expect(store.list).toHaveBeenCalledTimes(1);
    expect(report.totalFound).toBe(mockGplayApps.length + mockAppStoreApps.length);
  });

  test('queries only gplay when specified', async () => {
    gplay.list.mockResolvedValue(mockGplayApps);

    const report = await list({ store: 'gplay', market: US_MARKET });

    expect(gplay.list).toHaveBeenCalledTimes(1);
    expect(store.list).not.toHaveBeenCalled();
    expect(report.totalFound).toBe(mockGplayApps.length);
  });

  test('queries only appstore when specified', async () => {
    store.list.mockResolvedValue(mockAppStoreApps);

    const report = await list({ store: 'appstore', market: US_MARKET });

    expect(store.list).toHaveBeenCalledTimes(1);
    expect(gplay.list).not.toHaveBeenCalled();
    expect(report.totalFound).toBe(mockAppStoreApps.length);
  });

  test('applies niche filter when enabled', async () => {
    gplay.list.mockResolvedValue(mockGplayApps);
    store.list.mockResolvedValue([]);

    const report = await list({
      store: 'gplay',
      market: US_MARKET,
      niche: true,
    });

    // From mockGplayApps: niche.tracker (5K, 4.5) and niche.gem (10K, 4.7) pass
    // popular.app (10M installs) and low.rated (2.5 score) fail
    expect(report.totalFound).toBe(2);
    expect(report.nicheFilter).toBe(true);
  });

  test('does not filter when niche is false', async () => {
    gplay.list.mockResolvedValue(mockGplayApps);
    store.list.mockResolvedValue([]);

    const report = await list({
      store: 'gplay',
      market: US_MARKET,
      niche: false,
    });

    expect(report.totalFound).toBe(mockGplayApps.length);
    expect(report.nicheFilter).toBe(false);
  });

  test('maps collection names for App Store', async () => {
    gplay.list.mockResolvedValue([]);
    store.list.mockResolvedValue([]);

    await list({
      collection: 'TOP_FREE',
      market: US_MARKET,
    });

    // Should map TOP_FREE → TOP_FREE_IOS → 'topfreeapplications'
    expect(store.list).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'topfreeapplications',
    }));
  });

  test('saves report with correct filename', async () => {
    gplay.list.mockResolvedValue([]);
    store.list.mockResolvedValue([]);

    await list({
      collection: 'TOP_FREE',
      category: 'PRODUCTIVITY',
      market: US_MARKET,
    });

    expect(saveJson).toHaveBeenCalledWith(
      expect.stringContaining('list-TOP_FREE_PRODUCTIVITY-us-'),
      expect.any(Object)
    );
  });

  test('report structure is complete', async () => {
    gplay.list.mockResolvedValue([]);
    store.list.mockResolvedValue([]);

    const report = await list({
      collection: 'TOP_FREE',
      category: 'PRODUCTIVITY',
      market: US_MARKET,
    });

    expect(report).toHaveProperty('collection', 'TOP_FREE');
    expect(report).toHaveProperty('category', 'PRODUCTIVITY');
    expect(report).toHaveProperty('market', 'United States');
    expect(report).toHaveProperty('store', 'both');
    expect(report).toHaveProperty('nicheFilter', false);
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('totalFound');
    expect(report).toHaveProperty('apps');
  });

  test('category defaults to "all" when not specified', async () => {
    gplay.list.mockResolvedValue([]);
    store.list.mockResolvedValue([]);

    const report = await list({ market: US_MARKET });

    expect(report.category).toBe('all');
  });
});
