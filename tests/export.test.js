jest.mock('../src/utils', () => {
  const actual = jest.requireActual('../src/utils');
  return { ...actual, saveText: jest.fn() };
});

const utils = require('../src/utils');
const {
  toCsv,
  toMarkdownTable,
  analysisToMarkdown,
  writeAppExports,
  writeAnalysisExports,
} = require('../src/export');

beforeEach(() => {
  jest.clearAllMocks();
});

const COLS = [
  { key: 'title', header: 'Title' },
  { key: 'score', header: 'Score' },
];

describe('toCsv', () => {
  test('renders header + rows', () => {
    expect(toCsv([{ title: 'My App', score: 4.5 }], COLS)).toBe('Title,Score\nMy App,4.5');
  });

  test('escapes commas, quotes and newlines', () => {
    expect(toCsv([{ title: 'A, "B"\nC', score: 1 }], COLS)).toBe('Title,Score\n"A, ""B""\nC",1');
  });

  test('renders empty string for null/undefined cells', () => {
    expect(toCsv([{ title: null, score: undefined }], COLS)).toBe('Title,Score\n,');
  });
});

describe('toMarkdownTable', () => {
  test('renders a GitHub table with header + divider', () => {
    expect(toMarkdownTable([{ title: 'My App', score: 4.5 }], COLS))
      .toBe('| Title | Score |\n| --- | --- |\n| My App | 4.5 |');
  });

  test('escapes pipes and flattens newlines within a cell', () => {
    expect(toMarkdownTable([{ title: 'a|b\nc', score: 1 }], COLS)).toContain('| a\\|b c | 1 |');
  });
});

describe('analysisToMarkdown', () => {
  const report = {
    app: { title: 'Test', developer: 'Dev', store: 'google-play', score: 4.2, reviews: 1500 },
    analysis: {
      totalReviewsFetched: 100,
      negative: { count: 40, percentage: '40.0' },
      positive: { count: 60, percentage: '60.0' },
    },
    painPoints: [{ issue: 'Crashes/Bugs', mentions: 12, severity: 'high' }],
    featureRequests: [{ request: 'dark mode' }],
  };

  test('includes header, pain-point table and feature requests', () => {
    const md = analysisToMarkdown(report);
    expect(md).toContain('# Review Analysis — Test');
    expect(md).toContain('40 negative (40.0%)');
    expect(md).toContain('| Crashes/Bugs | 12 | high |');
    expect(md).toContain('- "dark mode"');
  });

  test('shows a placeholder when there are no pain points / requests', () => {
    const md = analysisToMarkdown({ ...report, painPoints: [], featureRequests: [] });
    expect(md).toContain('_None detected._');
  });
});

describe('writeAppExports', () => {
  const apps = [{ store: 'google-play', title: 'A', score: 4.5 }];

  test('format=csv writes only a .csv file', () => {
    writeAppExports('base', apps, 'csv');
    expect(utils.saveText).toHaveBeenCalledTimes(1);
    expect(utils.saveText.mock.calls[0][0]).toBe('base.csv');
  });

  test('format=all writes both .csv and .md', () => {
    writeAppExports('base', apps, 'all');
    expect(utils.saveText.mock.calls.map((c) => c[0])).toEqual(['base.csv', 'base.md']);
  });

  test('no format writes nothing', () => {
    writeAppExports('base', apps, undefined);
    expect(utils.saveText).not.toHaveBeenCalled();
  });
});

describe('writeAnalysisExports', () => {
  const report = {
    app: { title: 'T', developer: 'D', store: 'google-play', score: 4, reviews: 10 },
    analysis: { totalReviewsFetched: 10, negative: { count: 5, percentage: '50.0' }, positive: { count: 5, percentage: '50.0' } },
    painPoints: [],
    featureRequests: [],
  };

  test('format=md writes a .md report', () => {
    writeAnalysisExports('base', report, 'md');
    expect(utils.saveText).toHaveBeenCalledTimes(1);
    expect(utils.saveText.mock.calls[0][0]).toBe('base.md');
  });
});
