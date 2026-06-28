# Play_App_Store_Scraper

## Project Overview
A Node.js CLI for app market research: discover niche apps on Google Play and the
Apple App Store, mine their reviews into pain points & feature requests, and find
cross-market gaps. See README.md for full usage.

## Tech Stack
Node.js (CommonJS); `google-play-scraper` + `app-store-scraper`; Jest for tests.

## Build & Test
- Install: `npm install`
- Test: `npm test` (Jest with coverage)
- Watch tests: `npm run test:watch`
- Run a command: `node src/index.js <discover|analyze|compare|list|options> [args]`
  (or via npm scripts, e.g. `npm run discover -- "habit tracker"`)
- There is no build step or dev server.

## Architecture
- `src/index.js` — CLI arg parsing + a command-dispatch table.
- `src/discover.js` / `analyze.js` / `compare.js` / `listing.js` / `similar.js` / `suggest.js` / `track.js` / `score.js` — the commands.
- `src/normalize.js` — single source of truth for the saved app shape + niche filter.
- `src/export.js` — dependency-free CSV / Markdown renderers for `--format`.
- `src/history.js` — cross-run metric history + pure delta helpers for `track`.
- `src/score.js` — in-house keyword difficulty/traffic/opportunity heuristics (pure `computeScores`).
- `src/taxonomy.js` — review-mining regex categories (themes / pain points / feature requests).
- `src/config.js` — all tunable thresholds, markets, defaults, rate limits.
- `src/utils.js` — file I/O (`saveJson`, `safeSegment`) and text helpers (`extractKeywords`, `extractThemes`, `percentage`).
- `output/` — git-ignored JSON results. `tests/` — Jest unit tests with mocked scrapers.

## Conventions
- Each command: build a report object → `saveJson(timestamped name)` → print a summary.
- Per-market scraping is wrapped in try/catch so one failure doesn't abort a run.
- User-supplied filename parts go through `safeSegment()`; `saveJson` is contained to `output/`.
- Tunables belong in `config.js`; review categories in `taxonomy.js` — don't inline new magic numbers or regex tables.
