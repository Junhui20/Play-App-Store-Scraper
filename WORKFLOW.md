# App Development Workflow — Multi-Agent Prompts

Reusable prompt chain for researching, planning, and building Flutter apps.
Each phase is a standalone prompt you can paste into a separate Claude Code agent.

---

## Phase 1: Market Research

> **Agent 1** — Run in Play_App_Store_Scraper project directory

```
I want you to research the market for "[YOUR KEYWORD]" apps.

Using the google-play-scraper and app-store-scraper tools in this project:

1. DISCOVER niche apps:
   - node src/index.js discover "[KEYWORD 1]" --store=gplay --market=us
   - node src/index.js discover "[KEYWORD 2]" --store=gplay --market=us
   - node src/index.js discover "[KEYWORD 3]" --store=gplay --market=jp
   - node src/index.js discover "[KEYWORD 4]" --store=gplay --market=kr

2. LIST top charts in related categories:
   - node src/index.js list TOP_FREE [CATEGORY] --market=us --store=gplay --niche
   - node src/index.js list TOP_FREE [CATEGORY] --market=jp --store=gplay --niche

3. COMPARE cross-market gaps:
   - node src/index.js compare "[KEYWORD]" --market=us --local=my --store=gplay
   - node src/index.js compare "[KEYWORD]" --market=jp --local=my --store=gplay

4. ANALYZE top 5 competitor reviews (get appId from discover results):
   - node src/index.js analyze [APP_ID_1] --store=gplay --market=us
   - node src/index.js analyze [APP_ID_2] --store=gplay --market=us
   - node src/index.js analyze [APP_ID_3] --store=gplay --market=us
   - node src/index.js analyze [APP_ID_4] --store=gplay --market=us
   - node src/index.js analyze [APP_ID_5] --store=gplay --market=us

5. After all data collected, give me a REVIEW with:
   - Top 3 app ideas ranked by opportunity
   - For each: competitor weaknesses, pain points to exploit, Malaysia market gap
   - Feature recommendations based on review mining
   - Which one is best for Flutter solo developer
```

### Variables to Fill:
- `[YOUR KEYWORD]` — the app category you want to research (e.g., "habit tracker", "sleep sounds", "recipe organizer")
- `[KEYWORD 1-4]` — related search terms
- `[CATEGORY]` — Google Play category (HEALTH_AND_FITNESS, PRODUCTIVITY, FINANCE, EDUCATION, LIFESTYLE, TOOLS, FOOD_AND_DRINK, etc.)

---

## Phase 2: Plan & Architecture

> **Agent 2** — Run in a new project directory

```
/plan Build a Flutter [APP_NAME] app based on this market research:

## Market Research Results
[PASTE THE REVIEW OUTPUT FROM PHASE 1 HERE]

## Requirements
- Flutter app for Android (primary) + iOS (secondary)
- Local-first storage (drift/SQLite), no account required
- Material 3 design
- Freemium model: generous free tier (competitor #1 complaint is paywall)
- Target: Malaysia market first, then global
- State management: Riverpod
- Architecture: Clean Architecture, feature-based folders

## Key Differentiators (from research)
[PASTE THE TOP PAIN POINTS AND FEATURE GAPS FROM PHASE 1]

## What I Need
1. Restate requirements
2. Break into implementation phases (week by week)
3. Database schema
4. Full folder structure
5. Key dependencies (pubspec.yaml)
6. Risks and mitigations
7. Success criteria

DO NOT write code. Only produce the plan. WAIT for my confirmation.
```

---

## Phase 3: Build Foundation (Week 1)

> **Agent 3** — Run in the project directory after plan confirmed

```
Build the Flutter app foundation based on this plan:

[PASTE THE CONFIRMED PLAN FROM PHASE 2]

Do these steps in order:

1. Create Flutter project:
   flutter create --org com.[yourname] --project-name [app_name] [app_name]

2. Configure pubspec.yaml with dependencies:
   - flutter_riverpod, riverpod_annotation
   - drift, sqlite3_flutter_libs, path_provider, path
   - go_router, table_calendar, fl_chart
   - uuid, intl, shared_preferences, http
   - share_plus, flutter_local_notifications
   - Dev: build_runner, drift_dev, riverpod_generator, mocktail

3. Create full directory structure (lib/app, lib/core, lib/database, lib/features/*)

4. Build core layer:
   - lib/core/constants/ (app constants, color constants)
   - lib/core/error/ (failures, exceptions)
   - lib/core/theme/ (Material 3 theme with light/dark)
   - lib/core/utils/ (date utils)

5. Build database layer:
   - All drift tables from the plan schema
   - DAOs with full CRUD
   - Seed data (default tags, prompts, etc.)
   - Run: dart run build_runner build

6. Fix Android build.gradle.kts:
   - Enable coreLibraryDesugaring
   - Add desugar_jdk_libs dependency

7. Write database tests (DAO CRUD, seeding, analytics queries)

8. Verify: flutter analyze (0 errors) + flutter test (all pass) + flutter build apk --debug (builds)
```

---

## Phase 4: Build Screens (Week 2-3)

> **Same Agent 3** or new **Agent 4**

```
Continue building the [APP_NAME] Flutter app. Foundation is complete (database, tests passing, APK builds).

Now build all screens:

1. App shell:
   - lib/app/router.dart (GoRouter with ShellRoute + bottom nav)
   - lib/app/providers.dart (Riverpod providers for DB, DAOs)
   - lib/main.dart (ProviderScope, MaterialApp.router, theme)

2. Feature screens (build each with full UI):
   [LIST YOUR SCREENS FROM THE PLAN - e.g.:]
   - Home screen (today's status + recent entries + quick actions)
   - [Main feature] entry screen (the core action)
   - [Secondary feature] screen
   - Calendar/history view
   - Analytics/insights screen
   - Settings (theme toggle, export, notifications, about)
   - Onboarding (3 pages, first-launch only)

3. For each screen follow these rules:
   - All colors from theme.colorScheme.* (never hardcoded)
   - Spacing: multiples of 4/8
   - Every list needs empty state (icon + message + CTA button)
   - Every async op needs loading state
   - Error states show user-friendly text, not raw exceptions
   - Touch targets >= 48dp
   - Animations: 200-300ms, Curves.easeOutCubic
   - Add Semantics labels on custom interactive widgets

4. After all screens built:
   - flutter analyze (0 errors)
   - flutter test (all pass)
   - flutter build apk --debug (builds)
```

---

## Phase 5: Polish & Features (Week 3-4)

> **Same agent or new agent**

```
Continue building [APP_NAME]. All screens are scaffolded and working.

Now add polish and remaining features:

1. AUTOSAVE for text entries (3-second debounce, draft system)
2. DATA EXPORT (JSON full + CSV spreadsheet) via share_plus
3. DAILY NOTIFICATIONS (flutter_local_notifications, user picks time)
4. [ANY APP-SPECIFIC FEATURES FROM YOUR PLAN]

5. Design polish (follow Impeccable principles):
   - Dark mode tested and working
   - No gray text on colored backgrounds
   - No bounce/elastic animations
   - Consistent typography (use textTheme, not hardcoded TextStyle)
   - All interactive states (pressed, disabled, loading)

6. Run audit:
   - Check all hardcoded Colors.* → replace with theme tokens
   - Check all raw error text → replace with user-friendly messages
   - Check touch targets < 48dp
   - Check missing empty/loading/error states

7. Write remaining tests to reach good coverage

8. Final: flutter analyze (0 errors) + flutter test (all pass) + flutter build apk --debug
```

---

## Phase 6: Research-Driven Improvements

> **Agent 1** (back to scraper project)

```
Using the scraper tool, do a deep review analysis of these competitor apps:
[LIST 5-8 COMPETITOR APP IDs FROM PHASE 1]

For each, run:
- node src/index.js analyze [APP_ID] --store=gplay --market=us --reviews=500

Then aggregate all results and give me:
1. Top 10 recommended improvements ranked by impact
2. What users LOVE (positive keywords to use in store listing)
3. What users HATE (features to avoid / do better)
4. Feature requests from 5-star reviews (users who love the app but want more)
5. Deal-breaker complaints from 1-2 star reviews
```

---

## Phase 7: Implement Improvements

> **Agent building the app**

```
Based on this competitor review analysis:

[PASTE PHASE 6 RESULTS]

Implement the top improvements that match our app:
[PICK 3-5 FROM THE LIST]

For each:
1. Build the feature
2. Write tests
3. Verify build

Then run final audit and verify 0 errors, all tests pass.
```

---

## Quick Reference: Category Keywords

| Category | Search Keywords |
|----------|----------------|
| Health | "habit tracker", "water reminder", "sleep tracker", "mood tracker", "meditation timer" |
| Productivity | "pomodoro timer", "focus timer", "todo list", "daily planner", "time tracker" |
| Finance | "expense tracker", "budget planner", "savings goal", "bill reminder" |
| Food | "meal planner", "recipe organizer", "calorie counter", "grocery list" |
| Education | "flashcard", "study timer", "vocabulary builder", "language practice" |
| Lifestyle | "journal diary", "gratitude journal", "dream journal", "prayer time" |
| Fitness | "workout tracker", "running log", "yoga timer", "gym planner" |
| Parenting | "baby tracker", "breastfeeding log", "milestone tracker" |
| Pets | "pet care tracker", "dog walking", "vet reminder" |
| Travel | "packing list", "trip planner", "travel journal" |

## Google Play Categories

```
HEALTH_AND_FITNESS, PRODUCTIVITY, FINANCE, EDUCATION,
LIFESTYLE, FOOD_AND_DRINK, TOOLS, BUSINESS, SOCIAL,
ENTERTAINMENT, MUSIC_AND_AUDIO, SPORTS, TRAVEL_AND_LOCAL,
WEATHER, SHOPPING, PARENTING, COMMUNICATION
```

## Multi-Agent Setup

To run 3 app projects simultaneously:

```
Terminal 1 (Agent A): cd ~/GitHub/app_project_1 && claude
Terminal 2 (Agent B): cd ~/GitHub/app_project_2 && claude
Terminal 3 (Agent C): cd ~/GitHub/app_project_3 && claude
```

Each agent gets the same phase prompts but with different:
- Keywords and categories
- App names and features
- Competitor app IDs

The scraper agent (Phase 1 & 6) can run research for all 3 apps sequentially
since it shares the same Play_App_Store_Scraper project.
