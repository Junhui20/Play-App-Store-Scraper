jest.mock('google-play-scraper', () => ({
  __esModule: true,
  default: { search: jest.fn(), suggest: jest.fn() },
}));

jest.mock('app-store-scraper', () => ({
  search: jest.fn(),
  suggest: jest.fn(),
}));

jest.mock('../src/utils', () => ({
  saveJson: jest.fn().mockReturnValue('/mock/path.json'),
  safeSegment: jest.requireActual('../src/utils').safeSegment,
  formatNumber: jest.requireActual('../src/utils').formatNumber,
  timestamp: jest.fn().mockReturnValue('2026-03-15-00-00-00'),
}));

const gplay = require('google-play-scraper').default;
const store = require('app-store-scraper');
const { score, computeScores } = require('../src/score');
const { saveJson } = require('../src/utils');

const US_MARKET = { code: 'us', name: 'United States', lang: 'en' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('computeScores', () => {
  test('entrenched competitors + title matches => high difficulty', () => {
    const apps = Array.from({ length: 5 }, (_, i) => ({ title: `Sleep Sounds ${i}`, reviews: 200000, installs: 5000000 }));
    const s = computeScores({ keyword: 'sleep sounds', apps, suggestions: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] });
    expect(s.breakdown.titleBroad).toBe(5);
    expect(s.difficulty).toBeGreaterThan(5);
    expect(s.opportunity).toBeLessThan(s.traffic); // difficulty drags opportunity below traffic
  });

  test('weak, off-topic competition => low difficulty', () => {
    const apps = [
      { title: 'Totally Unrelated', reviews: 40, installs: 1000 },
      { title: 'Something Else', reviews: 20, installs: 500 },
    ];
    const s = computeScores({ keyword: 'niche thing', apps, suggestions: ['niche thing'] });
    expect(s.breakdown.titleBroad).toBe(0);
    expect(s.difficulty).toBeLessThan(3);
  });

  test('empty apps => zeros, no crash', () => {
    const s = computeScores({ keyword: 'x', apps: [], suggestions: [] });
    expect(s).toMatchObject({ difficulty: 0, traffic: 0, opportunity: 0 });
    expect(s.breakdown.competitors).toBe(0);
  });

  test('App Store apps (no installs) use reviews as the demand proxy', () => {
    const apps = [{ title: 'App', reviews: 100000 }]; // no installs key
    const s = computeScores({ keyword: 'app', apps, suggestions: [] });
    expect(s.breakdown.avgInstalls).toBeNull();
    expect(s.breakdown.demandScore).toBe(s.breakdown.competitionScore);
  });

  test('opportunity rewards traffic and penalizes difficulty', () => {
    const easy = computeScores({ keyword: 'x', apps: [{ title: 'unrelated', reviews: 100, installs: 50000000 }], suggestions: Array(10).fill('s') });
    const hard = computeScores({ keyword: 'x', apps: [{ title: 'x', reviews: 500000, installs: 50000000 }], suggestions: Array(10).fill('s') });
    expect(easy.opportunity).toBeGreaterThan(hard.opportunity);
  });
});

describe('score (main)', () => {
  test('App Store path queries search + suggest and saves a report', async () => {
    store.search.mockResolvedValue([
      { id: 1, appId: 'com.a', title: 'Sleep App', score: 4.5, reviews: 3000, primaryGenre: 'Health' },
    ]);
    store.suggest.mockResolvedValue([{ term: 'sleep' }, { term: 'sleep sounds' }]);

    const report = await score('sleep', { store: 'appstore', market: US_MARKET });

    expect(store.search).toHaveBeenCalledTimes(1);
    expect(store.suggest).toHaveBeenCalledTimes(1);
    expect(report.keyword).toBe('sleep');
    expect(report).toHaveProperty('difficulty');
    expect(report).toHaveProperty('opportunity');
    expect(report.breakdown.suggestions).toBe(2);
    expect(saveJson).toHaveBeenCalledTimes(1);
    expect(saveJson.mock.calls[0][0]).toContain('score-sleep-us-');
  });

  test('does not throw when the search is blocked/empty', async () => {
    gplay.search.mockRejectedValue(new Error('blocked'));
    gplay.suggest.mockResolvedValue([]);

    const report = await score('x', { market: US_MARKET });

    expect(report.difficulty).toBe(0);
    expect(saveJson).toHaveBeenCalledTimes(1);
  });
});
