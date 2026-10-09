---
slug: "the-bug-that-silently-killed-every-post"
title: "The Bug That Silently Killed Every Post"
excerpt: "Burrow's X posting ran on schedule for 11 days and published nothing, because the posting window and the post slots never actually overlapped. It's fixed now, and it's been quiet for a week since."
category: "build-log"
published: true
published_at: "2026-08-15T16:00:00.000Z"
order: 34
---

Burrow gathers Reddit, X, and Discord chatter for a downstream trading signal system, and this stretch was two separate reliability chases that both ended the same way — a cadence that looked fine on paper and wasn't.

The Reddit side ran three overlapping pipelines against a tiered coverage target: some of the 65 tracked trading subreddits every 4 hours, some every 8, some every 12. Nobody could point to what actually consumed the tier distinction downstream, and a `pick()` cap bug had quietly collapsed the real sweep to about 11 subreddits at steady state — 54 of 65 subs sitting at zero visits, coverage reading 16.9%. Both pipelines were retired and the whole thing became one daily full-universe sweep against one honest target: visited once every 24 hours. Simpler, and — this time — actually deliverable.

The X side was worse, because it failed silently. For 11 days, six scheduled posting sessions ran on time, every day, and published nothing. The root cause: scheduled posts only go out through a `post_scheduled` action inside a session run, and the post slots were hardcoded to 19:00 and 00:00 UTC. The actual active posting window was 09:00–11:00 UTC. Those times never overlapped. A post's only way out was a race against a 24-hour auto-expiry window, which historically won that race about 55% of the time by accident — until it didn't. Two specific queued posts expired in early August having made zero publish attempts. Reply success had its own version of the same failure: a stale account handle meant zero successful replies logged across 148 attempts over 30 days, while the system kept reporting the sessions as having run.

Neither of these threw an error. Both looked, from the outside, like a system doing its job on schedule. That's the pattern worth naming: a cadence bug doesn't crash, it just quietly does nothing, and the only way to catch it is to check the actual published output against the schedule, not the run logs. The fix pins the post-slot/window relationship together with a regression test, so the two can't drift back apart unnoticed the way they did the first time — nobody designed the fix that made it briefly work again, it was a side effect of a different, earlier commit widening the window; this time it's deliberate and locked in.

With that fixed, X moved to a tested, fixed 3x/day cadence — midnight, 6am, and noon PDT — with retry and diagnostics on the failures that are actually transient, and reply caps raised from 3/3/8 to a flat 10/10/10 with a weekly backstop of 70.

Worth saying plainly, in period: as of today, there's been no commit here in a week. That's not a verdict on why — just what's true right now, the same way the "0% reply success for 30 days" number was true before anyone looked at it. The live coverage scorecard reads 0.0% across all 65 subs this morning, which is what you'd expect from a pipeline that hasn't run recently, not necessarily a new problem.

This code isn't on GitHub — the local branch is 218 commits ahead of what's pushed, so there's nothing here to link to. Burrow doesn't have a tile on [/projects](/projects) either; it's infrastructure other projects consume, not something you'd visit directly.