---
slug: "the-book-didnt-know-what-it-already-held"
title: "The Book Didn't Know What It Already Held"
excerpt: "Two bugs on the same September morning in Social Signals Trader's credit-spread book — a leg collision and a stuck close — traced back to the same missing question: what does the broker say I'm actually holding right now?"
category: "build-log"
published: true
published_at: "2026-09-02T16:00:00.000Z"
order: 38
---

At 6:30am PT on September 2nd, [Social Signals Trader](/projects/social-signals-trader/) tried to sell a SPY 772/773 credit spread while its own book was already holding SPY 773/774. Alpaca refused it — `position intent mismatch, inferred: buy_to_close` — because 773 is a shared strike between the two spreads, and the broker won't let you be short and long the same contract in the same tick. The slot was wasted, and it wasn't the only bug that morning.

Two hours earlier, a strike-breach close had gone out at a $0.46 debit limit and just sat there while the market walked away from it. Every tick after that minted a fresh close order on top of the resting one — `CLOSE_*_R2`, `_R3`, and so on — and Alpaca refused each one with `40310000 insufficient qty available`, because the first close still held the contracts. That error got logged as generic noise forever, which meant the position was stuck and nothing was telling anyone.

Both bugs trace to the same root cause: the trader was planning its next move without asking what it already had resting with the broker. The fix for the leg collision (`plan()` now drops a colliding row into a `rejected_leg_collision` funnel bucket, and `execute()` checks again at the choke point) had to get more precise than "block anything that touches a held strike" — only the *opposite* side of a held contract actually collides. A second lot of the same spread is exactly what the broker accepts, and `max_per_underlying` already bounds how many of those you can hold. Blocking both directions would have quietly capped the strategy's own sizing. The gate also fails open on an unreadable book instead of refusing the whole tick: a missed check now costs one order, not every order that tick.

The stuck-close fix works the same way — read the broker's actual open `CLOSE_*` orders once per tick before submitting anything, match them to a position by short-leg symbol (iron condor wings share one entry `client_order_id`, so that match has to handle two legs under one ID), and either leave a marketable order alone, walk it toward the current price the same way entries re-peg, or force it to the natural price once the pre-close cutoff window is reached. A `40310000` refusal that still slips through now gets classified as `duplicate_close` instead of a generic error, so it stops silently counting toward the "stuck closes" alarm.

The same commit that fixed the leg collision also caught a data-hygiene problem: `tests/conftest.py` wasn't redirecting the trader's log and broker-state paths to a temp directory, so a night of test runs had leaked 166 synthetic MU rows into the live trade ledger. Removed, and now isolated by default — a fix that had nothing to do with the trading logic and everything to do with trusting what "the book" says it holds.

What I'd do differently: write the "what does the broker say I'm actually holding right now" read-and-reconcile step before writing the entry and exit logic that assumes it, not after two separate incidents on the same morning taught it the hard way. Both bugs are variations of the same missing question.

Since then the fund's mandate got written down in one place — 500% total account return per year, measured on live Alpaca equity, with the index-cluster cap and drawdown rails from the operator's risk budget now checked into `docs/MANDATE.md` instead of living in someone's head. Next: the iron condor primitives that shipped right after this (pair, order, contract key, margin proof) exist because a book that finally knows what it's holding is the precondition for holding more complex positions on purpose.