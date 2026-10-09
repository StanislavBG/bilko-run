---
slug: "sixty-five-hours-of-silence"
title: "65.6 hours: what a starved pipeline looks like"
excerpt: "Burrow's Facebook posting pipeline went 65.6 hours without a run while every individual scheduling decision was correct. The fix is one concept — starvation — plus two more repairs to instruments that were lying in both directions at once."
category: "build-log"
published: true
published_at: "2026-07-18T16:00:00.000Z"
order: 26
---

The number that moved this week: Burrow's Facebook posting pipeline went 65.6 hours without a single run — last post July 15 at 21:20 UTC, next on July 18 at 14:55, eleven minutes after the fix landed. Its sibling football-page pipeline: 63.2 hours. Both measured straight from the orchestrator's run database, both back to their normal twice-daily rhythm since.

The cause is the interesting part: no single scheduling decision was ever wrong. The posting pipelines are restricted to a narrow daily window; after an outage, a backlog of always-available pipelines was legitimately winning the priority comparison every time that window came around. Starvation emerged from a day of individually correct choices. The fix adds one concept — a restricted-window pipeline overdue by 24+ hours is *starved* — and sorts starved work above everything else, with normal priority still breaking ties.

That was one of three fixes in the same hardening pass, and the honest thread through all three is that Burrow's automation mostly worked while its instruments lied in both directions:

- The activity report counted **in-flight runs as failures** — a health check that manufactured failures out of its own timing. For scale: the window July 10–19 actually saw 3,594 completed runs against 15 real failures.
- The dashboard could show a pipeline as "running" **forever** — the running-state restore ran only at construction, never on refresh, so a pipeline mid-run when the dashboard started stayed "running" long after it finished. Introduced and fixed the same day, caught by code review.
- The loudest one: Reddit's promoted posts open advertiser sites in new tabs when clicked, the gather pipeline clicks by screen coordinates with no concept of an ad, and nothing ever closed those tabs. Zero log trace — the leak was invisible to every monitor and was reported by the human watching ad tabs pile up on screen. One captured ad had even made it into the signal corpus as a "post." Popups now get closed on arrival and promoted posts are excluded from both click and capture paths.

Next: the gather schedule itself is being rethought — more on that within the week.