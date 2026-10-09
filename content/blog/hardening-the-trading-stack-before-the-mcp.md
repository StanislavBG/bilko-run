---
slug: "hardening-the-trading-stack-before-the-mcp"
title: "Hardening the trading stack before opening the MCP"
excerpt: "Last week MCP-Host turned internal libraries into hosted, paid MCP services. This week I had to make one of those libraries actually safe to expose. signal-builder was about to get a public endpoint, and Burrow underneath it was running a browser-control server on port 8765 with no auth at all. The whole week was the hardening pass that had to happen first — plus the sentiment bug where \"BE\" parsed as a stock you could buy."
category: "build-log"
published: true
published_at: "2026-06-13T10:00:00.000Z"
order: 18
---

Last week I wrote up [MCP-Host](/blog/mcp-host-istore-for-mcps) — the gateway that turns internal libraries into hosted, paid MCP services. This week I had to make one of those libraries actually safe to put behind it. signal-builder, the trading-signal engine, was about to get a public endpoint. Burrow, the Reddit-gathering layer it sits on, was running a browser-control server on port 8765 with no auth at all. Before a single outside agent could call any of it, both needed a hardening pass. That pass was most of the week.

## "BE" is not a stock you can buy

The bug I'm least proud of: for weeks the sentiment pipeline treated any uppercase token as a ticker symbol. That's fine until a Reddit comment says "I would BE careful" or "just RIDE it out" — and the analytics layer dutifully logs sentiment for $BE and $RIDE as if they were positions. They *are* real tickers (BE is Bloom Energy, RIDE was Lordstown), which is exactly why a naive uppercase match swallows them.

The fix (commits 76100789, 417ed1b4) is a contextual guard: a common-word ticker only counts when the surrounding text actually looks like trading talk. I'd shipped the easy version — uppercase-means-ticker — and let it run, because in my own test threads nobody wrote "BE" as a verb. Real Reddit does, constantly.

## Burrow's port 8765 was wide open

Burrow drives a real browser to gather posts, and it exposed that control surface on localhost:8765 with no token, no SSRF guard, and a path-join that trusted its input. On a single-tenant box that's survivable. The moment signal-builder becomes a public MCP, Burrow is reachable infrastructure, and "it's only localhost" stops being a security model. Commit 173f438c added token auth, an SSRF guard on the fetch path, and a path-traversal fix — one commit, three holes that should never have been open.

## signal-builder's public-surface pass: PRDs 44–50

The bulk of the week was seven PRDs in signal-builder, almost all about what happens when a stranger calls your endpoint:

- **PRD 46 / 47** — public-surface hardening, plus validating the LLM's own output: the scorer asks Claude for primary_tickers, and it no longer trusts that answer blindly.
- **PRD 44 / 45** — the sentiment cache got WAL mode, a busy_timeout, batched upserts, bounded IN() lists, and index hygiene. Public reads can't be allowed to lock the writer.
- **PRD 48** — cut the Burrow round-trip fan-out, because every public call that hits Burrow N times is a public call that can knock Burrow over N times.
- **PRD 49 / 50** — panel-history retention (no pure-read persistence) and the multitenant auth / rate-limit / metering design for the public MCP.

Then a post-review pass closed a cursor transport-hole, a prune-replay bug, and some public-surface bounds. The theme across all of it: the eval cursor must never advance past an unscored post (afad1440), and a Burrow transport failure must never be mistaken for "genuinely no data" (4914ff0b). Both are the same class of bug — a failure that silently looks like success — and both are lethal when the output is a trade. signal-builder is at 543 test functions now, most of them pinning exactly these edges.

## A North-Star metric that wasn't there

The other half of the week was admitting I had no number for whether Burrow was actually *seeing* the market. I added a North-Star Reddit-coverage KPI (74748fca) and immediately found the gatherer was starvation-capped — it went deep on a few subreddits instead of broad across many. The fix (7a78ece0) flipped the binge from depth to breadth, which is the opposite of what felt productive: more posts per sub looks busier. Coverage was the KPI; posts-gathered was the vanity metric hiding behind it.

I also made health tell the truth: a stale system-health snapshot now downgrades to RED instead of reporting the last-known GREEN (797021b1). A monitor that goes green when it stops updating is worse than no monitor. Burrow went 0.8.1 → 0.8.3 across these passes.

## The outage I caused mid-refactor

One self-inflicted incident worth recording: I restructured Burrow's config loading and broke .env import order, which silently killed the browser lane — the gatherer kept running but couldn't drive a browser. The fix was one line (load .env at config import, 22c7fd68), but it was live longer than I'd like because the health layer at the time still said GREEN. That's not a coincidence with the previous section: the stale-green bug is exactly what let a real outage hide.

## What I'd do differently

I hardened the public surface in the same week I was still reshaping it — PRDs 44 through 50 were both changing the contract and locking it down at once. I should have frozen signal-builder's public tool signatures first, then hardened against a fixed target. Twice I hardened a function and then changed its shape two commits later, which means the security review was partly aimed at code that no longer existed. Next public-MCP candidate gets contract-freeze, then harden, then expose — in that order, not braided together.

## See the stack run

The public face of all this is the trade-in-public dashboard — Alpaca account vs SPY, the live trade log, and the Reddit-signal provenance behind each position: [social-signals-trader](/projects/social-signals-trader/). The signal engine itself is [signal-builder](https://github.com/StanislavBG/signal-builder); the gathering layer is [burrow](https://github.com/StanislavBG/burrow).

## FAQ

**Why a contextual guard instead of an allowlist of valid tickers?**
An allowlist of ~6,000 symbols would still match BE and RIDE — they *are* valid tickers. The problem isn't unknown symbols, it's real symbols colliding with common English words. Only context disambiguates "BE careful" from "$BE earnings," so the guard has to read the sentence, not the symbol table. An allowlist would have given me false confidence and the same bug.

**Is exposing a trading-signal engine as a public MCP a liability?**
The signals are sentiment and catalyst data, not advice, and the dashboard shows the actual Alpaca P&L against SPY so nobody has to take my word for edge. The hardening in this post is exactly the work that makes "public" defensible: rate limits so one caller can't drain it, metering so usage is accountable, and output validation so a prompt-injected Reddit post can't steer the scorer.

**Why keep SQLite (WAL + busy_timeout) for something going public instead of moving to Postgres?**
Because the read pattern is cache-shaped and single-writer, and WAL plus a busy_timeout handles concurrent public reads against one writer without the ops weight of a server. MCP-Host already runs Postgres with per-tenant RLS for the multi-tenant data; signal-builder's sentiment cache is local, disposable, and rebuildable. Two different problems, two different stores — moving the cache to Postgres would buy isolation it doesn't need.