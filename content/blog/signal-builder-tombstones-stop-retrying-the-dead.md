---
slug: "signal-builder-tombstones-stop-retrying-the-dead"
title: "Teaching signal-builder to stop retrying the dead"
excerpt: "One unfetchable Reddit permalink could freeze a ticker's sentiment cursor forever — RKLB was held 29 times. The fix is a tombstone ledger: three attempts, four hours apart, one last salvage probe, then move on. Plus an honest bet about where the real bottleneck is."
category: "build-log"
published: true
published_at: "2026-07-06T16:00:00.000Z"
order: 24
---

I shipped a fix this week for a bug that was quietly freezing sentiment coverage for about 48 tickers.

Signal-builder is the scoring layer between Burrow (which gathers Reddit and social content) and anything that consumes per-ticker sentiment — the [social-signals-trader](/projects/social-signals-trader/) being client number one. An hourly curator walks each ticker's new mentions behind a cursor. Some mention permalinks can never be resolved into a post body: the search index doesn't serve them and the mention carries no context fallback. The old code treated "something is missing" as "hold the cursor and try again next hour" — with no memory of *what* was missing or how many times it had already tried.

One poison-pill permalink could therefore hold a ticker's cursor forever. The mention-scorer log counted the damage: RKLB held 29 times, SPCE 28, PYPL and BNB 24 each. For thin tickers the unfetchable post was often the day's *only* post, so the series stopped advancing and dropped out of the freshness window that decides whether a series is sellable — 157 of the 200 tickers on the worklist were blocked on exactly that recency criterion.

The fix is a small ledger of unresolved items: each gets 3 fetch attempts spaced at least 4 hours apart (enough to absorb normal index lag), then a tombstone. Tombstoned items stop counting as "incomplete," so the cursor moves on, and they're never re-fetched. The one decision I'd highlight: tombstoning alone would silently accept a lost day, so before giving up, the code fires one last day-level probe to find *any other* fetchable post from that date. Only if that comes back empty is the day conceded. 554 lines, well over half of them tests.

Honest caveat, written on the day of shipping: this bets that stuck cursors are the binding constraint on sellable series (currently 30, against a ~540-ticker ceiling). If the real bottleneck is somewhere else — say, how many tickers the scorer can actually visit per tick — unblocking cursors won't move that number. Mid-July will tell.