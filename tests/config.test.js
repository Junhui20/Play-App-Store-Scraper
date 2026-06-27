const {
  FOREIGN_MARKETS,
  LOCAL_MARKET,
  DISCOVER_FILTERS,
  REVIEW_SETTINGS,
  RATE_LIMIT_MS,
} = require('../src/config');

describe('config', () => {
  describe('FOREIGN_MARKETS', () => {
    test('is a non-empty array', () => {
      expect(Array.isArray(FOREIGN_MARKETS)).toBe(true);
      expect(FOREIGN_MARKETS.length).toBeGreaterThan(0);
    });

    test('each market has code, name, and lang', () => {
      for (const market of FOREIGN_MARKETS) {
        expect(market).toHaveProperty('code');
        expect(market).toHaveProperty('name');
        expect(market).toHaveProperty('lang');
        expect(typeof market.code).toBe('string');
        expect(typeof market.name).toBe('string');
        expect(typeof market.lang).toBe('string');
      }
    });

    test('includes US market', () => {
      const us = FOREIGN_MARKETS.find((m) => m.code === 'us');
      expect(us).toBeDefined();
      expect(us.name).toBe('United States');
    });
  });

  describe('LOCAL_MARKET', () => {
    test('has code, name, and lang', () => {
      expect(LOCAL_MARKET).toHaveProperty('code');
      expect(LOCAL_MARKET).toHaveProperty('name');
      expect(LOCAL_MARKET).toHaveProperty('lang');
    });

    test('is set to Malaysia', () => {
      expect(LOCAL_MARKET.code).toBe('my');
    });
  });

  describe('DISCOVER_FILTERS', () => {
    test('has required threshold fields', () => {
      expect(DISCOVER_FILTERS).toHaveProperty('maxInstalls');
      expect(DISCOVER_FILTERS).toHaveProperty('minScore');
      expect(DISCOVER_FILTERS).toHaveProperty('minReviews');
      expect(DISCOVER_FILTERS).toHaveProperty('maxReviews');
    });

    test('thresholds are sensible numbers', () => {
      expect(DISCOVER_FILTERS.maxInstalls).toBeGreaterThan(0);
      expect(DISCOVER_FILTERS.minScore).toBeGreaterThanOrEqual(1);
      expect(DISCOVER_FILTERS.minScore).toBeLessThanOrEqual(5);
      expect(DISCOVER_FILTERS.minReviews).toBeGreaterThanOrEqual(0);
      expect(DISCOVER_FILTERS.maxReviews).toBeGreaterThan(DISCOVER_FILTERS.minReviews);
    });
  });

  describe('REVIEW_SETTINGS', () => {
    test('has required fields', () => {
      expect(REVIEW_SETTINGS).toHaveProperty('numReviews');
      expect(REVIEW_SETTINGS).toHaveProperty('lowRatingMax');
      expect(REVIEW_SETTINGS).toHaveProperty('highRatingMin');
    });

    test('rating thresholds are valid', () => {
      expect(REVIEW_SETTINGS.lowRatingMax).toBeLessThan(REVIEW_SETTINGS.highRatingMin);
      expect(REVIEW_SETTINGS.lowRatingMax).toBeGreaterThanOrEqual(1);
      expect(REVIEW_SETTINGS.highRatingMin).toBeLessThanOrEqual(5);
    });
  });

  describe('RATE_LIMIT_MS', () => {
    test('is a positive number', () => {
      expect(typeof RATE_LIMIT_MS).toBe('number');
      expect(RATE_LIMIT_MS).toBeGreaterThan(0);
    });
  });
});

describe('config file overrides', () => {
  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  let cfgPath;

  afterEach(() => {
    if (cfgPath && fs.existsSync(cfgPath)) fs.unlinkSync(cfgPath);
    cfgPath = undefined;
    delete process.env.APP_SCOUT_CONFIG;
    jest.resetModules();
  });

  test('merges file overrides over defaults (partial override keeps other fields)', () => {
    cfgPath = path.join(os.tmpdir(), `app-scout-test-${process.pid}-${Date.now()}.json`);
    fs.writeFileSync(cfgPath, JSON.stringify({
      localMarket: { code: 'sg', name: 'Singapore', lang: 'en' },
      discoverFilters: { maxInstalls: 25000 },
      throttle: 2,
    }));
    process.env.APP_SCOUT_CONFIG = cfgPath;
    jest.resetModules();
    const cfg = require('../src/config');

    expect(cfg.LOCAL_MARKET.code).toBe('sg');
    expect(cfg.DISCOVER_FILTERS.maxInstalls).toBe(25000);
    expect(cfg.DISCOVER_FILTERS.minScore).toBe(4.0); // untouched default preserved
    expect(cfg.THROTTLE).toBe(2);
  });

  test('falls back to defaults when the config file is absent', () => {
    process.env.APP_SCOUT_CONFIG = path.join(os.tmpdir(), 'app-scout-does-not-exist.json');
    jest.resetModules();
    const cfg = require('../src/config');

    expect(cfg.LOCAL_MARKET.code).toBe('my');
    expect(cfg.THROTTLE).toBe(5);
  });
});
