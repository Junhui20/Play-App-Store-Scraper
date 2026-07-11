const {
  buildMarketReport,
  slugify,
  competitorRows,
  aggregatePainPoints,
  aggregateFeatureRequests,
  DEFAULT_BRAND,
} = require('../src/report');

const discoverFixture = {
  query: 'sleep tracker',
  markets: ['United States'],
  totalFound: 2,
  googlePlay: 2,
  appStore: 0,
  apps: [
    {
      title: 'Sleep A', developer: 'Dev A', store: 'google-play', market: 'United States',
      score: 4.712, reviews: 102, installs: 100000, installsFormatted: '100.0K',
    },
    {
      title: 'Sleep B', developer: 'Dev B', store: 'google-play', market: 'United States',
      score: 4.05, reviews: 621, installs: 50000, installsFormatted: '50.0K',
    },
  ],
};

const analysisFixture = {
  app: { title: 'Sleep A', store: 'google-play', score: 4.71, reviews: 102 },
  analysis: {
    totalReviewsFetched: 235,
    negative: { count: 116, percentage: '49.4' },
    positive: { count: 119, percentage: '50.6' },
  },
  painPoints: [
    { issue: 'Missing Features', mentions: 22, severity: 'high' },
    { issue: 'Paywall', mentions: 20, severity: 'high' },
  ],
  featureRequests: [{ request: 'dark mode' }, { request: 'offline support' }],
};

const analysisFixture2 = {
  app: { title: 'Sleep B', store: 'google-play', score: 4.05, reviews: 621 },
  analysis: { totalReviewsFetched: 500, negative: { count: 25, percentage: '5.0' }, positive: { count: 475, percentage: '95.0' } },
  painPoints: [{ issue: 'Missing Features', mentions: 11, severity: 'high' }],
  featureRequests: [{ request: 'Dark Mode' }, { request: 'sleep timer' }],
};

describe('slugify', () => {
  test('hyphenates and lowercases', () => {
    expect(slugify('Sleep Tracker & Sounds')).toBe('sleep-tracker-sounds');
  });

  test('falls back to "market" for empty input', () => {
    expect(slugify('')).toBe('market');
  });
});

describe('competitorRows', () => {
  test('rounds ratings and prefers the formatted install band', () => {
    const rows = competitorRows(discoverFixture.apps);
    expect(rows[0].score).toBe(4.71);
    expect(rows[0].installs).toBe('100.0K');
  });

  test('respects the row limit', () => {
    expect(competitorRows(discoverFixture.apps, 1)).toHaveLength(1);
  });
});

describe('aggregatePainPoints', () => {
  test('sums mentions and counts affected apps, ranked by mentions', () => {
    const agg = aggregatePainPoints([analysisFixture, analysisFixture2]);
    expect(agg[0]).toEqual({ issue: 'Missing Features', mentions: 33, apps: 2 });
    expect(agg[1]).toEqual({ issue: 'Paywall', mentions: 20, apps: 1 });
  });
});

describe('aggregateFeatureRequests', () => {
  test('dedupes case-insensitively across analyses', () => {
    const reqs = aggregateFeatureRequests([analysisFixture, analysisFixture2]);
    expect(reqs).toEqual(['dark mode', 'offline support', 'sleep timer']);
  });

  test('respects the limit', () => {
    expect(aggregateFeatureRequests([analysisFixture, analysisFixture2], 1)).toEqual(['dark mode']);
  });
});

describe('buildMarketReport', () => {
  const md = buildMarketReport({
    topic: 'Sleep Tracker & Sounds',
    category: 'Health & Fitness',
    date: '2026-07-11',
    discover: discoverFixture,
    analyses: [analysisFixture, analysisFixture2],
  });

  test('renders the branded header, date, category and disclaimer', () => {
    expect(md).toContain('# Sleep Tracker & Sounds — Market Research Report');
    expect(md).toContain(`**Prepared by ${DEFAULT_BRAND.name}**`);
    expect(md).toContain('**Report date:** 2026-07-11');
    expect(md).toContain('**Category:** Health & Fitness');
    expect(md).toContain('**Data-source disclaimer.**');
  });

  test('renders all four sections and a branded footer', () => {
    expect(md).toContain('## 1. Market Overview');
    expect(md).toContain('## 2. Competitor Landscape');
    expect(md).toContain('## 3. Ratings & Review Analysis');
    expect(md).toContain('## 4. Opportunities');
    expect(md).toContain(`© 2026 ${DEFAULT_BRAND.name}`);
    expect(md).toContain('Confidential');
  });

  test('includes the competitor table and aggregated opportunities', () => {
    expect(md).toContain('| Sleep A | Dev A | google-play | United States | 4.71 | 102 | 100.0K |');
    expect(md).toContain('| Missing Features | 33 | 2 |');
    expect(md).toContain('- dark mode');
  });

  test('supports a custom brand override', () => {
    const branded = buildMarketReport({
      topic: 'X', date: '2026-01-01', brand: { name: 'Acme Labs' }, discover: discoverFixture,
    });
    expect(branded).toContain('**Prepared by Acme Labs**');
  });

  test('degrades gracefully when no data is supplied', () => {
    const empty = buildMarketReport({ topic: 'Empty Niche', date: '2026-01-01' });
    expect(empty).toContain('_No discovery dataset supplied for this report._');
    expect(empty).toContain('_No review analyses supplied for this report._');
    expect(empty).toContain('Run `analyze` on the leading competitors');
  });
});
