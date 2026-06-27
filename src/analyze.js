const gplay = require('google-play-scraper').default || require('google-play-scraper');
const store = require('app-store-scraper').default || require('app-store-scraper');
const { REVIEW_SETTINGS, RATE_LIMIT_MS, SEVERITY } = require('./config');
const { saveJson, safeSegment, delay, percentage, ratingsSummary, timestamp, extractKeywords, extractThemes } = require('./utils');
const { PAIN_POINT_PATTERNS, FEATURE_REQUEST_PATTERNS } = require('./taxonomy');
const { writeAnalysisExports } = require('./export');

// Fetch and analyze reviews from Google Play
async function analyzeGooglePlay(appId, options = {}) {
  const numReviews = options.num || REVIEW_SETTINGS.numReviews;

  console.log(`\n[Google Play] Fetching app details for: ${appId}`);
  const appDetail = await gplay.app({ appId });

  console.log(`  ${appDetail.title} by ${appDetail.developer}`);
  console.log(`  ★${appDetail.score} | ${appDetail.reviews} reviews | ${appDetail.minInstalls}+ installs`);

  console.log(`\n  Fetching ${numReviews} reviews...`);
  const { data: reviews } = await gplay.reviews({
    appId,
    sort: gplay.sort.NEWEST,
    num: numReviews,
    lang: options.lang || 'en',
    country: options.country || 'us',
  });

  console.log(`  Got ${reviews.length} reviews`);
  return buildReport(appDetail, reviews, 'google-play');
}

// Fetch and analyze reviews from App Store
async function analyzeAppStore(appId, options = {}) {
  // Numeric arg -> iTunes track id; otherwise treat it as a bundle id.
  const isNumericId = /^\d+$/.test(appId);
  const query = isNumericId ? { id: Number(appId) } : { appId };

  console.log(`\n[App Store] Fetching app details for: ${appId}`);
  const appDetail = await store.app(query);

  console.log(`  ${appDetail.title} by ${appDetail.developer}`);
  console.log(`  ★${appDetail.score} | ${appDetail.reviews} reviews`);

  console.log(`\n  Fetching reviews...`);
  const reviews = await store.reviews({
    id: appDetail.id,
    sort: store.sort.RECENT,
    page: 1,
    country: options.country || 'us',
  });

  // App Store returns fewer reviews per page, fetch multiple pages
  const allReviews = [...reviews];
  const maxPages = options.pages || 5;

  for (let page = 2; page <= maxPages; page++) {
    try {
      await delay(RATE_LIMIT_MS);
      const moreReviews = await store.reviews({
        id: appDetail.id,
        sort: store.sort.RECENT,
        page,
        country: options.country || 'us',
      });
      if (moreReviews.length === 0) break;
      allReviews.push(...moreReviews);
    } catch {
      break;
    }
  }

  console.log(`  Got ${allReviews.length} reviews`);

  // Best-effort ratings histogram via a separate request — the ratings page is
  // flaky, so a failure here must not abort the analysis.
  let histogram;
  try {
    const r = await store.ratings({ id: appDetail.id, country: options.country || 'us' });
    histogram = r.histogram;
  } catch {
    // no histogram available
  }

  return buildReport(appDetail, allReviews, 'app-store', histogram);
}

function buildReport(appDetail, reviews, storeName, histogram = appDetail.histogram) {
  const negativeReviews = reviews.filter(
    (r) => r.score <= REVIEW_SETTINGS.lowRatingMax
  );
  const positiveReviews = reviews.filter(
    (r) => r.score >= REVIEW_SETTINGS.highRatingMin
  );

  const report = {
    app: {
      store: storeName,
      title: appDetail.title,
      appId: appDetail.appId,
      developer: appDetail.developer,
      score: appDetail.score,
      reviews: appDetail.reviews,
      installs: appDetail.minInstalls,
      category: appDetail.genre || appDetail.primaryGenre,
      url: appDetail.url,
      ratings: ratingsSummary(histogram),
    },
    analysis: {
      totalReviewsFetched: reviews.length,
      negative: {
        count: negativeReviews.length,
        percentage: percentage(negativeReviews.length, reviews.length),
        themes: extractThemes(negativeReviews),
        keywords: extractKeywords(negativeReviews),
      },
      positive: {
        count: positiveReviews.length,
        percentage: percentage(positiveReviews.length, reviews.length),
        themes: extractThemes(positiveReviews),
        keywords: extractKeywords(positiveReviews),
      },
    },
    painPoints: extractPainPoints(negativeReviews),
    featureRequests: extractFeatureRequests(reviews),
    timestamp: new Date().toISOString(),
  };

  return report;
}

// Extract specific pain points from negative reviews
function extractPainPoints(negativeReviews) {
  const painPoints = [];

  for (const { label, regex } of PAIN_POINT_PATTERNS) {
    const matched = negativeReviews.filter((r) => regex.test(r.text || ''));
    if (matched.length >= SEVERITY.minMentions) {
      painPoints.push({
        issue: label,
        mentions: matched.length,
        severity: matched.length >= SEVERITY.high ? 'high'
          : matched.length >= SEVERITY.medium ? 'medium' : 'low',
        examples: matched.slice(0, 3).map((r) => (r.text || '').slice(0, 250)),
      });
    }
  }

  return painPoints.sort((a, b) => b.mentions - a.mentions);
}

// Extract feature requests from all reviews
function extractFeatureRequests(reviews) {
  const requests = [];
  for (const review of reviews) {
    const text = review.text || '';
    for (const pattern of FEATURE_REQUEST_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        requests.push({
          request: match[1].trim().slice(0, 150),
          fullText: text.slice(0, 300),
          score: review.score,
        });
        break; // One match per review
      }
    }
  }

  return requests.slice(0, 20);
}

// Main analyze function
async function analyze(appId, options = {}) {
  const storeName = options.store || 'gplay';

  console.log(`\n=== Analyzing reviews for: ${appId} ===`);

  const report = storeName === 'appstore'
    ? await analyzeAppStore(appId, options)
    : await analyzeGooglePlay(appId, options);

  const base = `analyze-${safeSegment(appId)}-${timestamp()}`;
  saveJson(`${base}.json`, report);
  if (options.format) writeAnalysisExports(base, report, options.format);

  printAnalysisSummary(report);
  return report;
}

function printAnalysisSummary(report) {
  console.log(`\n=== Analysis Summary: ${report.app.title} ===`);
  console.log(`Reviews analyzed: ${report.analysis.totalReviewsFetched}`);
  console.log(`Negative: ${report.analysis.negative.count} (${report.analysis.negative.percentage}%)`);
  console.log(`Positive: ${report.analysis.positive.count} (${report.analysis.positive.percentage}%)`);

  if (report.app.ratings) {
    console.log(`Rating mix: ${report.app.ratings.negativeShare}% low (1-2★), ${report.app.ratings.oneStarShare}% are 1★ (of ${report.app.ratings.total} all-time ratings)`);
  }

  if (report.painPoints.length > 0) {
    console.log(`\nTop Pain Points:`);
    for (const pp of report.painPoints.slice(0, 5)) {
      console.log(`  [${pp.severity.toUpperCase()}] ${pp.issue}: ${pp.mentions} mentions`);
    }
  }

  if (report.featureRequests.length > 0) {
    console.log(`\nFeature Requests:`);
    for (const fr of report.featureRequests.slice(0, 5)) {
      console.log(`  - "${fr.request}"`);
    }
  }
}

module.exports = { analyze, analyzeGooglePlay, analyzeAppStore };
