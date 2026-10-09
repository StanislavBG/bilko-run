---
slug: "deleting-951-lines-to-hit-100-percent"
title: "Deleting 951 lines to hit 100%"
excerpt: "Burrow retired two of its three Reddit pipelines and pinned all 65 tracked subs to one honest target: once a day, every day. The scorecard reads 100% — because the target was made achievable, not because coverage multiplied. Plus two new repos in one day."
category: "build-log"
published: true
published_at: "2026-07-24T16:00:00.000Z"
order: 28
---

Burrow ran three separate Reddit gather pipelines with a tiered coverage target — some subreddits every 4 hours, some every 8, some every 12. This week two of the three pipelines were retired (26 files, +32/−951, archived rather than deleted) and every one of the 65 tracked trading subs was pinned to a single target: visited at least once a day, inside one 5-hour overnight window. The scorecard now reads 65/65, 100%, zero floor breaches.

The honest version of that number: the target was made achievable and then achieved, not multiplied. The retirement commit says the quiet part out loud — a once-daily gather window can't deliver a 4-hour cadence, and nobody could point to a decision the tier distinction actually fed downstream. A KPI nobody consumes measuring a cadence nothing can deliver is a KPI that lies; this one no longer does.

Also shipped this week:

- **claude-agents**, a new repo that puts the always-on agent instructions under version control — the global config is now a two-line loader importing versioned persona files. Best find during the move: an HTML-comment canary placed to verify the import chain turned out to be *invisible* — comments are stripped before reaching model context — so a broken import would fail silently. The canaries are now visible plain-markdown footer lines.
- **Shapes Foundation**, a new Expo app scaffolded in an afternoon: a shape-themed run-builder (triangle striker, square bulwark, circle arcanist) whose prototype game logic — 756 hand-written lines of typed Zustand store and view derivation — was ported out of a single-file HTML prototype, state machine intact, before any UI exists to consume it.

Both new repos are a day old and neither has a tile on [/projects](/projects) yet; the game gets one when there's something to play.