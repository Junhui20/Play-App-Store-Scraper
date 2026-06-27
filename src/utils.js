const fs = require('fs');
const path = require('path');
const { THEME_PATTERNS } = require('./taxonomy');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

// Make a user-supplied string safe to use as one filename segment.
// Strips path separators, "..", and anything outside a conservative allow-list
// so caller input (search terms, market codes, collections) can't traverse dirs.
function safeSegment(str) {
  return String(str == null ? '' : str).replace(/[^a-zA-Z0-9_-]/g, '_');
}

// basename() drops any directory parts a crafted name might carry, and we then
// assert the resolved path stays inside OUTPUT_DIR (defense in depth).
function resolveOutputPath(filename) {
  const safeName = path.basename(filename);
  const filepath = path.resolve(OUTPUT_DIR, safeName);
  if (filepath !== path.join(path.resolve(OUTPUT_DIR), safeName)) {
    throw new Error(`Refusing to write outside output directory: ${filename}`);
  }
  return filepath;
}

function saveJson(filename, data) {
  ensureOutputDir();
  const filepath = resolveOutputPath(filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Saved: ${filepath}`);
  return filepath;
}

// Like saveJson, but writes raw text (used for CSV / Markdown exports).
function saveText(filename, content) {
  ensureOutputDir();
  const filepath = resolveOutputPath(filename);
  fs.writeFileSync(filepath, content, 'utf-8');
  console.log(`Saved: ${filepath}`);
  return filepath;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatNumber(num) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}

// part/total as a 1-decimal percentage string, guarding total === 0
// (which would otherwise produce "NaN" when an app returns no reviews).
function percentage(part, total) {
  if (!total) return '0.0';
  return ((part / total) * 100).toFixed(1);
}

function timestamp() {
  return new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
}

// Extract common keywords from review texts
function extractKeywords(reviews) {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'it', 'to', 'and', 'of', 'in', 'for',
    'on', 'with', 'this', 'that', 'but', 'not', 'are', 'was', 'be',
    'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'can', 'i', 'me', 'my', 'we', 'you', 'your',
    'they', 'them', 'their', 'its', 'so', 'if', 'or', 'as', 'at',
    'by', 'from', 'up', 'out', 'no', 'just', 'very', 'too', 'also',
    'app', 'really', 'like', 'get', 'got', 'one', 'use', 'using',
    'good', 'great', 'bad', 'much', 'more', 'been', 'when', 'what',
    'how', 'all', 'about', 'there', 'than', 'some', 'even', 'don\'t',
    'doesn\'t', 'didn\'t', 'won\'t', 'can\'t', 'couldn\'t', 'wouldn\'t',
    'only', 'still', 'now', 'then', 'here', 'am', 'were', 'being',
  ]);

  const wordCounts = {};
  for (const review of reviews) {
    const text = (review.text || '').toLowerCase();
    const words = text.split(/\s+/)
      .map((w) => w.replace(/[^a-z]/g, ''))
      .filter((w) => w.length > 2 && !stopWords.has(w));

    const seen = new Set();
    for (const word of words) {
      if (!seen.has(word)) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
        seen.add(word);
      }
    }
  }

  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word, count]) => ({ word, count }));
}

// Group reviews into themes based on common complaint/praise patterns
function extractThemes(reviews) {
  const themes = {};
  for (const [theme, regex] of Object.entries(THEME_PATTERNS)) {
    const matched = reviews.filter((r) => regex.test(r.text || ''));
    if (matched.length > 0) {
      themes[theme] = {
        count: matched.length,
        percentage: percentage(matched.length, reviews.length),
        samples: matched.slice(0, 3).map((r) => ({
          score: r.score,
          text: (r.text || '').slice(0, 200),
        })),
      };
    }
  }

  return Object.fromEntries(
    Object.entries(themes).sort((a, b) => b[1].count - a[1].count)
  );
}

module.exports = {
  saveJson,
  saveText,
  safeSegment,
  delay,
  formatNumber,
  percentage,
  timestamp,
  extractKeywords,
  extractThemes,
};
