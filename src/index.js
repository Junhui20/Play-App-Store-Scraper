#!/usr/bin/env node
const { discover } = require('./discover');
const { analyze } = require('./analyze');
const { compareMarkets } = require('./compare');
const { list, printOptions } = require('./listing');
const { similar } = require('./similar');
const { suggest } = require('./suggest');
const { track } = require('./track');
const { score } = require('./score');
const { FOREIGN_MARKETS, LOCAL_MARKET } = require('./config');

const HELP = `
App Market Research Tool
========================

Usage:
  node src/index.js <command> [options]

Commands:
  list [collection] [category]  Browse apps by collection/category listing
  discover <keywords>           Find niche apps (low installs, high rating) across foreign markets
  analyze <appId>               Analyze reviews of an app to find pain points & feature requests
  compare <keywords>            Find apps popular abroad but missing in your local market
  similar <appId>               Find apps similar to a seed app (build a competitor set)
  suggest <keywords>            Expand a keyword into store autocomplete suggestions
  track <appId>                 Record a snapshot & show review/rating changes since last check
  score <keyword>               Estimate a keyword's difficulty, traffic & opportunity score
  options                       Show all available collections & categories

Options:
  --store=gplay|appstore|both   Target store (default: both for list/discover, gplay for analyze/compare)
  --market=us|gb|jp|...         Market code (default: us)
  --local=my|sg|tw|...          Local market code for compare (default: ${LOCAL_MARKET.code})
  --markets=us,jp,kr            Discover across several markets at once (comma-separated)
  --num=N                       Number of apps to fetch (default: discover 50, compare 30, list 60)
  --reviews=N                   Number of reviews to fetch for analyze (default: 500)
  --lang=en|ja|...              Review language for analyze (default: en)
  --niche                       Apply niche filter (low installs + high rating)
  --format=csv|md|all           Also write a CSV / Markdown export (JSON is always saved)
  --max-installs=N              Override niche filter: max installs (discover/list)
  --min-score=N                 Override niche filter: min rating (discover/list)
  --min-reviews=N               Override niche filter: min reviews (discover/list)
  --max-reviews=N               Override niche filter: max reviews (discover/list)

Config file (optional):
  Create app-scout.config.json (or set $APP_SCOUT_CONFIG) to override markets,
  filters, and rate limits without editing source. See app-scout.config.example.json.

Collections (Google Play):
  TOP_FREE, TOP_PAID, GROSSING

Collections (App Store):
  NEW_IOS, NEW_FREE_IOS, NEW_PAID_IOS,
  TOP_FREE_IOS, TOP_PAID_IOS, TOP_GROSSING_IOS

Categories (common):
  PRODUCTIVITY, HEALTH_AND_FITNESS, FINANCE, EDUCATION, LIFESTYLE,
  FOOD_AND_DRINK, TOOLS, BUSINESS, SOCIAL, ENTERTAINMENT, ...
  (run "node src/index.js options" to see all)

Examples:
  node src/index.js list TOP_FREE PRODUCTIVITY --market=us
  node src/index.js list NEW_IOS --store=appstore --market=us
  node src/index.js list TOP_FREE HEALTH_AND_FITNESS --niche --market=jp
  node src/index.js list GROSSING FINANCE --store=gplay --market=gb
  node src/index.js discover "habit tracker"
  node src/index.js analyze com.todoist --store=gplay
  node src/index.js compare "meal prep" --market=us --local=my
  node src/index.js similar com.todoist --store=gplay
  node src/index.js suggest "habit tracker"
  node src/index.js track com.todoist --store=gplay
  node src/index.js score "sleep tracker" --store=appstore
`;

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0];
  const positional = [];
  const flags = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const [key, val] = args[i].slice(2).split('=');
      flags[key] = val || true;
    } else {
      positional.push(args[i]);
    }
  }

  return { command, positional, flags };
}

function findMarket(code) {
  return (
    FOREIGN_MARKETS.find((m) => m.code === code) ||
    { code, name: code.toUpperCase(), lang: 'en' }
  );
}

// Coerce a flag value to an integer, or undefined when the flag is absent.
function toInt(value) {
  return value ? Number(value) : undefined;
}

// Exit with a helpful message when a required positional argument is missing.
function requireArg(value, errorMessage) {
  if (!value) {
    console.error(errorMessage);
    process.exit(1);
  }
  return value;
}

// Normalize --format to one of: undefined | 'csv' | 'md' | 'all'.
// JSON is always written; this only controls the extra exports.
function parseFormat(flags) {
  const f = flags.format ? String(flags.format).toLowerCase() : '';
  return ['csv', 'md', 'all'].includes(f) ? f : undefined;
}

// Build a partial DISCOVER_FILTERS override from CLI flags (only provided keys).
function parseFilters(flags) {
  const filters = {};
  if (flags['max-installs'] !== undefined) filters.maxInstalls = Number(flags['max-installs']);
  if (flags['min-score'] !== undefined) filters.minScore = Number(flags['min-score']);
  if (flags['min-reviews'] !== undefined) filters.minReviews = Number(flags['min-reviews']);
  if (flags['max-reviews'] !== undefined) filters.maxReviews = Number(flags['max-reviews']);
  return Object.keys(filters).length ? filters : undefined;
}

// Markets for discover: --markets=us,jp,kr (comma list) or a single --market.
function parseMarkets(flags) {
  if (flags.markets) {
    return String(flags.markets).split(',').map((c) => findMarket(c.trim()));
  }
  if (flags.market) {
    return [findMarket(flags.market)];
  }
  return undefined;
}

// One entry per command. Per-command defaults (which store, which flags) are
// visible here in a single table instead of buried across switch cases.
const COMMANDS = {
  list: (positional, flags) => list({
    collection: positional[0] || 'TOP_FREE',
    category: positional[1] || undefined,
    store: flags.store || 'both',
    market: findMarket(flags.market || 'us'),
    num: toInt(flags.num),
    niche: flags.niche === true,
    filters: parseFilters(flags),
    format: parseFormat(flags),
  }),

  options: () => printOptions(),

  discover: (positional, flags) => discover(
    requireArg(positional.join(' '), 'Error: keywords required. Example: node src/index.js discover "habit tracker"'),
    {
      store: flags.store || 'both',
      num: toInt(flags.num),
      markets: parseMarkets(flags),
      filters: parseFilters(flags),
      format: parseFormat(flags),
    }
  ),

  analyze: (positional, flags) => analyze(
    requireArg(positional.join(' '), 'Error: appId required. Example: node src/index.js analyze com.todoist'),
    {
      store: flags.store || 'gplay',
      num: toInt(flags.reviews),
      country: flags.market || 'us',
      lang: flags.lang || 'en',
      format: parseFormat(flags),
    }
  ),

  compare: (positional, flags) => compareMarkets(
    requireArg(positional.join(' '), 'Error: keywords required. Example: node src/index.js compare "meal prep"'),
    {
      store: flags.store || 'gplay',
      foreignMarket: findMarket(flags.market || 'us'),
      localMarket: findMarket(flags.local || LOCAL_MARKET.code),
      num: toInt(flags.num),
      format: parseFormat(flags),
    }
  ),

  similar: (positional, flags) => similar(
    requireArg(positional.join(' '), 'Error: appId required. Example: node src/index.js similar com.todoist'),
    {
      store: flags.store || 'gplay',
      market: findMarket(flags.market || 'us'),
      num: toInt(flags.num),
      format: parseFormat(flags),
    }
  ),

  suggest: (positional, flags) => suggest(
    requireArg(positional.join(' '), 'Error: keywords required. Example: node src/index.js suggest "habit tracker"'),
    { store: flags.store || 'both' }
  ),

  track: (positional, flags) => track(
    requireArg(positional.join(' '), 'Error: appId required. Example: node src/index.js track com.todoist'),
    {
      store: flags.store || 'gplay',
      market: findMarket(flags.market || 'us'),
    }
  ),

  score: (positional, flags) => score(
    requireArg(positional.join(' '), 'Error: keywords required. Example: node src/index.js score "sleep tracker"'),
    {
      store: flags.store || 'gplay',
      market: findMarket(flags.market || 'us'),
      num: toInt(flags.num),
    }
  ),
};

async function main() {
  const { command, positional, flags } = parseArgs(process.argv);

  if (!command || command === 'help' || command === '--help') {
    console.log(HELP);
    return;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    console.log(HELP);
    process.exit(1);
  }

  try {
    await handler(positional, flags);
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  }
}

main();
