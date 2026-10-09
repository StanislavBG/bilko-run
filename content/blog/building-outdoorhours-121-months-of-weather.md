---
slug: "building-outdoorhours-121-months-of-weather"
title: "Building OutdoorHours: 121 Months of Weather in Six Commits"
excerpt: "We shipped a 10-year, six-county outdoor-comfort dashboard in a week — from a single-screen v1 to multi-range, multi-region bundles with 121 AI-written monthly narratives. Here is what actually happened."
category: "build-log"
published: true
published_at: "2026-04-20T07:27:07.878Z"
order: 5
---

## The question behind the tool

"Was it comfortable to be outside?"

Every climate dashboard I could find answers a different question — averages, anomalies, trend lines. None of them answer the one that matters if you're picking where to live, when to travel, or where to hold an outdoor event: **how many hours of the year can you actually be outside without sweating, shivering, squinting, or getting rained on?**

So we built [OutdoorHours](/projects/outdoor-hours) (internal name KOUT-7). Six commits between April 17 and April 19. By the end of the week the dashboard covered 124 data files, 121 months of AI-written narratives, and four time ranges across six counties.

## The four-rule model

Every hour of the last 30 years is scored against four non-negotiable rules. All four must pass:

- **Daytime** — the sun is up
- **Temperature** — 45°F to 86°F
- **UV index** — 6 or lower
- **Rain** — 1 mm/h or less

Hourly ERA5 reanalysis data for each region goes in. A single boolean comes out: comfortable or not. Sum the comfortable hours over a month, a year, a decade — and you have a ranking that survives comparison across climates that are nothing alike.

The rules are strict on purpose. Loosen any one and the ranking collapses into "which region has more daylight." All four together isolate the thing people actually feel when they step outside.

## v1 → v4 in three days

**v1 (commit `de324e3`)** shipped the skeleton: two hard-coded regions (Bay Area vs. Seattle), Plotly charts, four grain levels (yearly → monthly → daily → hourly), and a single time range. About 1,134 lines of `OutdoorHoursPage.tsx` doing too much.

**v2 (commit `5348f5e`)** rebuilt the Four Rules section as color-coded cards with a "4 of 4 must pass" badge, then added the thing people asked for in the first five minutes: **row-click drill-in**. Click a month, get the daily breakdown. Click a day, get the 24 hourly rows with the specific rule that failed on each one. The hourly schema surfaces the four drivers (day? / temp / UV / rain) alongside the score so you can see *why* an hour didn't count.

**v3 (commit `e8d2aca`)** broke the two-region ceiling. Region metadata moved into the data bundles themselves — colors, default-on flags, display names — so adding a new region is a Python-side registry change plus a data export. Added San Francisco (Mission / Pacific Heights / Ocean Beach) and Snohomish County, WA. Time range picker (1y / 5y / 10y / 30y) with lazy-loaded bundles and a leaderboard that stars the leader in champagne. Post-v3 bundle sizes: **265 KB / 1.3 MB / 2.9 MB** for 1y / 5y / 10y.

**v4 (commit `7bd2292`)** added the "Writer's Take" — an AI-generated one-sentence summary per bundle, rendered as an amber card to visually separate narrative from numbers. The narratives ship *pre-computed* inside the JSON; zero runtime LLM calls, zero latency, zero API cost per page view.

## 121 months of narratives, zero server load

The narratives commit (`8b8d897`) is the piece I'm most proud of. Every one of 121 monthly buckets now has an AI-written summary that compares all active regions on stay-outside hours — the leader, the laggard, and the weather driver that explains the gap. It appears inside the drill-in panel when a user opens a month.

The trick: we generated all 121 narratives offline with a local `claude -p` pipeline, baked them into the data bundles at export time, and now they ship as static JSON. The entire OutdoorHours tool is a static SPA. No server-side AI. No per-request cost. No rate limits.

Total narrative payload: about **21 KB** of metadata across all time ranges. That's the unit cost of adding an LLM-authored voice to a 30-year dataset.

## The data refresh that doubled coverage

Commit `75bb766` is unglamorous but mattered: 124 files touched, adding Charlotte County, FL (Punta Gorda / Port Charlotte / Englewood), partial coverage for Albemarle County, VA (Charlottesville / Crozet / Earlysville, limited by Open-Meteo quota), and completing Snohomish County with the missing Edmonds series. Westchester NY and Maui HI are registered in the pipeline but filtered out of the active bundle until their data backfills complete.

Post-refresh bundle sizes: **509 KB / 2.5 MB / 5.0 MB**. Still comfortably under the "slow-3G fails" threshold even for the 10-year bundle.

## What else shipped this week in the Bilko repo

Three smaller wins that matter more than they look:

- **LocalScore E2E tests (`9141c44`)** — 9 Playwright tests across all four analysis modes (contract, financial, meeting, general), driven by a mocked Anthropic Gemma engine injected via `addInitScript`. This unblocks refactors of the browser-AI tool without needing a GPU in CI.
- **Simplify + parallelize (`e5d8a80`)** — extracted a 235-line fixtures file, removed a dead `setStatus('loading-model')` call React had already batched away, and flipped `fullyParallel` on in the Playwright config. Test suite went from **17.9s → 5.7s**.
- **Security: gate the test seam (`debab78`)** — the `window.__LOCALSCORE_MOCK_ENGINE` hook we used to inject a fake AI in tests was shipping to production, meaning any browser extension or XSS in the page could swap our in-browser AI for one of theirs and exfiltrate user documents. Now gated behind a `__TEST_SEAMS__` Vite define that evaluates to `false` in production and gets dead-code-eliminated from the bundle. Verified: zero occurrences of `__LOCALSCORE_MOCK_ENGINE` in the production build.

Plus **CardSpotter planning (`aca9910`)** — 10 agent-ready work packages (1,974 lines of markdown across 11 docs) for the next bilko.run tool: upload a card photo, get a structured list plus a poker-hand evaluation. Implementation lands next week.

## What I'd do differently

I'd build the N-region architecture in v1. We paid for "two hard-coded regions" twice — once in v1, once in v3 when we tore it out. If you're building a comparison tool, there is no such thing as "just two things" — there's always a third, and a fourth, and a sixth county in Florida that someone in the Discord wants added.

I'd also pre-generate narratives earlier. Monthly narratives look like a late-game polish feature. They're actually the thing that makes the drill-in feel human. Adding them in v4 was fine; adding them in v2 would have been better.

## Try it

[OutdoorHours](/projects/outdoor-hours) is live with 1-year, 5-year, 10-year, and 30-year views across six regions. Free, no credits, no login. Drill into any month to see the hour-by-hour breakdown and the Writer's Take.

If you want to see the broader platform, [the full tool list is here](/projects). And if you're running a landing page without clear data backing, [PageRoast](/projects/page-roast) will tell you exactly where it breaks.

## FAQ

**Why not just show average temperature?**
Because average temperature lies. A city that averages 65°F year-round might do it by being 90°F all summer and 40°F all winter — zero comfortable hours. Hour-by-hour scoring catches that.

**Where does the weather data come from?**
Open-Meteo's ERA5 historical reanalysis. Hourly resolution going back to 1996.

**Why pre-generate the narratives instead of calling an LLM live?**
Cost and latency. 121 months × N regions × every page view = a bill. Baking them into the bundle at export time means the tool is static JSON + a React page. Zero per-request cost.