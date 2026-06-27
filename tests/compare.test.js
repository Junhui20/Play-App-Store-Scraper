const { mockGplayApps } = require('./mocks');

jest.mock('google-play-scraper', () => ({
  __esModule: true,
  default: {
    search: jest.fn(),
    sort: { RATING: 'RATING' },
  },
}));

jest.mock('app-store-scraper', () => ({
  search: jest.fn(),
  sort: { RECENT: 'RECENT' },
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
const { compareMarkets } = require('../src/compare');
const { saveJson } = require('../src/utils');

beforeEach(() => {
  jest.clearAllMocks();
});

const US_MARKET = { code: 'us', name: 'United States', lang: 'en' };
const MY_MARKET = { code: 'my', name: 'Malaysia', lang: 'en' };

describe('compareMarkets', () => {
  test('searches both foreign and local markets', async () => {
    gplay.search.mockResolvedValue(mockGplayApps);

    await compareMarkets('tracker', {
      foreignMarket: US_MARKET,
      localMarket: MY_MARKET,
    });

    expect(gplay.search).toHaveBeenCalledTimes(2);
    expect(gplay.search).toHaveBeenCalledWith(expect.objectContaining({ country: 'us' }));
    expect(gplay.search).toHaveBeenCalledWith(expect.objectContaining({ country: 'my' }));
  });

  test('identifies apps not in local market', async () => {
    // Foreign market has 4 apps
    gplay.search.mockResolvedValueOnce(mockGplayApps);
    // Local market has only 1 matching app
    gplay.search.mockResolvedValueOnce([mockGplayApps[1]]); // Popular App

    const report = await compareMarkets('tracker', {
      foreignMarket: US_MARKET,
      localMarket: MY_MARKET,
    });

    expect(report.summary.foreignAppsFound).toBe(4);
    expect(report.summary.localAppsFound).toBe(1);
    // 3 apps should be in opportunities (not in local)
    expect(report.opportunities.length).toBe(3);
    expect(report.opportunities.every((a) => a.opportunity === 'not_in_local_market')).toBe(true);
  });

  test('identifies underserved apps (3x more reviews abroad)', async () => {
    const foreignApps = [
      { ...mockGplayApps[0], reviews: 3000 },
    ];
    const localApps = [
      { ...mockGplayApps[0], reviews: 500 }, // 3000 > 500*3 = 1500 → underserved
    ];

    gplay.search.mockResolvedValueOnce(foreignApps);
    gplay.search.mockResolvedValueOnce(localApps);

    const report = await compareMarkets('tracker', {
      foreignMarket: US_MARKET,
      localMarket: MY_MARKET,
    });

    expect(report.underserved.length).toBe(1);
    expect(report.underserved[0].opportunity).toBe('underserved_locally');
  });

  test('does not flag as underserved if local reviews are similar', async () => {
    const foreignApps = [
      { ...mockGplayApps[0], reviews: 100 },
    ];
    const localApps = [
      { ...mockGplayApps[0], reviews: 80 }, // 100 < 80*3 = 240 → not underserved
    ];

    gplay.search.mockResolvedValueOnce(foreignApps);
    gplay.search.mockResolvedValueOnce(localApps);

    const report = await compareMarkets('tracker', {
      foreignMarket: US_MARKET,
      localMarket: MY_MARKET,
    });

    expect(report.underserved.length).toBe(0);
  });

  test('matches by title case-insensitively', async () => {
    const foreign = [{ ...mockGplayApps[0], title: 'My App' }];
    const local = [{ ...mockGplayApps[0], appId: 'different.id', title: 'my app' }];

    gplay.search.mockResolvedValueOnce(foreign);
    gplay.search.mockResolvedValueOnce(local);

    const report = await compareMarkets('tracker', {
      foreignMarket: US_MARKET,
      localMarket: MY_MARKET,
    });

    // Should match by title even with different appId
    expect(report.opportunities.length).toBe(0);
  });

  test('uses App Store when specified', async () => {
    store.search.mockResolvedValue([]);

    await compareMarkets('tracker', {
      store: 'appstore',
      foreignMarket: US_MARKET,
      localMarket: MY_MARKET,
    });

    expect(store.search).toHaveBeenCalledTimes(2);
    expect(gplay.search).not.toHaveBeenCalled();
  });

  test('saves report with correct filename', async () => {
    gplay.search.mockResolvedValue([]);

    await compareMarkets('meal prep', {
      foreignMarket: US_MARKET,
      localMarket: MY_MARKET,
    });

    expect(saveJson).toHaveBeenCalledWith(
      expect.stringContaining('compare-meal_prep-us_vs_my-'),
      expect.any(Object)
    );
  });

  test('report structure is complete', async () => {
    gplay.search.mockResolvedValue(mockGplayApps);

    const report = await compareMarkets('tracker', {
      foreignMarket: US_MARKET,
      localMarket: MY_MARKET,
    });

    expect(report).toHaveProperty('query', 'tracker');
    expect(report).toHaveProperty('foreignMarket', 'United States');
    expect(report).toHaveProperty('localMarket', 'Malaysia');
    expect(report).toHaveProperty('store', 'gplay');
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('opportunities');
    expect(report).toHaveProperty('underserved');
    expect(report).toHaveProperty('foreignApps');
    expect(report).toHaveProperty('localApps');
  });

  test('handles API error in foreign market', async () => {
    gplay.search.mockRejectedValueOnce(new Error('Timeout'));
    gplay.search.mockResolvedValueOnce(mockGplayApps);

    const report = await compareMarkets('tracker', {
      foreignMarket: US_MARKET,
      localMarket: MY_MARKET,
    });

    expect(report.summary.foreignAppsFound).toBe(0);
  });

  test('handles API error in local market', async () => {
    gplay.search.mockResolvedValueOnce(mockGplayApps);
    gplay.search.mockRejectedValueOnce(new Error('Timeout'));

    const report = await compareMarkets('tracker', {
      foreignMarket: US_MARKET,
      localMarket: MY_MARKET,
    });

    expect(report.summary.localAppsFound).toBe(0);
    // All foreign apps are "not in local" since local returned empty
    expect(report.opportunities.length).toBe(4);
  });
});
