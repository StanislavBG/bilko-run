---
slug: "coverage-got-burrow-to-the-post-recall-reads-it"
title: "Coverage got Burrow to the post. Recall reads it."
excerpt: "Last week I gave Burrow a coverage number and made it visit every trading subreddit on a schedule. This week I checked whether it actually pulled the tickers out of the posts it visited — and found fresh NVDA and ETH captures sitting untagged for ~2 days while the tagger ground through a 19,145-file archive backlog in filename order. The fix was a sort. The harder fix was the metric I built to catch this, which was itself lying — counting \"A\", \"O\", and \"AI\" as ticker mentions and reporting recall at 0.22."
category: "build-log"
published: true
published_at: "2026-06-21T10:00:00.000Z"
order: 20
---

Last week's post ended on a coverage KPI: over any rolling 24h, visit every trading sub at least as often as its tier demands. Burrow hit 80.4% and I called the binge "measured." But coverage only measures whether Burrow *opened* the post. It says nothing about whether the ticker named in that post — the entire reason to read Reddit — made it into the index where the signal-builder side can see it.

It hadn't. An external feedback item (sb-req-12) flagged that head tickers were being captured but not extracted for roughly two days. The capture was fine; the *mention extraction* was lagging two days behind it. Coverage was green while the thing coverage exists to feed was stale.

## The lag was a sort order, not a throughput problem

Root cause (PRD 139, `13c8c89`): the incremental tagger built its to-do list from `iter_reddit_captures()` in **filename-sorted** order — inbox then archive — and stopped at `INCREMENTAL_PER_RUN_LIMIT=150` per 4h run. With 63 inbox files and 19,145 untagged archive files, every run spent its whole budget on the front of the filename sort. A fresh NVDA capture that got swept into the archive sat at the *tail* of that sort and waited ~2 days for its turn. Burrow wasn't under-powered; it was tagging the wrong 150 files.

The fix is the kind that's embarrassing to write down because it's so small: for the incremental path, materialize all eligible un-tagged captures, sort by `captured_at` descending, *then* apply the 150 limit. Now each run always spends its budget on the freshest un-tagged captures regardless of which directory they're in. The full archive re-tag and windowed backfill paths kept their existing streaming behavior — this only changed the scheduled tick. O(n log n) in eligible-capture count, which is cheap next to two days of recency debt.

## The metric I built to catch this was lying too

To make sure this never silently regresses, PRD 140 (`ecb6f0c`) added a `capture_to_mention_recall_24h` figure plus a `head_ticker_recall` parity check to `gather_status`, with a `low_recall` health verdict that fires below an 0.80 SLO. Schema bumped 1→2, version 0.8.6→0.8.7, 461 lines of new reader tests. Then I looked at the number it produced: **0.22**. Permanently tripping `low_recall` on what looked like a catastrophe.

It was the metric, not the system. The recall denominator was a naive whole-word body scan against the *full* ticker universe — which contains `A`, `C`, `O`, `T`, `V` and word-collisions like `AI`, `EV`, `ON`, `OR`. Every post containing the word "or" counted as "a post naming a ticker." The denominator was inflated with noise, so recall cratered to a meaningless 0.22, and the "head tickers" it reported as missed were single letters.

The fix (`6ee995c`) extracted `load_eligible_universe()` — the universe minus ambiguous words, the negative filter, and anything shorter than two characters — and pointed the recall scan at *that*, the same matcher extraction already uses. One matcher, shared, no standalone regex drifting from the real one. Recall moved to **0.375** and the head-miss list turned into actual tickers: BTC, GME, VOO, ETH, MSFT, SPY. 0.375 is still under the 0.80 SLO — but now it's an honest 0.375 measuring genuine extraction lag, not a collision artifact. Four red-first tests in `TestCollisionFiltering` now assert that an "AI"/"A" post can't inflate the denominator.

This is the same failure as last week's midnight coverage cliff, one rung up: a metric that looks like signal but is dominated by an artifact nobody's inspecting. The first 80% is building the gauge. The second 80% is proving the gauge isn't measuring its own wiring.

## Widening the inputs without touching the browser lane

The other move this week was giving Burrow signal sources that don't queue behind its single headed-Chromium lane — because every recall win is wasted if the only way to gather is the one serialized browser.

- **Catalyst calendar** (PRD 145, `38ee1cf`): a Burrow-owned `catalyst_calendar_collect` pipeline pulling Nasdaq earnings JSON plus a bounded `claude -p` macro-events pass into an `analytics.db` table, with idempotent `(ticker, event_type, event_date)` upserts and a Tier-1 MCP read `upcoming_catalysts(within_days, event_type, ticker)`. Burrow now *knows* what's coming, instead of finding out after the move.
- **Web opinion gather** (PRD 146, `c6b1a66`): an `internet_search_opinion` pipeline that, for every ticker with a catalyst inside 15 days, gathers symmetric bull/bear web opinions — a drain-job at 5 tickers/run, 20/day cap, 6 balanced queries each, URL-hash dedup, indexed through the existing brain indexer. No browser. 14 TDD tests.

These two chain on purpose: the calendar decides *which* tickers are about to matter, and the opinion gatherer spends a browser-free budget pre-loading context on exactly those. Coverage chases breadth; this chases the handful of names a catalyst is about to make loud.

Two reliability fixes rode along underneath. The indexer was silently failing 38–53 of every ~78 files per batch because a batch could carry duplicate `distilled` permalink ids and Chroma rejects the whole upsert on a non-unique id — collapsing the parallel lists through a dict keyed on id (last-wins) before upsert fixed it (`b4c61b4`). And the dashboard got a Positions tab (PRD 138) with health verdicts and platform standing — which immediately surfaced its own bug, where a platform inside its mandatory post-gap window was rendering as healthy because the classifier set the reason string but never flipped `healthy=False`.

## What I'd do differently

I'd have built the recall metric *before* the coverage metric, not after. I spent last week optimizing breadth on the implicit assumption that visiting a post meant ingesting it — and that assumption was wrong by two days. Coverage and recall are two halves of one number; shipping the half that's easy to graph (did we open it) ahead of the half that's the actual goal (did we extract it) is how you end up with a confident dashboard and a stale index. Next pipeline metric, I build the output-side gauge first and let it tell me whether the input-side gauge is even worth optimizing.

## FAQ

**Why not just raise `INCREMENTAL_PER_RUN_LIMIT` past 150 to drain the backlog faster?**
That treats a 19,145-file backlog as a throughput problem, but the lag was an *ordering* problem — fresh captures were starving regardless of total budget. Raising the limit burns more compute every run forever to paper over a sort that costs nothing. Sort first; only then ask whether 150 is the right number.

**Is recall at 0.375 not just as alarming as 0.22 was?**
0.375 is a real measurement of genuine extraction lag, captured the morning after PRD 139 landed but before a full tagger tick had drained the backlog (the host slept overnight, so 139 was deployed-but-unconfirmed at the time of the reply). 0.22 was a number that could never improve because it was measuring collision noise. An honest low number you can move beats a fake low number you can't.

**Why does Burrow own a catalyst calendar instead of querying one at read time?**
Single-sourcing it into `analytics.db` means the opinion gatherer, the MCP, and the dashboard all read one idempotent table instead of three components each hitting an external API on their own cadence and disagreeing. The collector is the only thing that talks to Nasdaq; everything downstream reads Burrow. The coverage this feeds drives the [social-signals-trader](/projects/social-signals-trader/) dashboard; Burrow itself is [github.com/StanislavBG/burrow](https://github.com/StanislavBG/burrow).