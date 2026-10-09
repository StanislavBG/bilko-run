---
slug: "the-retry-that-cost-93-calls-to-fail-once"
title: "The Retry That Cost 93 Calls To Fail Once"
excerpt: "A flat 60-second timeout meant signal-builder's mention scorer retried doomed calls at the same size, up to 93 LLM calls to fail once. It now fails fast and splits instead."
category: "build-log"
published: true
published_at: "2026-08-04T16:00:00.000Z"
order: 31
---

The number that moved this week: the worst case for a mention-scoring batch that hits a timeout went from 93 LLM calls down to 31, and that's not a rounded estimate — it's a bound written into the code comments, because [Signal-Builder](/projects/signal-builder/)'s scorer splits a failed batch in half and retries recursively, so the call count is `2^5 - 1` at 5 split levels, times however many retries each level got.

The batches were timing out because a token-budget problem was being treated as a network hiccup. Every batch — whether it was 2 tickers or 50 — got the same flat 60-second subprocess timeout, and when a batch was too big to finish in that window, the retry logic tried the exact same call, at the exact same size, up to three more times before finally giving up. That's not a transient failure being retried through — it's a call that was never going to fit, burning roughly 200 seconds per split level on repeats of a call already known to be too big. One week's logs: 1,125 timeout warnings and 367 hard-timeout sentinels, with some ticks scoring only 2 to 4 of 50 tickers before the run deadline.

Two changes: the subprocess timeout now scales with chunk size instead of being flat, and a timeout on a batch call raises immediately instead of retrying at the same size — the caller splits the chunk and tries again smaller, rather than repeating a call that already told you it can't fit. Retries are kept only for the failures that are actually transient (a bad exit code, a parse error), not for the ones that are structural. New telemetry (`pop_timeout_stats()`) tracks timeout events and wasted seconds per tick, so the next grading pass has real numbers to check this against.

Worth saying plainly: the sibling fix that landed the day before this one (PRD 643, deadline-bound retry-split) didn't move throughput on its own — ticks after it shipped were still scoring only 2-4 of 50 tickers, which is why this fix was queued immediately behind it. And a prior optimization pass three weeks earlier was graded no-effect after shipping — flat 29-31 "sellable" tickers before and after — because it fixed something downstream of the real bottleneck. That history is why this one ships with its own telemetry instead of a claim.

This work isn't on GitHub yet — signal-builder's local branch is 116 commits ahead of what's pushed, so there's no commit to link here, just the fix as it stands locally.