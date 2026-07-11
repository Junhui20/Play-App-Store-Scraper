# Play App Store Scraper

> Find niche app ideas with little competition by mining **Google Play** and the
> **Apple App Store** — then read the reviews to see exactly what users are begging for.

[![CI](https://github.com/Junhui20/Play-App-Store-Scraper/actions/workflows/ci.yml/badge.svg)](https://github.com/Junhui20/Play-App-Store-Scraper/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![License](https://img.shields.io/badge/license-ISC-blue)

A small, dependency-light Node.js CLI for solo developers and indie hackers doing
app market research. It discovers under-served "niche gems", mines competitor
reviews into ranked pain points and feature requests, and finds apps that are
popular abroad but missing in your local market.

## What it does

| Command | What it gives you |
|---------|-------------------|
| `discover <keywords>` | Niche gems across 8 markets — low installs **and** a high rating |
| `analyze <appId>` | Up to 500 reviews mined into pain points + feature requests, plus the true 1–5★ ratings split |
| `compare <keywords>` | Apps big in a foreign market but absent/under-served locally |
| `similar <appId>` | Apps similar to a seed app — build a competitor set without hunting for IDs |
| `suggest <keywords>` | Expand a seed keyword into store autocomplete suggestions |
| `track <appId>` | Snapshot an app's rating/reviews/version and report what changed since your last check |
| `score <keyword>` | Estimate a keyword's difficulty, traffic & an opportunity score from public data |
| `report <topic>` | Assemble discover + analyze data into a branded, client-ready Markdown market report |
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

# Build a competitor set from one seed app, and expand your keyword list
node src/index.js similar com.todoist --store=gplay
node src/index.js suggest "habit tracker"

# Track an app over time — run periodically to see review velocity & rating drift
node src/index.js track com.todoist --store=gplay

# Estimate how worth-targeting a keyword is (difficulty / traffic / opportunity)
node src/index.js score "sleep tracker" --store=appstore
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

## Keyword scoring

`score <keyword>` estimates how worth-targeting a search term is, computed in-house
from public search results + autocomplete (no paid ASO data, no extra dependencies):

- **Difficulty** (0–10) — how entrenched the top results are (keyword-in-title matches + avg reviews). Lower = easier to rank.
- **Traffic** (0–10) — a demand proxy from autocomplete breadth + top-app popularity. Higher = more searches.
- **Opportunity** (0–10) — `traffic × (10 − difficulty) / 10`: high demand with low competition.

Add `--expand` to expand the seed into its autocomplete variants, score each, and
rank them by opportunity — and `--format=csv|md` to export the ranked table:

```bash
node src/index.js score "sleep tracker" --store=appstore --expand --format=md
```

These are transparent heuristics, not ground-truth ASO metrics — use them to **rank and compare** terms, not as absolute values.

## Client-ready market reports

`report` turns raw scrape output into a **branded, one-file deliverable** — the
kind you can hand to a client. It reads existing JSON from `output/` (so it never
re-scrapes) and renders a Markdown report with a consistent structure:

1. **Branded header** — brand name, tagline, report date, category, and a
   data-source disclaimer.
2. **Market Overview** — markets scanned, niche apps found, rating/review ranges.
3. **Competitor Landscape** — a table of the discovered apps (rating, reviews, installs).
4. **Ratings & Review Analysis** — per competitor: rating mix, pain-point table, feature requests.
5. **Opportunities** — pain points and feature requests aggregated across all analyzed
   competitors (the gaps to out-build).
6. **Branded footer** — copyright, contact, confidentiality line.

### One command

```bash
# Auto-mode: finds the newest matching discover-*.json in output/ for the topic.
node src/index.js report "sleep tracker" --category="Health & Fitness"

# Pin exact source files:
node src/index.js report "Sleep Tracker & Sounds" \
  --category="Health & Fitness" \
  --discover=discover-sleep_tracker-2026-03-25-05-59-31.json \
  --analyze=analyze-com_sleepjar_android-2026-03-25-06-04-23.json,analyze-com_apirox_sleeprecorder-2026-03-25-06-03-34.json
```

The report is written to `reports/market-report-<slug>-<YYYY-MM-DD>.md`.

### Driving it from a config file (recommended for repeatable deliverables)

Drop a `report.config.json` in the working directory (or point
`$APP_SCOUT_REPORT_CONFIG` at one) to pin the brand, topic, category, disclaimer,
and exact source files — then regenerate any time with a bare `node src/index.js report`.
CLI flags override the config. See
[`report.config.example.json`](report.config.example.json):

```json
{
  "brand": { "name": "CatLab Tech", "tagline": "App Market Intelligence", "contact": "research@catlabtech.example" },
  "topic": "Sleep Tracker & Sounds",
  "category": "Health & Fitness",
  "discover": "discover-sleep_tracker-2026-03-25-05-59-31.json",
  "analyses": ["analyze-com_sleepjar_android-2026-03-25-06-04-23.json"]
}
```

```bash
APP_SCOUT_REPORT_CONFIG=report.config.json node src/index.js report
```

Brand defaults to **CatLab Tech** if no config is present.

## Continuous competitor monitoring (`track` + snapshots)

Each `track` run appends a **dated snapshot** (rating, review count, install band,
and app version) to `.app-scout-history.json` and prints a **change diff** against
the previous snapshot — new version released, rating moved, install band changed,
review-count jump:

```bash
node src/index.js track com.todoist --store=gplay
# Todoist: To-Do List & Planner (v1234.5)
#   ★4.6 | 512340 reviews | 10000000+ installs
#   Since last check (7d ago): reviews +1240, rating +0.0
#   Changes detected:
#     • New version released: 1233.0 → 1234.5
#     • Review count +1240 (511100 → 512340)
#   History: 6 snapshot(s) recorded
```

Snapshots live in `.app-scout-history.json` at the project root (git-ignored so
your trend data survives `output/` wipes). Override the location with
`$APP_SCOUT_HISTORY`.

### Scheduling it (cron)

To sell "continuous monitoring", run `track` on a schedule. Add a cron entry with
`crontab -e` (this repo does **not** install any cron job for you):

```cron
# Snapshot three competitors every day at 08:00, logging to a file.
0 8 * * * cd /path/to/Play-App-Store-Scraper && \
  /usr/bin/node src/index.js track com.todoist --store=gplay >> track.log 2>&1
0 8 * * * cd /path/to/Play-App-Store-Scraper && \
  /usr/bin/node src/index.js track com.ticktick.task --store=gplay >> track.log 2>&1
```

Run from a residential/normal IP — Google Play blocks scraping from datacenter IPs
(see the note below). Each run is idempotent per day: it just appends one more
snapshot, so the history grows into a trend you can chart or diff.

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
  track.js      dated snapshots + change detection for continuous monitoring
  history.js    snapshot storage + pure delta/change-detection helpers
  report.js     branded client-ready market-report generator
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
