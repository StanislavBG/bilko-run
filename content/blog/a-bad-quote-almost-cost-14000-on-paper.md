---
slug: "a-bad-quote-almost-cost-14000-on-paper"
title: "A Bad Quote Almost Cost $14,000 On Paper"
excerpt: "A published-live P&L number was off by roughly $14,000 because a spread's cost-to-close wasn't bounded by its own width — the fix moves loss-boundedness into the structure of every trade, not just the exit logic."
category: "build-log"
published: true
published_at: "2026-08-08T16:00:00.000Z"
order: 32
---

[Social-Signals-Trader](/projects/social-signals-trader/) publishes a real Alpaca account against SPY, live, on this site — every position, fill, and rationale. This week it started actually trading options: a credit-spread sleeve, screened down from a 116-name pool to 20 underlyings across 10 correlation buckets, sized to 90% of equity, with a real profit target and a real stop. Before this, the book was equities-only in spirit; 28 raw option legs showed up on the dashboard as 28 unpaired, undifferentiated rows, and there was no loss-side exit at all — just a profit target and hope.

The dashboard now groups those into 14 real spread rows instead of 28 raw legs, has an options-book summary panel, a glossary with a Help tooltip on every term, and a trade-detail page rewritten as a walkthrough for someone who's never seen an options position before. That's the visible half of the week.

The half worth writing down is a bug that reached the public page. A vertical spread's maximum possible cost to close is mathematically bounded by its width — a $1-wide spread cannot cost more than $100 a contract to exit, full stop. A bad indicative quote on a short BABA call ignored that bound and produced a cost-to-close of $9,184 against a true maximum of $5,600. That number was live on this dashboard, overstating the account's loss by roughly $3,600 on that one position and distorting total published equity by something closer to $14,000 once it fed into the account-wide P&L. Around the same time, a second bug was found: close cost had been computed per share while credit and max-loss were computed per contract, which is a 100x unit mismatch in the other direction — a book that was actually about $10,600 down was displaying as roughly $2,100 up.

The fix for the first bug isn't "get better quotes." It's clamping any cost-to-close at the spread's own width and flagging the trade `mark_suspect` when that clamp fires — a mark that's provably wrong gets ignored for P&L math, on principle, in either direction: it can't inflate a loss and it can't hide one. The strike-breach stop is a deliberate exception — it still fires on a suspect mark, because that exit is keyed off where the stock is trading relative to the strike, not off the bad quote itself. Underneath both bugs, the real structural fix is `assert_defined_risk`, a single choke point every spread has to pass before it can open: no naked legs, no mismatched legs, no diagonals. Loss-boundedness now lives in what a position is allowed to be, not in whether a stop fires fast enough.

The lesson: a stop is a promise that something will happen later; a defined-risk structure is a fact that's already true. The BABA bug and the per-share bug were two different kinds of mistakes, caught by two different reviews, and both would have been structurally impossible if the position itself couldn't exceed its own defined risk in the first place.

What I'd do differently: build the assert-everywhere invariant before the sleeve went live, not after a bad quote made it necessary. It's a cheap check to write and an expensive one to have skipped.

Worth knowing if you're reading the dashboard closely: the source for this work sits on a local branch about 200 commits ahead of what's pushed to GitHub — the trades and the numbers on the live page are real, the commit history behind them isn't public yet.