---
slug: "coverage-debt-making-burrow-visit-what-it-skips"
title: "Coverage debt: making Burrow visit what it skips"
excerpt: "Last week I gave Burrow a North-Star coverage number and found the gatherer went deep on a few subreddits instead of broad across many. This week was the machine that chases the number: a selector that picks subs by how overdue they are, a breadth sweep that makes wide gathering cheap, and a bug where the metric I built to stop lying was collapsing to near-zero every midnight. Coverage is 80.4% now — and the middle tiers are exactly where it still fails."
category: "build-log"
published: true
published_at: "2026-06-18T10:00:00.000Z"
order: 19
---

Last week Burrow got a coverage KPI for the first time: over any rolling 24h, visit every trading subreddit at least as often as its tier demands. The number existed, but nothing in the gatherer was *optimizing* toward it — the binge walked whatever feed was in front of it and went deep, because more posts per sub looks busier on every dashboard that isn't this one. A coverage KPI with no selector chasing it is just a thermometer. This week I built the thing that reads the thermometer and moves.

## The selector picks by debt, not by feed

The core change is `CoverageDebtSelector` (PRD 81, commit `a88e905`): instead of gathering the most active subs, Burrow now ranks every trading sub by how *overdue* it is against its tier cadence — P0 wants a visit every 4h, P3 every 24h — and spends its next session on the most-starved ones first. A sub that's met its target drops to the back of the line even if it's loud right now.

Two refinements landed on top: a tier-floor plus `fresh_cap` so a single hot sub can't monopolize a session (`44e30cc`, KPI iter-1), and a `min_mention_yield` demote (`0798896`, ported into the selector at `1ca168d`) that pushes down targeted ticker-subs that keep coming back empty — overdue *and* unproductive is worse than overdue alone. The selection logic lives in `app/pipelines/reddit/selectors.py`; the tiers are a flat YAML knob (`data/reddit-coverage-tiers.yaml`) so re-tiering a sub by trader value is a one-line edit, not a code change.

The value is narrow and concrete: Burrow now visits the subs it's been quietly skipping, on a schedule it can be measured against, instead of the subs that happen to be in front of it.

## Breadth is only affordable if each sub is cheap

Telling the gatherer to go wide is free advice unless each visit costs less. So most of the throughput work was making a single sub-visit cheaper, then spending the savings on more subs:

- **`subs_per_session` 5 → 9** (`73e335a`, coverage-loop iter 2) — nearly double the subs per binge.
- **Per-sub cost cut ~3×** (`b9836ed`) via brisker pacing and narrower sort/drill knobs — the budget that paid for the 5→9 bump.
- **A shallow `reddit_breadth_sweep` pipeline** (`52f3e9d`, tier P5) — a tail pass that touches the long tail of P3 subs just enough to clear the daily floor, without the cost of a full binge.
- **Per-pipeline `pacing_profile`** (`15722bb`) — each pipeline scales its own delay/sleep factor, so the breadth sweep can run fast-and-shallow while a deep binge stays human-paced.

The constraint behind all of this is one browser lane — Burrow drives a single headed Chromium, so throughput isn't "add workers," it's "make each visit shorter." The live scorecard says the gatherer spent ~4.7 hours of actual session time across 24h; breadth has to fit inside that, which is why the cost cut came first and the subs-per-session bump came second.

## Ticker gaps don't need the browser at all

The other way to widen coverage was to stop routing everything through that one browser lane. PRDs 99/100/102 added a browser-free ticker search over `old.reddit` (`0f2df14`, `83b7eba`), a gap-driven gather that fires when a tracked ticker has gone stale, and a catalyst-aware `ticker_data_state` index that knows which tickers are under-covered (`2e56844`). A ticker that's overdue can now get a lightweight HTML fetch instead of waiting for the browser lock to free up. The same idea went to the X side — ticker-targeted cashtag search in the feed extractor (`a71f0a2`). Coverage stops being hostage to a single serialized resource.

## The metric was lying at midnight

The honest mistake: the coverage headline was computed over a *calendar-day* window, not a rolling 24h. So every night at 00:00 it collapsed to near-zero and spent the morning climbing back — the KPI I'd built specifically to stop the system lying about itself was, for a few hours a day, lying about itself. The fix (`d96ec2b`) switches the headline to a true rolling-24h window so midnight is no longer a cliff. I also localized the trend buckets and timestamps to America/Los_Angeles PT (`d127ca6`), because a coverage chart that resets at UTC midnight is unreadable to someone reading it at 5pm Pacific.

It's the same failure as last week's stale-green health bug, one level up: a measurement that looks like a real signal but flips on a clock boundary nobody's watching. Building the metric is the easy 80%; making the metric tell the truth at every hour of the day is the other 80%.

## Where coverage actually stands

Grounded in the live scorecard (`scripts/coverage_scorecard.py` → `downloads/coverage-scorecard.json`), not a vibe:

- **80.4% coverage** across a **101-sub** universe, **65 subs** currently meeting their target, **8 daily-floor breaches**.
- By tier: **P3 (daily floor) 92%** — the breadth sweep is doing its job on the long tail. But **P1 72% (5 of 19)** and **P2 63% (11 of 26)** — the mid-tiers are the frontier.

That tier split is the whole ongoing focus in one line: the cheap-and-wide machinery fixed the daily floor, but the *medium-cadence* subs — every-8h and every-12h — are where coverage still leaks, because they need to be revisited often enough to cost real browser time but aren't urgent enough to win a P0 slot. That's next week's problem, and now there's a number to know whether I've solved it.

## What I'd do differently

I raised `subs_per_session` to 9 *before* I had the per-sub cost cut fully landed, so for a couple of binges the sessions ran long and the timeout sweep (`8182dbb`) had to reap stuck pipelines that were just slow, not stuck. The right order was cost-cut first, then widen — measure the new per-sub cost, *then* spend it. I widened on optimism and let the throughput ceiling catch it, instead of the other way around.

## See it run

The coverage feeds the signal engine behind the trade-in-public dashboard — [social-signals-trader](/projects/social-signals-trader/). Burrow itself is [github.com/StanislavBG/burrow](https://github.com/StanislavBG/burrow).

## FAQ

**Why optimize coverage instead of captures-gathered?**
Captures is the vanity metric — it rewards going deep on whatever's already loud, which is exactly the behavior that left mid-tier subs unvisited for a day. Coverage measures *reach*: quality discussion I never visit is quality I never capture. Captures is downstream of coverage, not a substitute for it.

**Why not just run the gatherer longer to hit 100%?**
Because there's one browser lane and ~4.7h of real session time in the scorecard's 24h window — wall-clock is the hard ceiling, not effort. 100% coverage at current cadence isn't a "run it more" problem; it's either cheaper visits (this week's work) or honest re-tiering of low-value subs down so the target is actually reachable. A KPI you hit by lowering the bar is fine *if you say so* — letting it sit unreachable is the dishonest option.

**Why per-tier cadence instead of one flat "visit everything daily"?**
Because r/wallstreetbets at the same cadence as r/Bullion wastes the budget at both ends — the firehose goes stale in 4 hours and the niche sub doesn't change in 12. Tiering by trader value is how a fixed throughput budget buys the most decision-grade signal.