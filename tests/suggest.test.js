jest.mock('google-play-scraper', () => ({
  __esModule: true,
  default: { suggest: jest.fn() },
}));

jest.mock('app-store-scraper', () => ({
  suggest: jest.fn(),
}));

jest.mock('../src/utils', () => ({
  saveJson: jest.fn().mockReturnValue('/mock/path.json'),
  safeSegment: jest.requireActual('../src/utils').safeSegment,
  timestamp: jest.fn().mockReturnValue('2026-03-15-00-00-00'),
}));

const gplay = require('google-play-scraper').default;
const store = require('app-store-scraper');
const { suggest } = require('../src/suggest');
const { saveJson } = require('../src/utils');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('suggest', () => {
  test('merges and de-duplicates suggestions from both stores', async () => {
    gplay.suggest.mockResolvedValue(['habit tracker', 'habit now']);
    store.suggest.mockResolvedValue([{ term: 'habit tracker' }, { term: 'habitica' }]);

    const report = await suggest('habit');

    expect(report.suggestions.googlePlay).toEqual(['habit tracker', 'habit now']);
    expect(report.suggestions.appStore).toEqual(['habit tracker', 'habitica']);
    // 'habit tracker' appears in both -> deduped in merged
    expect(report.merged).toEqual(['habit tracker', 'habit now', 'habitica']);
    expect(report.totalSuggestions).toBe(3);
    expect(saveJson).toHaveBeenCalledTimes(1);
    expect(saveJson.mock.calls[0][0]).toContain('suggest-habit-');
  });

  test('store=gplay only queries Google Play', async () => {
    gplay.suggest.mockResolvedValue(['a']);
    const report = await suggest('x', { store: 'gplay' });
    expect(store.suggest).not.toHaveBeenCalled();
    expect(report.suggestions.appStore).toBeUndefined();
  });

  test('tolerates an API error from one store', async () => {
    gplay.suggest.mockRejectedValue(new Error('blocked'));
    store.suggest.mockResolvedValue([{ term: 'sleep' }]);

    const report = await suggest('sleep');

    expect(report.suggestions.googlePlay).toEqual([]);
    expect(report.merged).toEqual(['sleep']);
  });
});
