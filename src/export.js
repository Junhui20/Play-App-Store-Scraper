// Dependency-free CSV and Markdown renderers, so the tool stays install-light
// (no json2csv / markdown-table packages). JSON is always written by the
// commands; these produce the optional --format=csv|md|all extras.
const { saveText } = require('./utils');

// Standard columns for an app row across discover/list/compare output.
const APP_COLUMNS = [
  { key: 'store', header: 'Store' },
  { key: 'title', header: 'Title' },
  { key: 'developer', header: 'Developer' },
  { key: 'score', header: 'Score' },
  { key: 'reviews', header: 'Reviews' },
  { key: 'installs', header: 'Installs' },
  { key: 'market', header: 'Market' },
  { key: 'category', header: 'Category' },
  { key: 'free', header: 'Free' },
  { key: 'price', header: 'Price' },
  { key: 'url', header: 'URL' },
];

// Columns for the analyze pain-point CSV.
const PAIN_COLUMNS = [
  { key: 'issue', header: 'Issue' },
  { key: 'mentions', header: 'Mentions' },
  { key: 'severity', header: 'Severity' },
];

function cell(value) {
  return value === undefined || value === null ? '' : String(value);
}

function csvEscape(value) {
  const s = cell(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows, columns) {
  const header = columns.map((c) => csvEscape(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => csvEscape(row[c.key])).join(','));
  return [header, ...lines].join('\n');
}

// Escape pipes and flatten newlines so a value stays inside one table cell.
function mdCell(value) {
  return cell(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function toMarkdownTable(rows, columns) {
  const header = `| ${columns.map((c) => c.header).join(' | ')} |`;
  const divider = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((c) => mdCell(row[c.key])).join(' | ')} |`);
  return [header, divider, ...body].join('\n');
}

// A readable Markdown report for an analyze result (the nested shape that
// doesn't fit a single table).
function analysisToMarkdown(report) {
  const { app, analysis } = report;
  const lines = [
    `# Review Analysis — ${app.title}`,
    '',
    `- **App:** ${app.title} by ${app.developer} (${app.store})`,
    `- **Rating:** ★${app.score}  |  **Total reviews:** ${app.reviews}`,
    `- **Analyzed:** ${analysis.totalReviewsFetched} reviews — `
      + `${analysis.negative.count} negative (${analysis.negative.percentage}%), `
      + `${analysis.positive.count} positive (${analysis.positive.percentage}%)`,
    '',
    '## Top pain points',
    '',
    report.painPoints.length
      ? toMarkdownTable(report.painPoints, PAIN_COLUMNS)
      : '_None detected._',
    '',
    '## Feature requests',
    '',
    report.featureRequests.length
      ? report.featureRequests.map((fr) => `- "${fr.request}"`).join('\n')
      : '_None detected._',
    '',
  ];
  return lines.join('\n');
}

// Write CSV/MD table exports for an app list, based on the --format value.
function writeAppExports(base, apps, format) {
  if (format === 'csv' || format === 'all') {
    saveText(`${base}.csv`, toCsv(apps, APP_COLUMNS));
  }
  if (format === 'md' || format === 'all') {
    saveText(`${base}.md`, toMarkdownTable(apps, APP_COLUMNS));
  }
}

// Write CSV (pain points) + Markdown (full report) exports for an analyze result.
function writeAnalysisExports(base, report, format) {
  if (format === 'csv' || format === 'all') {
    saveText(`${base}.csv`, toCsv(report.painPoints, PAIN_COLUMNS));
  }
  if (format === 'md' || format === 'all') {
    saveText(`${base}.md`, analysisToMarkdown(report));
  }
}

module.exports = {
  APP_COLUMNS,
  PAIN_COLUMNS,
  toCsv,
  toMarkdownTable,
  analysisToMarkdown,
  writeAppExports,
  writeAnalysisExports,
};
