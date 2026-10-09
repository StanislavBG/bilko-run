---
slug: "burrow-goes-gather-only"
title: "Burrow goes gather-only: a pipeline that won't interpret"
excerpt: "Burrow used to capture Reddit posts and score their sentiment. This week it stopped scoring — on purpose. PRD 79 dropped post_sentiment, PRD 80 put a single Reader between the dashboard and the indexer, EDGAR moved out to its own repo, and a pile of unglamorous fixes kept the crawler alive. The case for a data pipeline that refuses to have an opinion."
category: "build-log"
published: true
published_at: "2026-06-03T16:00:00.000Z"
order: 14
---

Burrow is the part of my stack that watches Reddit. For months it did two jobs: capture posts at human pace and persist them raw, *and* score each one — sentiment, ticker mentions, pulse coverage — exposing all of that derived state over MCP. This week I cut the second job out entirely. Burrow now gathers and serves raw data, and nothing else.

That sounds like a downgrade. It is the opposite. Here is why a data pipeline should refuse to interpret, and the PRDs that made Burrow refuse.

## Why a pipeline shouldn't have an opinion

"Sentiment" is not a property of a Reddit post. It is a question someone asks of a post, and the right answer depends on who is asking. A trader wants "is this bullish or bearish pressure on the stock?" A marketing tool wants "is this user happy with the product?" A quant wants "what is the conviction-weighted edge on this thesis?" Same post, three different answers. When Burrow scored sentiment, it was silently picking one of those answers for everybody — and getting it wrong for almost everybody.

The fix is to push interpretation to the consumer and keep the pipeline honest: capture, dedupe, persist, expose. If a consumer wants sentiment, it reads the raw posts and scores them with its own definition. Burrow's job is to make sure the raw posts are there, fresh, and addressable.

## PRD 79: drop sentiment, add research-on-demand

PRD 79 was the cut. `post_sentiment` is gone and the scoring pipeline is archived — not deleted, archived, so a historical re-score can still run as a one-off, but no new derived rows get written. In its place Burrow grew something far more useful: a research-on-demand pipeline. `analytics.db` migrated to schema version 10 with a `research_requests` queue table; a HIVE-agent research worker drains that queue and writes into a lazily-created `knowledge_adhoc` Chroma collection; and four new MCP tools — `request_research`, `research_status`, `research_results`, `search_adhoc` — let a consumer say "go find out about X" and poll for the answer. Burrow stopped having opinions about posts and started taking orders for research instead.

## PRD 80: one Reader, one contract

The dashboard used to import the indexer directly and read its internals. That is the kind of coupling that makes every refactor a landmine. PRD 80 introduced a single shared `Reader` singleton — one object that owns every read path — and routed the dashboard's research route through it instead of the indexer. Then it enforced a loopback-only bind, added an import-check, and wrote the Contract surface docs so the boundary is something you can point at, not folklore. Three parts, one outcome: there is now exactly one way to read from Burrow, and it is documented.

## The hardening nobody sees

A crawler that runs unattended fails in boring, fatal ways, and a chunk of the week went to those:

- **Stop OOM-killing the orchestrator.** The indexer was holding too much in memory under pressure and taking the whole orchestrator down with it. Fixed the memory profile so a backfill can't nuke the process.
- **Auto-recover a crashed renderer.** The browser layer now detects a dead renderer, restarts it, and surfaces an honest health signal instead of silently wedging.
- **Real HTTP 410 for tombstones.** Deleted resources used to return `200` with an error envelope — which every client read as success. They now return a real `410 Gone`, so a consumer can tell "deleted" from "broken."
- **Ticker-aware subreddit discovery (PRD 81).** Targeted gather: Burrow can now discover and prioritize the subreddits where a given ticker actually gets discussed, instead of crawling blind.

None of these ship a feature anyone will tweet about. All of them are the difference between a pipeline you trust unattended and one you babysit.

## EDGAR moved out

Burrow had also been ingesting SEC EDGAR filings. That never belonged here — it is a different data source with a different cadence and a different consumer — so it moved to its own repo (edgar-rag), and Burrow's `news_collect` pipeline got disabled in the registry. A pipeline that refuses to interpret should also refuse to sprawl. One source, done well, beats three sources done partway.

## What I'd do differently

I'd have drawn the gather/interpret line at the start. Burrow shipped with sentiment baked in because, early on, there was exactly one consumer and baking it in was faster. The moment a second consumer showed up with a different definition of "sentiment," the bundle became a liability — and I still waited weeks to cut it. The lesson: the first time you catch yourself picking a default *meaning* for downstream consumers, that meaning belongs downstream. A pipeline's superpower is that it has no opinion; spend it.

## See it / build on it

- [Burrow on GitHub](https://github.com/StanislavBG/burrow) — the gather-only pipeline + MCP surface
- [How the gather-only bet started](/blog/the-week-the-platform-got-dumber) — the previous build log
- [social-signals-trader](/projects/social-signals-trader/) — the first consumer that now owns its own interpretation

## FAQ

**Doesn't removing sentiment make Burrow less useful?**
It makes it *more* reusable. A pipeline that scores sentiment is useful to exactly the one consumer whose definition of sentiment it happened to encode. A pipeline that serves clean raw posts plus on-demand research is useful to every consumer, because each brings its own definition. Less opinion, more reach.

**What's the research-on-demand pipeline for?**
It turns Burrow from a passive capture loop into something you can task. A consumer enqueues a research request, a HIVE-agent worker investigates and writes results into an ad-hoc knowledge collection, and the consumer polls for the answer over MCP. It is the gather-only philosophy taken one step further: Burrow doesn't interpret your data, but it will go *get* data you ask for.

**Why a single Reader instead of just importing the indexer?**
Because "just import the indexer" is how every internal becomes load-bearing. One Reader singleton means one read contract, one place to enforce loopback binding and import rules, and one thing to document. The dashboard no longer knows the indexer exists — it knows the Reader exists. That is the whole point of a boundary.