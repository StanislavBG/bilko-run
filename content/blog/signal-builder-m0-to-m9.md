---
slug: "signal-builder-m0-to-m9"
title: "signal-builder: m0 to M9, and the cycle that redefined it"
excerpt: "In two days a brand-new repo absorbed an entire trading engine's interpretation layer — nine milestones, m0 through M9. Then an architecture audit caught it importing its own client. Breaking that dependency cycle turned signal-builder from a helper library into a hosted, paid, multi-tenant MCP service. A build log about the difference."
category: "build-log"
published: true
published_at: "2026-06-03T16:30:00.000Z"
order: 15
---

signal-builder did not exist two weeks ago. This week it went from an empty m0 skeleton to M9 — nine milestones — and absorbed the entire interpretation layer of my trading stack. Then I almost shipped it broken, caught it in an architecture audit, and the fix changed what signal-builder *is*. This is that story.

## Nine milestones in two days

The plan: [Burrow](https://github.com/StanislavBG/burrow) gathers raw Reddit, [social-signals-trader](/projects/social-signals-trader/) trades, and signal-builder sits in the middle turning raw posts into structured, trader-facing panels. Each milestone moved one piece of interpretation out of the trader and into the new service:

- **m0** — skeleton, `PanelStore`, a `panels.health` stub.
- **M1** — `aggregates_local` + `post_cache` + eight panel/signal MCP tools.
- **M2** — the sentiment stack, behind `panels.sentiment`.
- **M3** — news stack + `panels.news_signals` + short-interest.
- **M4** — `fund_extractor` (10-K/10-Q thesis extraction) + `panels.fund_theses`.
- **M5** — `catalyst_calendar` + `panels.catalyst_calendar/find`.
- **M6** — `proactive_scan` + `score_tickers` + corroboration.
- **M8** — `meta.panel_history` + `meta.panel_freshness`.

The trader, in parallel, replaced each of those with a thin shim delegating to the `signal_builder` package. On paper it was a clean three-layer split, done in a weekend.

## The cycle: a service that imported its client

Then I ran a full architecture audit, and it flagged the split as half-finished: an undeclared dependency reached via both an editable import *and* a spawned MCP, with no enforced contract. Translation: signal-builder's M6 modules — `proactive_scan`, `score_tickers`, corroboration — were importing `social_signals_trader.strategies`, `.events`, `.theses`, `.universe`.

The upstream producer was importing the downstream consumer. That is a dependency **cycle**, and it is fatal to the thing I wanted signal-builder to be. The tell was deployment: I could not run signal-builder anywhere the trader wasn't also installed. A service you can't start without its own client is a library in a costume.

## The fix, and the rule it taught

The fix was four commits, all "move it back." `proactive_scan`, `score_tickers`, corroboration, and `catalyst_calendar` went home to the trader. The rule that fell out, and that I should have started with:

> A module that imports the trader's strategies, events, or theses *is* trader orchestration — it lives in the trader. A module that produces per-ticker data from raw inputs — sentiment, news, fund theses, aggregates — is genuinely upstream, and it stays in signal-builder.

After the cut, no real `social_signals_trader` import remained in `src/signal_builder`. 337 tests pass. The producer no longer knows the consumer exists. `score_tickers` was simply deleted — it was never an MCP tool and nothing in signal-builder imported it; `proactive_scan`'s only real use was resolving a coverage-ledger path, which got inlined behind an env var. The panel still reads the ledger; the scan that writes it is the trader's job.

## From library to product

Here is what the cycle was hiding. Once signal-builder couldn't import the trader, the question "where does it live?" had a new answer — not a package, a service. The decision, written into the architecture doc:

> signal-builder is a separate, publicly-hosted, paid, multi-tenant MCP service producing per-ticker time-series; this trader is its first of many clients.

A client-only dependency, contract-pinned, that degrades gracefully when the service is down. Two pieces of plumbing made the boundary real this week: a `ticker_tracker` queue + drainer (PRD 54, closing an old exception) so consumers can request coverage for a ticker, and a Burrow ↔ signal-builder integration smoke battery (PRD 58) that exercises the Burrow MCP directly and flags the HTTP middleware gap. It even grew a `panels.edgar_signal` tool (PRD 82) deriving insider + 8-K tone from EDGAR. signal-builder stopped being "the trader's helper" and started being a product the trader rents.

## What I'd do differently

Check the import direction before moving code, not after. The audit caught the cycle, but the signal was visible on day one: `proactive_scan` imports strategies and theses, which are trader concepts. One question — "which way do this module's imports point?" — asked before M6, and the whole extract-then-reverse round trip never happens. The thing that saved me was test coverage: 337 tests on signal-builder and a thousand-plus on the trader meant the reversal was mechanical, not terrifying. Extract aggressively if your tests pin the contract — but read the arrows first.

## See it / build on it

- [signal-builder on GitHub](https://github.com/StanislavBG/signal-builder)
- [social-signals-trader](/projects/social-signals-trader/) — its first client, and where the orchestration went back to
- [Burrow](https://github.com/StanislavBG/burrow) — the raw-posts producer it sits on top of

## FAQ

**Why build signal-builder at all instead of leaving the logic in the trader?**
Because interpretation is consumer-specific and the trader won't be the only consumer. Pulling sentiment, news, and fund-thesis extraction into a producer that exposes per-ticker panels over MCP means the next consumer — another strategy, a research tool, a dashboard — reads the same panels instead of reimplementing them. The split is what lets the producer become a paid service with many clients.

**Was extracting nine milestones in two days reckless?**
Half of it was right and half overshot. The data-producing milestones (M1–M5) belonged in signal-builder and stayed. The orchestration milestone (M6) imported the trader and had to come back. The recklessness wasn't the speed — it was not checking the dependency direction per milestone. With the test suites pinning both sides, fixing the overshoot cost four commits.

**What does "multi-tenant paid MCP service" actually mean here?**
signal-builder will be hosted once, produce per-ticker time-series, and serve many clients over MCP — billed per use, isolated per tenant. The trader depends on it as a remote service (client-only, contract-pinned) and keeps trading even when the service is unreachable, just with staler signals. That contract is only possible because the producer no longer imports any one client.