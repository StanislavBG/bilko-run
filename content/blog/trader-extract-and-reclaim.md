---
slug: "trader-extract-and-reclaim"
title: "I extracted my trader's brain, then took half of it back"
excerpt: "social-signals-trader shimmed its entire signal layer out to a new service, shipped a 3-tier CATALYST_WATERFALL strategy and a strategy-catalog-as-data system, enabled shorts and flat $5k tickets — then reclaimed its orchestration when the split turned into a dependency cycle. A build log about where a trading engine's brain actually belongs."
category: "build-log"
published: true
published_at: "2026-06-03T17:00:00.000Z"
order: 16
---

social-signals-trader is the engine that turns signals into trades. This week it did two contradictory-sounding things: it gave away its entire interpretation layer to a new service, and then it took the orchestration half of that layer right back. Both were correct. Here's the build log, including the strategy work that happened in between.

## CATALYST_WATERFALL: a three-tier cascade, as data

The headline feature is a single strategy that fires on every catalyst-calendar thesis and walks three signal tiers — first to produce a direction wins:

1. **social** — `panels.sentiment`, gated on bull-share — at 1.0× capital
2. **options_tech** — call/put ratio with an above-50-day-SMA fallback — at 0.5× capital
3. **naive** — constant LONG — at 0.25× capital

The clever part is that it's all data, not code. The variant DSL gained a `cascade:` key; each tier either declares a full signal spec or a constant `direction_rule` shortcut. Every emitted proposal carries its `tier` and `capital_multiplier`, so the audit log preserves *why* a trade fired, and the dashboard's Trades table renders a coloured tier badge — green for social, amber for options_tech, grey for naive — by joining audit rows onto orders by `client_order_id`. You can read a fill and know which tier of conviction produced it.

## Strategy catalog as data (no code to add a sleeve)

CATALYST_WATERFALL rides on a bigger change: the strategy registry is now built from `data/strategies/*.yaml` (PRD 70), a strategy variant can be declared entirely in YAML with no code change (PRD 71), and a variant-evaluation harness (PRD 72) lets me A/B a new sleeve before promoting it. Adding a strategy went from "write a class, wire it in, test it" to "drop a YAML file." That is the difference between a trading engine I extend and a trading engine that fights me.

## Shorts, flat tickets, and Alpaca-vs-SPY

A run of smaller decisions that each removed a fudge factor:

- **Shorts enabled end-to-end** (PRD 60) — the engine can now express bearish theses, not just sit them out.
- **Flat $5,000 ticket notional** promoted from an env-only override to the default, and the CATALYST_WATERFALL tiers flattened to 1.0× — every trade is the same size regardless of tier. Position sizing was adding noise to strategy evaluation; making it flat made the comparisons honest.
- **Alpaca-vs-SPY as the primary KPI** (PRD 73) — the dashboard's headline number is now performance against the index, because beating SPY is the only benchmark that matters. Also shipped: an Optimization tab (PRD 47) for sleeve param sweeps and a Signals tab (PRD 46) with sentiment/mentions time-series, plus `trade_points`, a daily OHLCV collector over the event-relative window so backtests have clean price data.

## The shims, the audit, and the reclaim

Mid-week the trader shimmed its whole signal layer out to the new [signal-builder](https://github.com/StanislavBG/signal-builder) service — sentiment, news, fund_extractor, catalyst_calendar, proactive_scan, all delegating to the package (M2–M8). Clean on paper.

Then an architecture audit told the truth: the split was half-finished. signal-builder's orchestration modules were importing the trader's own strategies, events, and theses — a dependency cycle dressed up as a layer. The audit also flagged three overlapping decision engines (the agent path was ~41% rate-limited), dual order submitters with no shared lock, and a 605 MB unbounded data file. The signal split was the load-bearing one.

So I reclaimed it. `score_tickers`, `proactive_scan`, corroboration, and `catalyst_calendar` moved back into the trader, because anything that imports strategies/events/theses *is* trader orchestration. What stayed in signal-builder is what's genuinely upstream — the per-ticker data production. The trader now talks to signal-builder through a single `sb_client` gateway with a pluggable transport: a client-only dependency on a remote service, not an editable import of a sibling package.

## What I'd do differently

I'd separate "what data do I consume" from "what decisions do I make" before extracting anything. The mistake wasn't building signal-builder — it was moving the decision-making (`proactive_scan`, `score_tickers`) into it alongside the data production. Decisions need the trader's strategy context; data production doesn't. Drawing that line first would have made the split a one-way move instead of a round trip. The reclaim was cheap only because the test suite held the contract on both ends.

## See it / build on it

- [social-signals-trader](/projects/social-signals-trader/) — live dashboard, Alpaca-vs-SPY up top
- [signal-builder](https://github.com/StanislavBG/signal-builder) — the producer the trader now rents from
- [The cycle, from signal-builder's side](/blog/signal-builder-m0-to-m9)

## FAQ

**Why flatten every trade to $5,000?**
Because variable position sizing was contaminating strategy evaluation. If a sleeve looks good, I need to know it's the *signal* that's good, not that it happened to size up the winners. Flat tickets make the comparison between strategies and tiers honest; sizing is a separate optimization I can add back once the strategies are proven.

**Isn't strategy-as-YAML just config sprawl?**
It would be if the YAML were doing logic. It isn't — it declares which signals a sleeve uses and how they cascade, against a fixed set of evaluators. The logic lives in code; the *composition* lives in data. That split is exactly what lets me add a sleeve or A/B a variant without a deploy, and it's why CATALYST_WATERFALL's three-tier cascade is a single YAML file.

**Why take the orchestration back instead of fixing signal-builder to not need the trader?**
Because the orchestration genuinely needs the trader. `proactive_scan` probes the trader's strategy deciders and promotes results into the trader's thesis lifecycle — that's trader logic by definition. The right boundary isn't "make the producer smart enough to do it"; it's "the producer produces data, the trader decides." Moving it back put the code where its dependencies already pointed.