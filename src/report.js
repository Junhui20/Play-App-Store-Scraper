const fs = require('fs');
const path = require('path');
const { toMarkdownTable } = require('./export');
const { formatNumber } = require('./utils');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const REPORTS_DIR = path.join(__dirname, '..', 'reports');

// CatLab Tech is the default brand these market reports are sold under. Override
// any of this (name, tagline, contact, disclaimer) via report.config.json.
const DEFAULT_BRAND = {
  name: 'CatLab Tech',
  tagline: 'App Market Intelligence',
  contact: 'research@catlabtech.example',
};

const DEFAULT_DISCLAIMER =
  'Figures are drawn from public Google Play and Apple App Store listings via the '
  + 'google-play-scraper and app-store-scraper libraries, captured at the time this '
  + 'report was generated. Store metrics (install bands, ratings, review counts) are '
  + 'approximate and change over time. Pain points and feature requests are derived '
  + 'from automated review-text mining and should be read as directional signal, not '
  + 'ground truth. This is independent research, not affiliated with or endorsed by '
  + 'Google or Apple.';

// Turn a free-text topic into a filesystem-safe report slug (hyphenated).
function slugify(topic) {
  return String(topic || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'market';
}

// Competitor-table columns (a curated subset of the app shape, pre-formatted).
const COMPETITOR_COLUMNS = [
  { key: 'title', header: 'App' },
  { key: 'developer', header: 'Developer' },
  { key: 'store', header: 'Store' },
  { key: 'market', header: 'Market' },
  { key: 'score', header: 'Rating' },
  { key: 'reviews', header: 'Reviews' },
  { key: 'installs', header: 'Installs' },
];

const AGG_PAIN_COLUMNS = [
  { key: 'issue', header: 'Pain point' },
  { key: 'mentions', header: 'Total mentions' },
  { key: 'apps', header: 'Apps affected' },
];

const roundScore = (s) => (typeof s === 'number' ? Math.round(s * 100) / 100 : s);

// Build the competitor table rows from a discover report's apps.
function competitorRows(apps, limit = 20) {
  return apps.slice(0, limit).map((app) => ({
    title: app.title,
    developer: app.developer,
    store: app.store,
    market: app.market,
    score: roundScore(app.score),
    reviews: app.reviews,
    installs: app.installsFormatted
      || (typeof app.installs === 'number' ? `${formatNumber(app.installs)}+` : '—'),
  }));
}

// Aggregate pain points across every analyzed competitor into a ranked table.
function aggregatePainPoints(analyses) {
  const byIssue = {};
  for (const a of analyses) {
    for (const pp of a.painPoints || []) {
      const entry = byIssue[pp.issue] || (byIssue[pp.issue] = { issue: pp.issue, mentions: 0, apps: 0 });
      entry.mentions += pp.mentions || 0;
      entry.apps += 1;
    }
  }
  return Object.values(byIssue).sort((x, y) => y.mentions - x.mentions);
}

// Collect distinct feature requests across analyses (first-seen order).
function aggregateFeatureRequests(analyses, limit = 12) {
  const seen = new Set();
  const requests = [];
  for (const a of analyses) {
    for (const fr of a.featureRequests || []) {
      const text = (fr.request || '').trim();
      const dedupeKey = text.toLowerCase();
      if (text && !seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        requests.push(text);
        if (requests.length >= limit) return requests;
      }
    }
  }
  return requests;
}

function marketOverviewLines(discover) {
  if (!discover || !discover.apps || !discover.apps.length) {
    return ['_No discovery dataset supplied for this report._'];
  }
  const apps = discover.apps;
  const scores = apps.map((a) => a.score).filter((s) => typeof s === 'number');
  const reviews = apps.map((a) => a.reviews).filter((r) => typeof r === 'number');
  const markets = discover.markets || [...new Set(apps.map((a) => a.market))];
  const lines = [
    `- **Search focus:** "${discover.query || 'n/a'}"`,
    `- **Markets scanned:** ${markets.join(', ') || 'n/a'}`,
    `- **Niche apps identified:** ${discover.totalFound != null ? discover.totalFound : apps.length}`
      + ` (Google Play: ${discover.googlePlay != null ? discover.googlePlay : '—'},`
      + ` App Store: ${discover.appStore != null ? discover.appStore : '—'})`,
  ];
  if (scores.length) {
    lines.push(`- **Rating range:** ${roundScore(Math.min(...scores))}–${roundScore(Math.max(...scores))} ★`);
  }
  if (reviews.length) {
    lines.push(`- **Review-count range:** ${Math.min(...reviews)}–${Math.max(...reviews)}`);
  }
  return lines;
}

// PURE: render a full, branded, client-ready market report as Markdown.
// `discover` is a discover report object (or null); `analyses` is an array of
// analyze report objects (may be empty).
function buildMarketReport({
  topic,
  category,
  brand = DEFAULT_BRAND,
  date = new Date().toISOString().slice(0, 10),
  discover = null,
  analyses = [],
  disclaimer = DEFAULT_DISCLAIMER,
} = {}) {
  const b = { ...DEFAULT_BRAND, ...brand };
  const heading = `${topic} — Market Research Report`;
  const lines = [];

  // --- Branded header ---
  lines.push(`# ${heading}`);
  lines.push('');
  lines.push(`**Prepared by ${b.name}** — ${b.tagline}`);
  lines.push('');
  lines.push(`**Report date:** ${date}${category ? `  |  **Category:** ${category}` : ''}`);
  lines.push('');
  lines.push(`> **Data-source disclaimer.** ${disclaimer}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // --- 1. Market overview ---
  lines.push('## 1. Market Overview');
  lines.push('');
  lines.push(...marketOverviewLines(discover));
  lines.push('');

  // --- 2. Competitor landscape ---
  lines.push('## 2. Competitor Landscape');
  lines.push('');
  if (discover && discover.apps && discover.apps.length) {
    lines.push(toMarkdownTable(competitorRows(discover.apps), COMPETITOR_COLUMNS));
  } else {
    lines.push('_No competitor dataset supplied for this report._');
  }
  lines.push('');

  // --- 3. Ratings & review analysis ---
  lines.push('## 3. Ratings & Review Analysis');
  lines.push('');
  if (analyses.length) {
    for (const a of analyses) {
      const app = a.app || {};
      const an = a.analysis || {};
      lines.push(`### ${app.title || app.appId || 'Unknown app'}`);
      lines.push('');
      lines.push(`- **Store:** ${app.store || 'n/a'}  |  **Rating:** ★${roundScore(app.score)}`
        + `  |  **Total reviews:** ${app.reviews != null ? app.reviews : 'n/a'}`);
      if (an.totalReviewsFetched != null) {
        lines.push(`- **Reviews analyzed:** ${an.totalReviewsFetched}`
          + ` — ${an.negative ? `${an.negative.count} negative (${an.negative.percentage}%)` : ''}`
          + `${an.positive ? `, ${an.positive.count} positive (${an.positive.percentage}%)` : ''}`);
      }
      if (app.ratings) {
        lines.push(`- **All-time rating mix:** ${app.ratings.negativeShare}% low (1–2★),`
          + ` ${app.ratings.oneStarShare}% one-star (of ${app.ratings.total} ratings)`);
      }
      lines.push('');
      if (a.painPoints && a.painPoints.length) {
        lines.push('**Top pain points**');
        lines.push('');
        lines.push(toMarkdownTable(
          a.painPoints.slice(0, 8).map((pp) => ({ issue: pp.issue, mentions: pp.mentions, severity: pp.severity })),
          [
            { key: 'issue', header: 'Issue' },
            { key: 'mentions', header: 'Mentions' },
            { key: 'severity', header: 'Severity' },
          ]
        ));
        lines.push('');
      }
      if (a.featureRequests && a.featureRequests.length) {
        lines.push('**Feature requests**');
        lines.push('');
        for (const fr of a.featureRequests.slice(0, 6)) lines.push(`- "${fr.request}"`);
        lines.push('');
      }
    }
  } else {
    lines.push('_No review analyses supplied for this report._');
    lines.push('');
  }

  // --- 4. Opportunities ---
  lines.push('## 4. Opportunities');
  lines.push('');
  const aggPain = aggregatePainPoints(analyses);
  const aggRequests = aggregateFeatureRequests(analyses);
  if (aggPain.length) {
    lines.push('**Recurring weaknesses to out-build** (aggregated across analyzed competitors):');
    lines.push('');
    lines.push(toMarkdownTable(aggPain.slice(0, 10), AGG_PAIN_COLUMNS));
    lines.push('');
  }
  if (aggRequests.length) {
    lines.push('**Most-requested features** (unmet demand voiced in reviews):');
    lines.push('');
    for (const req of aggRequests) lines.push(`- ${req}`);
    lines.push('');
  }
  if (!aggPain.length && !aggRequests.length) {
    lines.push('_Run `analyze` on the leading competitors to populate this section._');
    lines.push('');
  }

  // --- Branded footer ---
  lines.push('---');
  lines.push('');
  lines.push(`*${heading} — © ${new Date(date).getFullYear()} ${b.name}. ${b.tagline}.*`);
  lines.push(`*Generated ${date} · Contact: ${b.contact} · Confidential — prepared for the recipient only.*`);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Command wiring: gather source JSON from output/ and write the report.
// ---------------------------------------------------------------------------

function loadReportConfig() {
  const candidate = process.env.APP_SCOUT_REPORT_CONFIG
    || path.join(process.cwd(), 'report.config.json');
  try {
    if (fs.existsSync(candidate)) return JSON.parse(fs.readFileSync(candidate, 'utf-8'));
  } catch (err) {
    console.error(`Warning: ignoring report config ${candidate}: ${err.message}`);
  }
  return {};
}

function loadJsonSafe(file, baseDir = OUTPUT_DIR) {
  const target = path.isAbsolute(file) ? file : path.join(baseDir, file);
  try {
    return JSON.parse(fs.readFileSync(target, 'utf-8'));
  } catch (err) {
    console.error(`Warning: could not read ${target}: ${err.message}`);
    return null;
  }
}

// Newest discover-*.json in output/ whose slug matches the topic, or null.
function findDiscoverFile(topic) {
  const prefix = `discover-${String(topic).replace(/[^a-zA-Z0-9_-]/g, '_')}-`;
  if (!fs.existsSync(OUTPUT_DIR)) return null;
  const matches = fs.readdirSync(OUTPUT_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .sort();
  return matches.length ? matches[matches.length - 1] : null;
}

function saveReport(slug, date, markdown) {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const filename = path.basename(`market-report-${slug}-${date}.md`);
  const filepath = path.join(REPORTS_DIR, filename);
  fs.writeFileSync(filepath, markdown, 'utf-8');
  console.log(`Saved: ${filepath}`);
  return filepath;
}

// Generate a branded market report from existing output/ JSON.
// One command: `node src/index.js report "<topic>" [--category=...] [--discover=file] [--analyze=f1,f2]`
// Sources may also be pinned in report.config.json (see report.config.example.json).
function report(topic, options = {}) {
  const cfg = loadReportConfig();
  const resolvedTopic = topic || cfg.topic;
  if (!resolvedTopic) {
    console.error('Error: a report topic is required. Example: node src/index.js report "sleep tracker" --category="Health & Fitness"');
    process.exit(1);
  }

  const category = options.category || cfg.category;
  const date = options.date || new Date().toISOString().slice(0, 10);
  const brand = { ...DEFAULT_BRAND, ...cfg.brand };
  const disclaimer = cfg.disclaimer || DEFAULT_DISCLAIMER;

  // Discovery dataset: explicit flag > config > auto-match by topic slug.
  const discoverFile = options.discover || cfg.discover || findDiscoverFile(resolvedTopic);
  const discover = discoverFile ? loadJsonSafe(discoverFile) : null;
  if (discoverFile && discover) console.log(`Using discovery data: ${discoverFile}`);
  else if (!discoverFile) console.log('No matching discover-*.json found — overview/competitor sections will be sparse.');

  // Review analyses: explicit flag > config list.
  const analyzeFiles = options.analyze || cfg.analyses || [];
  const analyses = analyzeFiles.map((f) => loadJsonSafe(f)).filter(Boolean);
  if (analyzeFiles.length) console.log(`Using ${analyses.length}/${analyzeFiles.length} review analyses`);

  const markdown = buildMarketReport({
    topic: resolvedTopic,
    category,
    brand,
    date,
    discover,
    analyses,
    disclaimer,
  });

  const filepath = saveReport(slugify(resolvedTopic), date, markdown);
  return { filepath, markdown, sources: { discover: discoverFile || null, analyses: analyzeFiles } };
}

module.exports = {
  report,
  buildMarketReport,
  slugify,
  competitorRows,
  aggregatePainPoints,
  aggregateFeatureRequests,
  DEFAULT_BRAND,
  DEFAULT_DISCLAIMER,
};
