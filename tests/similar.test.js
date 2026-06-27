const { mockGplayApps, mockAppStoreApps } = require('./mocks');

jest.mock('google-play-scraper', () => ({
  __esModule: true,
  default: { similar: jest.fn() },
}));

jest.mock('app-store-scraper', () => ({
  similar: jest.fn(),
  app: jest.fn(),
}));

jest.mock('../src/utils', () => ({
  saveJson: jest.fn().mockReturnValue('/mock/path.json'),
  saveText: jest.fn(),
  safeSegment: jest.requireActual('../src/utils').safeSegment,
  formatNumber: jest.requireActual('../src/utils').formatNumber,
  timestamp: jest.fn().mockReturnValue('2026-03-15-00-00-00'),
}));

const gplay = require('google-play-scraper').default;
const store = require('app-store-scraper');
const { similar, similarGooglePlay, similarAppStore } = require('../src/similar');
const { saveJson } = require('../src/utils');

const US_MARKET = { code: 'us', name: 'United States', lang: 'en' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('similarGooglePlay', () => {
  test('normalizes similar apps', async () => {
    gplay.similar.mockResolvedValue(mockGplayApps);

    const results = await similarGooglePlay('com.seed', US_MARKET, 50);

    expect(gplay.similar).toHaveBeenCalledWith(expect.objectContaining({ appId: 'com.seed', country: 'us' }));
    expect(results.length).toBe(mockGplayApps.length);
    expect(results[0]).toMatchObject({ store: 'google-play', appId: 'com.niche.tracker' });
  });

  test('caps results to num', async () => {
    gplay.similar.mockResolvedValue(mockGplayApps); // 4 apps
    const results = await similarGooglePlay('com.seed', US_MARKET, 2);
    expect(results.length).toBe(2);
  });
});

describe('similarAppStore', () => {
  test('resolves a bundle id to a track id before calling similar', async () => {
    store.app.mockResolvedValue({ id: 999 });
    store.similar.mockResolvedValue(mockAppStoreApps);

    const results = await similarAppStore('com.bundle.id', US_MARKET, 50);

    expect(store.app).toHaveBeenCalledWith(expect.objectContaining({ appId: 'com.bundle.id' }));
    expect(store.similar).toHaveBeenCalledWith(expect.objectContaining({ id: 999 }));
    expect(results[0]).toMatchObject({ store: 'app-store', appId: 'com.appstore.niche' });
  });

  test('uses a numeric id directly (no app lookup)', async () => {
    store.similar.mockResolvedValue(mockAppStoreApps);
    await similarAppStore('123456', US_MARKET, 50);
    expect(store.app).not.toHaveBeenCalled();
    expect(store.similar).toHaveBeenCalledWith(expect.objectContaining({ id: 123456 }));
  });
});

describe('similar (main)', () => {
  test('routes to gplay by default and saves a report', async () => {
    gplay.similar.mockResolvedValue(mockGplayApps);

    const report = await similar('com.seed', { market: US_MARKET });

    expect(report.seed).toBe('com.seed');
    expect(report.store).toBe('gplay');
    expect(report.totalFound).toBe(mockGplayApps.length);
    expect(saveJson).toHaveBeenCalledTimes(1);
    expect(saveJson.mock.calls[0][0]).toContain('similar-com_seed-us-');
  });

  test('does not throw on API error, returns empty', async () => {
    gplay.similar.mockRejectedValue(new Error('blocked'));
    const report = await similar('com.seed', { market: US_MARKET });
    expect(report.totalFound).toBe(0);
  });

  test('sorts results by score descending', async () => {
    gplay.similar.mockResolvedValue(mockGplayApps);
    const report = await similar('com.seed', { market: US_MARKET });
    for (let i = 1; i < report.apps.length; i++) {
      expect(report.apps[i - 1].score).toBeGreaterThanOrEqual(report.apps[i].score);
    }
  });
});
