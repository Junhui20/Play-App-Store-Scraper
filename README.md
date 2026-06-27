# Play App Store Scraper

> Find niche app ideas with little competition by mining **Google Play** and the
> **Apple App Store** — then read the reviews to see exactly what users are begging for.

A small, dependency-light Node.js CLI for solo developers and indie hackers doing
app market research. It discovers under-served "niche gems", mines competitor
reviews into ranked pain points and feature requests, and finds apps that are
popular abroad but missing in your local market.

## What it does

| Command | What it gives you |
|---------|-------------------|
| `discover <keywords>` | Niche gems across 8 markets — low installs **and** a high rating |
| `analyze <appId>` | Up to 500 reviews mined into ranked pain points + feature requests |
| `compare <keywords>` | Apps big in a foreign market but absent/under-served locally |
| `list [collection] [category]` | Browse top charts, optionally filtered to niche apps |
| `options` | List every available collection & category |

## Quickstart

```bash
git clone https://github.com/Junhui20/Play-App-Store-Scraper.git
cd Play-App-Store-Scraper
npm install

# Find niche habit-tracker apps on Google Play in the US
node src/index.js discover "habit tracker" --store=gplay --market=us

# Mine 500 reviews of a specific app for complaints + feature requests
node src/index.js analyze com.todoist --store=gplay

# Find sleep-app opportunities present in the US but not in Malaysia
node src/index.js compare "sleep tracker" --market=us --local=my
```

Every run prints a summary and saves a full JSON report to `output/`.

## Use it as a CLI (optional)

```bash
npm install -g .        # or: npm link
app-scout discover "meal planner" --market=jp
```

## Options

```
--store=gplay|appstore|both   Target store (default: both for list/discover, gplay for analyze/compare)
--market=us|gb|jp|...         Market code (default: us)
--markets=us,jp,kr            Discover across several markets at once (comma-separated)
--local=my|sg|tw|...          Local market for `compare` (default: my)
--num=N                       Apps to fetch (default: discover 50, compare 30, list 60)
--reviews=N                   Reviews to fetch for `analyze` (default: 500)
--lang=en|ja|...              Review language for `analyze` (default: en)
--niche                       Apply the niche filter (low installs + high rating)
--format=csv|md|all           Also save a CSV / Markdown export (JSON is always saved)
--max-installs / --min-score / --min-reviews / --max-reviews   Override niche thresholds for one run
```

## The "niche gem" filter

`discover` (and `list --niche`) keep only apps that look like an opportunity.
Tune the thresholds in `src/config.js`:

- installs ≤ 100,000   — small enough to compete with
- rating ≥ 4.0         — people like the concept
- 10 ≤ reviews ≤ 5,000 — validated demand, but not saturated

## Configuration

Everything tunable lives in `src/config.js`:

- `LOCAL_MARKET` — **change this to your region** (defaults to Malaysia / `my`); used by `compare`.
- `FOREIGN_MARKETS` — the 8 markets scanned by `discover`.
- `DISCOVER_FILTERS` — the niche thresholds above.
- `REVIEW_SETTINGS`, `FETCH_DEFAULTS`, `THROTTLE`, `RATE_LIMIT_MS` — fetch counts and rate limiting.

## Output & formats

Results are written to `output/` as timestamped JSON, e.g.
`output/analyze-com_todoist-2026-06-27-10-06-39.json`. This directory is
git-ignored — the data is regenerable and may contain scraped store content.

Add `--format` to also emit shareable exports alongside the JSON:

```bash
node src/index.js discover "sleep sounds" --store=appstore --format=all   # .json + .csv + .md table
node src/index.js analyze com.todoist --format=md                          # a Markdown review report
```

- `--format=csv` — a spreadsheet-ready table (discover/list/compare) or pain-points table (analyze)
- `--format=md`  — a Markdown table, or a formatted review report for `analyze`
- `--format=all` — both

## Config file (optional)

Instead of editing `src/config.js`, drop an `app-scout.config.json` in the working
directory (or point `$APP_SCOUT_CONFIG` at one) to override markets, filters, and
rate limits. Every key is optional — omitted keys keep their defaults. See
[`app-scout.config.example.json`](app-scout.config.example.json):

```json
{
  "localMarket": { "code": "sg", "name": "Singapore", "lang": "en" },
  "discoverFilters": { "maxInstalls": 50000, "minScore": 4.2 },
  "throttle": 5
}
```

## Project layout

```
src/
  index.js      CLI entry + command dispatch table
  discover.js   niche-gem discovery
  analyze.js    review mining (pain points + feature requests)
  compare.js    cross-market gap analysis
  listing.js    top-chart listing
  normalize.js  single source of truth for the saved app shape + niche filter
  taxonomy.js   review-mining category patterns
  config.js     all tunable thresholds, markets, defaults
  utils.js      file I/O + text helpers
tests/          Jest unit tests (run: npm test)
```

## Development

```bash
npm test            # Jest with coverage
npm run test:watch
```

## ⚠️ Legal & dependency notes

- **Store Terms of Service.** This tool reads public listing/review data via
  `google-play-scraper` and `app-store-scraper`. Scraping and redistributing
  store content may violate Google Play / Apple App Store Terms. You are
  responsible for how you use it — don't republish harvested data.
- **Known advisories.** `app-store-scraper` depends on the deprecated `request`
  library, which carries known CVEs (surfaced by `npm audit`). They are not
  reachable through this tool's own inputs (it only calls Apple's fixed hosts),
  but be aware of them.
- **Google Play search from datacenter IPs.** Google often blocks Play *search*
  from cloud/datacenter IPs (returns empty results with no error). Run from a
  normal/residential connection if `discover --store=gplay` finds nothing — the
  App Store path is unaffected.

## License

ISC — see [LICENSE](LICENSE).
