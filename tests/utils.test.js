const fs = require('fs');
const path = require('path');
const { saveJson, safeSegment, delay, formatNumber, percentage, ratingsSummary, timestamp, extractKeywords, extractThemes } = require('../src/utils');

// Mock fs to avoid writing real files during tests
jest.mock('fs');

beforeEach(() => {
  jest.clearAllMocks();
  fs.existsSync.mockReturnValue(true);
  fs.writeFileSync.mockImplementation(() => {});
  fs.mkdirSync.mockImplementation(() => {});
});

describe('formatNumber', () => {
  test('formats millions', () => {
    expect(formatNumber(1000000)).toBe('1.0M');
    expect(formatNumber(5500000)).toBe('5.5M');
    expect(formatNumber(10000000)).toBe('10.0M');
  });

  test('formats thousands', () => {
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(50000)).toBe('50.0K');
    expect(formatNumber(999999)).toBe('1000.0K');
  });

  test('formats small numbers as string', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(999)).toBe('999');
  });
});

describe('timestamp', () => {
  test('returns ISO-like string with dashes', () => {
    const ts = timestamp();
    // Format: YYYY-MM-DD-HH-MM-SS
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/);
  });
});

describe('delay', () => {
  test('resolves after specified ms', async () => {
    const start = Date.now();
    await delay(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});

describe('saveJson', () => {
  test('writes JSON file to output directory', () => {
    const data = { foo: 'bar' };
    const result = saveJson('test.json', data);

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const [filepath, content] = fs.writeFileSync.mock.calls[0];
    expect(filepath).toContain('test.json');
    expect(JSON.parse(content)).toEqual(data);
    expect(result).toContain('test.json');
  });

  test('creates output directory if missing', () => {
    fs.existsSync.mockReturnValue(false);
    saveJson('test.json', {});

    expect(fs.mkdirSync).toHaveBeenCalledTimes(1);
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  test('does not create directory if it exists', () => {
    fs.existsSync.mockReturnValue(true);
    saveJson('test.json', {});

    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  test('contains writes to the output directory (path traversal safe)', () => {
    const result = saveJson('../../../../tmp/PWNED.json', { x: 1 });

    const [filepath] = fs.writeFileSync.mock.calls[0];
    expect(filepath).toContain(`${path.sep}output${path.sep}`);
    expect(filepath.endsWith(`${path.sep}PWNED.json`)).toBe(true);
    expect(filepath).not.toContain('..');
    expect(result).toBe(filepath);
  });
});

describe('safeSegment', () => {
  test('strips path separators and traversal sequences', () => {
    expect(safeSegment('../../etc/passwd')).toBe('______etc_passwd');
    expect(safeSegment('a/b\\c')).toBe('a_b_c');
  });

  test('replaces spaces/punctuation but keeps word chars and dashes', () => {
    expect(safeSegment('habit tracker')).toBe('habit_tracker');
    expect(safeSegment('TOP_FREE')).toBe('TOP_FREE');
    expect(safeSegment('com.todoist')).toBe('com_todoist');
  });

  test('handles null/undefined without throwing', () => {
    expect(safeSegment(null)).toBe('');
    expect(safeSegment(undefined)).toBe('');
  });
});

describe('percentage', () => {
  test('computes a one-decimal percentage string', () => {
    expect(percentage(3, 15)).toBe('20.0');
    expect(percentage(1, 3)).toBe('33.3');
  });

  test('returns "0.0" instead of NaN when total is zero', () => {
    expect(percentage(0, 0)).toBe('0.0');
    expect(percentage(5, 0)).toBe('0.0');
  });
});

describe('ratingsSummary', () => {
  test('summarizes a histogram into totals and low-star shares', () => {
    const s = ratingsSummary({ 1: 10, 2: 10, 3: 0, 4: 30, 5: 50 });
    expect(s.total).toBe(100);
    expect(s.oneStarShare).toBe('10.0');
    expect(s.negativeShare).toBe('20.0');
  });

  test('returns null when no histogram is provided', () => {
    expect(ratingsSummary(undefined)).toBeNull();
    expect(ratingsSummary(null)).toBeNull();
  });

  test('treats missing star buckets as zero', () => {
    const s = ratingsSummary({ 5: 10 });
    expect(s.total).toBe(10);
    expect(s.negativeShare).toBe('0.0');
  });
});

describe('extractKeywords', () => {
  test('extracts top keywords from reviews', () => {
    const reviews = [
      { text: 'The crash happens every time I open the settings page' },
      { text: 'Crash on startup, settings not loading' },
      { text: 'Settings page crashes the whole thing' },
    ];

    const keywords = extractKeywords(reviews);

    expect(Array.isArray(keywords)).toBe(true);
    const words = keywords.map((k) => k.word);
    expect(words).toContain('crash');
    expect(words).toContain('settings');
  });

  test('filters out stop words', () => {
    const reviews = [
      { text: 'the app is not working and it was very bad' },
    ];

    const keywords = extractKeywords(reviews);
    const words = keywords.map((k) => k.word);
    expect(words).not.toContain('the');
    expect(words).not.toContain('and');
    expect(words).not.toContain('not');
    expect(words).not.toContain('app');
  });

  test('counts each word once per review', () => {
    const reviews = [
      { text: 'crash crash crash crash crash' },
      { text: 'crash again' },
    ];

    const keywords = extractKeywords(reviews);
    const crashEntry = keywords.find((k) => k.word === 'crash');
    expect(crashEntry.count).toBe(2); // once per review, not 6
  });

  test('handles empty reviews', () => {
    const keywords = extractKeywords([]);
    expect(keywords).toEqual([]);
  });

  test('handles reviews with no text', () => {
    const reviews = [{ text: null }, { text: undefined }, {}];
    const keywords = extractKeywords(reviews);
    expect(keywords).toEqual([]);
  });

  test('returns max 30 keywords', () => {
    const reviews = [];
    for (let i = 0; i < 50; i++) {
      reviews.push({ text: `uniqueword${i} something extra here` });
    }
    const keywords = extractKeywords(reviews);
    expect(keywords.length).toBeLessThanOrEqual(30);
  });

  test('sorts by count descending', () => {
    const reviews = [
      { text: 'feature loading slow' },
      { text: 'feature request please' },
      { text: 'feature missing option' },
      { text: 'loading takes forever' },
    ];

    const keywords = extractKeywords(reviews);
    for (let i = 1; i < keywords.length; i++) {
      expect(keywords[i - 1].count).toBeGreaterThanOrEqual(keywords[i].count);
    }
  });
});

describe('extractThemes', () => {
  test('detects crash/bug theme', () => {
    const reviews = [
      { text: 'App crashes every time', score: 1 },
      { text: 'Found a bug in settings', score: 2 },
    ];
    const themes = extractThemes(reviews);
    expect(themes['crash/bug']).toBeDefined();
    expect(themes['crash/bug'].count).toBe(2);
  });

  test('detects ads theme', () => {
    const reviews = [
      { text: 'Too many ads in this app', score: 1 },
      { text: 'Popup ads are annoying', score: 2 },
    ];
    const themes = extractThemes(reviews);
    expect(themes['ads']).toBeDefined();
    expect(themes['ads'].count).toBe(2);
  });

  test('detects feature request theme', () => {
    const reviews = [
      { text: 'I wish it had dark mode', score: 3 },
      { text: 'Please add export feature, really need it', score: 4 },
    ];
    const themes = extractThemes(reviews);
    expect(themes['feature request']).toBeDefined();
  });

  test('calculates percentage correctly', () => {
    const reviews = [
      { text: 'crash on open', score: 1 },
      { text: 'works fine', score: 5 },
      { text: 'another crash here', score: 1 },
      { text: 'love this app', score: 5 },
    ];
    const themes = extractThemes(reviews);
    expect(themes['crash/bug'].percentage).toBe('50.0');
  });

  test('includes sample reviews capped at 3', () => {
    const reviews = [
      { text: 'crash 1', score: 1 },
      { text: 'crash 2', score: 1 },
      { text: 'crash 3', score: 1 },
      { text: 'crash 4', score: 1 },
      { text: 'crash 5', score: 1 },
    ];
    const themes = extractThemes(reviews);
    expect(themes['crash/bug'].samples.length).toBe(3);
  });

  test('sorts themes by count descending', () => {
    const reviews = [
      { text: 'crash here', score: 1 },
      { text: 'bug crash error', score: 1 },
      { text: 'crash freeze', score: 1 },
      { text: 'slow loading', score: 2 },
    ];
    const themes = extractThemes(reviews);
    const counts = Object.values(themes).map((t) => t.count);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i - 1]).toBeGreaterThanOrEqual(counts[i]);
    }
  });

  test('handles empty reviews', () => {
    const themes = extractThemes([]);
    expect(Object.keys(themes).length).toBe(0);
  });

  test('ignores reviews with no text', () => {
    const reviews = [{ score: 1 }, { text: null, score: 2 }];
    const themes = extractThemes(reviews);
    expect(Object.keys(themes).length).toBe(0);
  });
});
