const { mockGplayAppDetail, mockAppStoreDetail, mockReviews } = require('./mocks');

jest.mock('google-play-scraper', () => ({
  __esModule: true,
  default: {
    app: jest.fn(),
    reviews: jest.fn(),
    sort: { NEWEST: 'NEWEST', RATING: 'RATING' },
  },
}));

jest.mock('app-store-scraper', () => ({
  app: jest.fn(),
  reviews: jest.fn(),
  sort: { RECENT: 'RECENT' },
}));

jest.mock('../src/utils', () => ({
  saveJson: jest.fn().mockReturnValue('/mock/path.json'),
  safeSegment: jest.requireActual('../src/utils').safeSegment,
  delay: jest.fn().mockResolvedValue(undefined),
  percentage: jest.requireActual('../src/utils').percentage,
  timestamp: jest.fn().mockReturnValue('2026-03-15-00-00-00'),
  extractKeywords: jest.requireActual('../src/utils').extractKeywords,
  extractThemes: jest.requireActual('../src/utils').extractThemes,
}));

const gplay = require('google-play-scraper').default;
const store = require('app-store-scraper');
const { analyze, analyzeGooglePlay, analyzeAppStore } = require('../src/analyze');
const { saveJson } = require('../src/utils');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('analyzeGooglePlay', () => {
  test('fetches app details and reviews', async () => {
    gplay.app.mockResolvedValue(mockGplayAppDetail);
    gplay.reviews.mockResolvedValue({ data: mockReviews });

    const report = await analyzeGooglePlay('com.test.app');

    expect(gplay.app).toHaveBeenCalledWith({ appId: 'com.test.app' });
    expect(gplay.reviews).toHaveBeenCalledWith(expect.objectContaining({
      appId: 'com.test.app',
    }));
    expect(report.app.title).toBe('Test App');
    expect(report.app.store).toBe('google-play');
  });

  test('builds report with correct structure', async () => {
    gplay.app.mockResolvedValue(mockGplayAppDetail);
    gplay.reviews.mockResolvedValue({ data: mockReviews });

    const report = await analyzeGooglePlay('com.test.app');

    expect(report).toHaveProperty('app');
    expect(report).toHaveProperty('analysis');
    expect(report).toHaveProperty('painPoints');
    expect(report).toHaveProperty('featureRequests');
    expect(report).toHaveProperty('timestamp');
    expect(report.analysis).toHaveProperty('totalReviewsFetched');
    expect(report.analysis).toHaveProperty('negative');
    expect(report.analysis).toHaveProperty('positive');
  });

  test('separates negative and positive reviews', async () => {
    gplay.app.mockResolvedValue(mockGplayAppDetail);
    gplay.reviews.mockResolvedValue({ data: mockReviews });

    const report = await analyzeGooglePlay('com.test.app');

    const totalFetched = report.analysis.totalReviewsFetched;
    expect(totalFetched).toBe(mockReviews.length);

    const negCount = report.analysis.negative.count;
    const posCount = report.analysis.positive.count;
    // Reviews with score 1-3 = negative, 4-5 = positive
    // score 3 is in neither negative nor positive in our 15 reviews... wait
    // lowRatingMax=3, highRatingMin=4, so score 3 is negative, score 4+ is positive
    expect(negCount + posCount).toBeLessThanOrEqual(totalFetched);
    expect(negCount).toBeGreaterThan(0);
    expect(posCount).toBeGreaterThan(0);
  });

  test('extracts pain points from negative reviews', async () => {
    gplay.app.mockResolvedValue(mockGplayAppDetail);
    gplay.reviews.mockResolvedValue({ data: mockReviews });

    const report = await analyzeGooglePlay('com.test.app');

    expect(Array.isArray(report.painPoints)).toBe(true);
    // We have multiple crash/bug reviews in mock data
    const crashPain = report.painPoints.find((p) => p.issue === 'Crashes/Bugs');
    expect(crashPain).toBeDefined();
    expect(crashPain.mentions).toBeGreaterThanOrEqual(2);
  });

  test('assigns severity levels correctly', async () => {
    gplay.app.mockResolvedValue(mockGplayAppDetail);
    gplay.reviews.mockResolvedValue({ data: mockReviews });

    const report = await analyzeGooglePlay('com.test.app');

    for (const pp of report.painPoints) {
      if (pp.mentions >= 10) expect(pp.severity).toBe('high');
      else if (pp.mentions >= 5) expect(pp.severity).toBe('medium');
      else expect(pp.severity).toBe('low');
    }
  });

  test('extracts feature requests', async () => {
    gplay.app.mockResolvedValue(mockGplayAppDetail);
    gplay.reviews.mockResolvedValue({ data: mockReviews });

    const report = await analyzeGooglePlay('com.test.app');

    expect(Array.isArray(report.featureRequests)).toBe(true);
    // mockReviews[4] says "wish it had dark mode. Please add offline support."
    // mockReviews[11] says "should have notification reminders"
    expect(report.featureRequests.length).toBeGreaterThan(0);
  });

  test('respects custom review count', async () => {
    gplay.app.mockResolvedValue(mockGplayAppDetail);
    gplay.reviews.mockResolvedValue({ data: mockReviews });

    await analyzeGooglePlay('com.test.app', { num: 100 });

    expect(gplay.reviews).toHaveBeenCalledWith(expect.objectContaining({
      num: 100,
    }));
  });
});

describe('analyzeAppStore', () => {
  test('fetches app by numeric id', async () => {
    store.app.mockResolvedValue(mockAppStoreDetail);
    store.reviews
      .mockResolvedValueOnce(mockReviews.slice(0, 5))
      .mockResolvedValueOnce([]);

    const report = await analyzeAppStore('123456');

    expect(store.app).toHaveBeenCalledWith({ id: 123456 });
    expect(report.app.store).toBe('app-store');
  });

  test('fetches app by bundle id', async () => {
    store.app.mockResolvedValue(mockAppStoreDetail);
    store.reviews
      .mockResolvedValueOnce(mockReviews.slice(0, 5))
      .mockResolvedValueOnce([]);

    await analyzeAppStore('com.test.iosapp');

    expect(store.app).toHaveBeenCalledWith({ appId: 'com.test.iosapp' });
  });

  test('fetches multiple pages of reviews', async () => {
    store.app.mockResolvedValue(mockAppStoreDetail);
    store.reviews
      .mockResolvedValueOnce(mockReviews.slice(0, 5))   // page 1
      .mockResolvedValueOnce(mockReviews.slice(5, 10))   // page 2
      .mockResolvedValueOnce(mockReviews.slice(10, 15))  // page 3
      .mockResolvedValueOnce([]);                         // page 4 empty = stop

    const report = await analyzeAppStore('123456', { pages: 5 });

    expect(store.reviews).toHaveBeenCalledTimes(4); // stopped at empty page
    expect(report.analysis.totalReviewsFetched).toBe(15);
  });

  test('handles review fetch errors gracefully', async () => {
    store.app.mockResolvedValue(mockAppStoreDetail);
    store.reviews
      .mockResolvedValueOnce(mockReviews.slice(0, 5))
      .mockRejectedValueOnce(new Error('Timeout'));

    const report = await analyzeAppStore('123456');

    expect(report.analysis.totalReviewsFetched).toBe(5);
  });
});

describe('analyze (main)', () => {
  test('routes to Google Play by default', async () => {
    gplay.app.mockResolvedValue(mockGplayAppDetail);
    gplay.reviews.mockResolvedValue({ data: mockReviews });

    const report = await analyze('com.test.app');

    expect(gplay.app).toHaveBeenCalled();
    expect(store.app).not.toHaveBeenCalled();
    expect(report.app.store).toBe('google-play');
    expect(saveJson).toHaveBeenCalledTimes(1);
  });

  test('routes to App Store when specified', async () => {
    store.app.mockResolvedValue(mockAppStoreDetail);
    store.reviews
      .mockResolvedValueOnce(mockReviews.slice(0, 5))
      .mockResolvedValueOnce([]);

    const report = await analyze('123456', { store: 'appstore' });

    expect(store.app).toHaveBeenCalled();
    expect(gplay.app).not.toHaveBeenCalled();
    expect(report.app.store).toBe('app-store');
  });

  test('saves report with sanitized filename', async () => {
    gplay.app.mockResolvedValue(mockGplayAppDetail);
    gplay.reviews.mockResolvedValue({ data: mockReviews });

    await analyze('com.test.app');

    expect(saveJson).toHaveBeenCalledWith(
      expect.stringContaining('analyze-com_test_app-'),
      expect.any(Object)
    );
  });

  test('report has correct negative percentage', async () => {
    gplay.app.mockResolvedValue(mockGplayAppDetail);
    gplay.reviews.mockResolvedValue({ data: mockReviews });

    const report = await analyze('com.test.app');

    const pct = parseFloat(report.analysis.negative.percentage);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
  });
});
